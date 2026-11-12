// Character voices without the browser's speech engine.
// 1) A recorded line (yours from the in-game studio, or an embedded pack in /voices) plays if it exists.
// 2) Otherwise the character "mumbles" in a playful game voice whose pitch and rhythm follow the text.
// Lines are keyed by their template, so "{d}" destinations etc. share one recording.

import { NS } from './storage.js';
const DB = NS + 'aps_voices', STORE = 'lines';   // Beta keeps its recordings apart from the main game
const fills = { '{d}': 'هناك', '{t}': '', '{n}': '', '{b}': '' };

export function createVoices(getCtx, getOut) {
  const V = { templates: [], byKey: new Map(), packIndex: {}, mine: new Map(), buffers: new Map(), playing: null };

  // ---------------------------------------------------------------- templates
  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }
  function keyOf(tpl) { let h = 2166136261; for (const ch of tpl) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }
  function addLine(text, who, group) {
    const tpl = norm(text); if (V.byKey.has(keyOf(tpl))) return;
    const re = new RegExp('^' + tpl.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[a-z]\}/g, '(.*?)') + '$');
    const say = norm(tpl.replace(/\{[a-z]\}/g, m => fills[m] ?? ''));
    const t = { key: keyOf(tpl), tpl, say, who, group, re, vars: /\{[a-z]\}/.test(tpl) };
    V.templates.push(t); V.byKey.set(t.key, t);
  }
  V.register = (group, data, who) => {
    const walk = (x, w) => {
      if (typeof x === 'string') addLine(x, w, group);
      else if (Array.isArray(x)) {
        if (x.length === 2 && (x[0] === 'p' || x[0] === 'd') && typeof x[1] === 'string') addLine(x[1], x[0], group);
        else x.forEach(y => walk(y, w));
      } else if (x && typeof x === 'object') Object.values(x).forEach(y => walk(y, w));
    };
    walk(data, who || 'p');
  };
  V.find = text => {
    const s = norm(text); const k = keyOf(s);
    if (V.byKey.has(k)) return V.byKey.get(k);
    for (const t of V.templates) if (t.vars && t.re.test(s)) return t;
    return null;
  };

  // ---------------------------------------------------------------- storage (your recordings)
  function db() {
    return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  }
  async function tx(mode, fn) { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(STORE, mode); const st = t.objectStore(STORE); const out = fn(st); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); }); }
  V.loadMine = async () => {
    try {
      const d = await db();
      await new Promise(res => { const t = d.transaction(STORE, 'readonly'); const c = t.objectStore(STORE).openCursor(); c.onsuccess = () => { const cur = c.result; if (cur) { V.mine.set(cur.key, cur.value); cur.continue(); } else res(); }; c.onerror = () => res(); });
    } catch (e) { /* private mode: recordings only live for this session */ }
  };
  V.saveMine = async (key, blob) => { V.mine.set(key, blob); V.buffers.delete('m' + key); try { await tx('readwrite', s => s.put(blob, key)); } catch (e) { } };
  V.deleteMine = async key => { V.mine.delete(key); V.buffers.delete('m' + key); try { await tx('readwrite', s => s.delete(key)); } catch (e) { } };

  // ---------------------------------------------------------------- embedded pack
  V.loadPack = async () => {
    try { const r = await fetch('./voices/index.json', { cache: 'no-cache' }); if (r.ok) V.packIndex = await r.json(); } catch (e) { }
  };

  async function bufferFor(t) {
    const ctx = getCtx(); if (!ctx) return null;
    if (V.mine.has(t.key)) {
      const id = 'm' + t.key; if (V.buffers.has(id)) return V.buffers.get(id);
      const ab = await V.mine.get(t.key).arrayBuffer(); const b = await ctx.decodeAudioData(ab); V.buffers.set(id, b); return b;
    }
    const f = V.packIndex[t.key]; if (!f) return null;
    const id = 'p' + t.key; if (V.buffers.has(id)) return V.buffers.get(id);
    const r = await fetch('./voices/' + f); const b = await ctx.decodeAudioData(await r.arrayBuffer()); V.buffers.set(id, b); return b;
  }

  // ---------------------------------------------------------------- playback
  V.stop = () => { if (V.playing) { try { V.playing.stop(); } catch (e) { } V.playing = null; } };
  V.speak = async (text, o = {}) => {
    const ctx = getCtx(); if (!ctx) { o.onend && o.onend(); return; }
    V.stop();
    const t = V.find(text);
    let buf = null; try { if (t) buf = await bufferFor(t); } catch (e) { buf = null; }
    if (buf) {
      const s = ctx.createBufferSource(); s.buffer = buf; const g = ctx.createGain(); g.gain.value = 1.4;
      s.connect(g); g.connect(getOut()); s.onended = () => { if (V.playing === s) V.playing = null; o.onend && o.onend(); };
      s.start(); V.playing = s; return;
    }
    if (o.babble === false) { o.onend && o.onend(); return; }
    babble(ctx, text, o);
  };

  // Playful game mumble: one short vowel-like blip per syllable, pitch follows the letters.
  function babble(ctx, text, o) {
    const out = ctx.createGain(); out.gain.value = 0.5; out.connect(getOut());
    const letters = [...text.replace(/[^؀-ۿa-zA-Z0-9]/g, '')];
    const n = Math.max(3, Math.min(22, Math.round(letters.length / 2.6)));
    const base = (o.female ? 260 : 135) * (o.pitch || 1), rate = 11.5 * (o.rate || 1);
    const F = [[730, 1090], [270, 2290], [300, 870], [530, 1840], [570, 840], [440, 1020]];
    let t = ctx.currentTime + 0.03; const end = [];
    for (let i = 0; i < n; i++) {
      const c = (letters[Math.floor(i * letters.length / n)] || 'ا').codePointAt(0);
      const d = (0.6 + (c % 5) * 0.09) / rate, f0 = base * (1 + ((c * 7) % 9 - 4) * 0.045) * (i === n - 1 ? (/[؟?]/.test(text) ? 1.25 : 0.82) : 1);
      const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(f0, t); osc.frequency.linearRampToValueAtTime(f0 * (1 + (c % 3 - 1) * 0.08), t + d);
      const v = F[c % F.length]; const g = ctx.createGain();
      const b1 = ctx.createBiquadFilter(); b1.type = 'bandpass'; b1.frequency.value = v[0] * (o.female ? 1.15 : 1); b1.Q.value = 5;
      const b2 = ctx.createBiquadFilter(); b2.type = 'bandpass'; b2.frequency.value = v[1] * (o.female ? 1.15 : 1); b2.Q.value = 7;
      const m = ctx.createGain(); m.gain.value = 0.55;
      osc.connect(b1); osc.connect(b2); b1.connect(g); b2.connect(m); m.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + d * 0.92);
      osc.start(t); osc.stop(t + d); end.push(osc);
      t += d + (c % 7 === 0 ? 0.06 : 0.012);
    }
    const last = end[end.length - 1]; V.playing = { stop: () => { end.forEach(x => { try { x.stop(); } catch (e) { } }); } };
    last.onended = () => { o.onend && o.onend(); };
  }

  // ---------------------------------------------------------------- export / import
  V.exportPack = async () => {
    const lines = [];
    for (const [key, blob] of V.mine) {
      const t = V.byKey.get(key); const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
      lines.push({ key, text: t ? t.tpl : '', who: t ? t.who : '', type: blob.type, audio: b64 });
    }
    return new Blob([JSON.stringify({ app: 'toktok-elmina', kind: 'voice-pack', made: new Date().toISOString(), lines })], { type: 'application/json' });
  };
  V.importPack = async file => {
    const j = JSON.parse(await file.text()); let n = 0;
    for (const l of j.lines || []) { const bin = Uint8Array.from(atob(l.audio), c => c.charCodeAt(0)); await V.saveMine(l.key, new Blob([bin], { type: l.type || 'audio/webm' })); n++; }
    return n;
  };
  return V;
}
