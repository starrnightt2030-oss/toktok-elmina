// Embed a voice pack recorded in the in-game studio into the app, so every player hears it.
// Usage: node tools/import_voice_pack.mjs <pack.json exported from الاستوديو> [--replace]
// Each line is cleaned (silence trimmed at both ends, loudness normalised), saved as mono MP3 in
// public/voices/, and added to public/voices/index.json (key → file) which the game loads at start.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const [, , packPath, flag] = process.argv;
if (!packPath) { console.error('usage: node tools/import_voice_pack.mjs pack.json [--replace]'); process.exit(1); }
const pack = JSON.parse(readFileSync(packPath, 'utf8'));
if (pack.kind !== 'voice-pack' || !Array.isArray(pack.lines)) { console.error('not a voice pack'); process.exit(1); }
const dir = 'public/voices'; mkdirSync(dir, { recursive: true });
const idxPath = join(dir, 'index.json');
const index = (!flag && existsSync(idxPath)) ? JSON.parse(readFileSync(idxPath, 'utf8')) : {};
let ok = 0, bad = 0;
for (const l of pack.lines) {
  if (!/^[a-z0-9]+$/.test(l.key)) { bad++; continue; }
  const src = join(tmpdir(), 'vp_' + l.key), out = join(dir, l.key + '.mp3');
  writeFileSync(src, Buffer.from(l.audio, 'base64'));
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-af',
      'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=11',
      '-ac', '1', '-ar', '44100', '-b:a', '64k', out]);
    index[l.key] = l.key + '.mp3'; ok++;
  } catch (e) { bad++; console.warn('skip', l.key, l.text, String(e.message).slice(0, 120)); }
  rmSync(src, { force: true });
}
writeFileSync(idxPath, JSON.stringify(index, null, 0));
console.log(`embedded ${ok} lines (${bad} skipped) → ${idxPath} now has ${Object.keys(index).length} lines`);
