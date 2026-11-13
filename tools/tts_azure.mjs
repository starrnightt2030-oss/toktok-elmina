// Generate every dialogue line with Microsoft Azure's Egyptian Arabic neural voices and embed them in the game.
// Usage: AZURE_KEY=... AZURE_REGION=westeurope node tools/tts_azure.mjs voice_lines.csv [--only=mallem,young] [--limit=12]
//   voice_lines.csv = the list exported from the game (columns: file, voice_id, …, النص اللي يتقال …), key = part after the first "_"
// Output: public/voices/<key>.mp3 + public/voices/index.json (key → file), the same pack the game already loads.
// Characters are told apart by voice (Shakir / Salma) plus pitch and rate, all within natural limits.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.AZURE_KEY, REGION = process.env.AZURE_REGION || 'westeurope';
const [, , csvPath, ...flags] = process.argv;
if (!KEY || !csvPath) { console.error('usage: AZURE_KEY=… AZURE_REGION=… node tools/tts_azure.mjs voice_lines.csv [--only=a,b] [--limit=n]'); process.exit(1); }
const opt = Object.fromEntries(flags.map(f => f.replace(/^--/, '').split('=')));
const ONLY = opt.only ? opt.only.split(',') : null, LIMIT = opt.limit ? +opt.limit : Infinity;

// voice profile per character
const VOICE = {
  mallem: { name: 'ar-EG-ShakirNeural', pitch: '-2%', rate: '0%' },
  young:  { name: 'ar-EG-ShakirNeural', pitch: '+9%', rate: '+8%' },
  elder:  { name: 'ar-EG-ShakirNeural', pitch: '-12%', rate: '-12%' },
  woman:  { name: 'ar-EG-SalmaNeural',  pitch: '0%', rate: '0%' },
  worker: { name: 'ar-EG-ShakirNeural', pitch: '-6%', rate: '+6%' },
  guard:  { name: 'ar-EG-ShakirNeural', pitch: '-8%', rate: '-4%' },
  radio:  { name: 'ar-EG-SalmaNeural',  pitch: '+2%', rate: '-4%' },
  vendor: { name: 'ar-EG-ShakirNeural', pitch: '+4%', rate: '+4%' },
  mechanic: { name: 'ar-EG-ShakirNeural', pitch: '-4%', rate: '+2%' },
};

function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const rows = parseCSV(readFileSync(csvPath, 'utf8').replace(/^﻿/, ''));
const head = rows.shift(); const iFile = head.indexOf('file'), iVoice = head.indexOf('voice_id'), iSay = head.findIndex(h => h.includes('يتقال'));
const dir = 'public/voices'; mkdirSync(dir, { recursive: true });
const idxPath = join(dir, 'index.json'); const index = existsSync(idxPath) ? JSON.parse(readFileSync(idxPath, 'utf8')) : {};
let n = 0, fail = 0;
for (const r of rows) {
  if (!r[iFile] || n >= LIMIT) continue; const v = r[iVoice]; if (ONLY && !ONLY.includes(v)) continue;
  const p = VOICE[v]; if (!p) { console.warn('no voice profile for', v); continue; }
  const key = r[iFile].slice(r[iFile].indexOf('_') + 1), text = r[iSay].trim(); if (!text) continue;
  const ssml = `<speak version="1.0" xml:lang="ar-EG"><voice name="${p.name}"><prosody pitch="${p.pitch}" rate="${p.rate}">${esc(text)}</prosody></voice></speak>`;
  const res = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': KEY, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'toktok-elmina' }, body: ssml });
  if (!res.ok) { fail++; console.warn('failed', r[iFile], res.status, (await res.text()).slice(0, 160)); if (res.status === 401 || res.status === 403) break; continue; }
  writeFileSync(join(dir, key + '.mp3'), Buffer.from(await res.arrayBuffer())); index[key] = key + '.mp3'; n++;
  if (n % 10 === 0) console.log(n, 'lines…');
  await new Promise(r => setTimeout(r, 120));   // stay well under the free tier's rate limit
}
writeFileSync(idxPath, JSON.stringify(index));
console.log(`generated ${n} lines (${fail} failed) → ${idxPath} has ${Object.keys(index).length}`);
