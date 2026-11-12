// Save migration tests: run with `node tools/save_test.mjs`.
import { makeStore, loadSave, importMainSave, SAVE_KEY } from '../src/storage.js';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const mem = (init = {}, opts = {}) => { const d = Object.assign({}, init); return { d, getItem: k => (k in d ? d[k] : null), setItem: (k, v) => { if (opts.full) throw new Error('quota'); d[k] = String(v); }, removeItem: k => { delete d[k]; } }; };
const OLD = { wallet: 125, total: 75, trips: 3, owned: ['yellow', 'orange', 'red', 'blue'], paint: 'blue', slogan: 'زرقك على الله', vehicle: 'van' };

{ const b = mem(); const r = loadSave(makeStore(b, '')); ok(r.status === 'new' && r.writable && r.save.wallet === 60 && r.save.saveVersion === 1, 'new player gets defaults'); }
{ const b = mem({ [SAVE_KEY]: JSON.stringify(OLD) }); const s = makeStore(b, ''); const r = loadSave(s);
  ok(r.status === 'migrated' && r.writable, 'old save migrated: ' + r.status);
  ok(b.d[SAVE_KEY + '_backup_v0'] === JSON.stringify(OLD), 'backup of the old save written byte for byte');
  const st = JSON.parse(b.d[SAVE_KEY]); ok(st.saveVersion === 1 && st.wallet === 125 && st.total === 75 && st.trips === 3 && st.paint === 'blue' && st.slogan === 'زرقك على الله' && st.vehicle === 'van' && st.owned.join() === OLD.owned.join(), 'wallet, trips, paint, slogan, vehicle kept');
  const r2 = loadSave(s); ok(r2.status === 'current' && r2.save.wallet === 125, 'second load is current, nothing changes'); }
{ const old = Object.assign({}, OLD); delete old.vehicle; const b = mem({ [SAVE_KEY]: JSON.stringify(old) }); const r = loadSave(makeStore(b, ''));
  ok(r.save.vehicle === 'tuk' && r.status === 'migrated', 'save from before the Suzuki gets vehicle=tuk'); }
{ const bad = Object.assign({}, OLD, { wallet: 'abc' }); const b = mem({ [SAVE_KEY]: JSON.stringify(bad) }); const r = loadSave(makeStore(b, ''));
  ok(r.save.wallet === 60 && r.save.trips === 3 && b.d[SAVE_KEY + '_backup_v0'] === JSON.stringify(bad), 'broken wallet reset, rest kept, original backed up'); }
{ const b = mem({ [SAVE_KEY]: '{not json' }); const r = loadSave(makeStore(b, ''));
  ok(r.status === 'corrupt' && !r.writable && b.d[SAVE_KEY] === '{not json', 'unreadable save is left untouched'); }
{ const fut = Object.assign({}, OLD, { saveVersion: 9 }); const b = mem({ [SAVE_KEY]: JSON.stringify(fut) }); const r = loadSave(makeStore(b, ''));
  ok(r.status === 'future' && !r.writable && b.d[SAVE_KEY] === JSON.stringify(fut), 'save from a newer version is not modified'); }
{ const b = mem({ [SAVE_KEY]: JSON.stringify(OLD) }, { full: true }); const r = loadSave(makeStore(b, ''));
  ok(r.status === 'migrated-unsaved' && !r.writable && b.d[SAVE_KEY] === JSON.stringify(OLD) && r.save.wallet === 125, 'storage full: old save untouched, game plays from memory'); }
{ const b = mem({ [SAVE_KEY]: JSON.stringify(OLD) }); const beta = makeStore(b, 'beta_'); const r = loadSave(beta);
  ok(r.status === 'new' && b.d[SAVE_KEY] === JSON.stringify(OLD), 'beta starts on its own key and never reads/writes the main save');
  const im = importMainSave(beta); ok(im.ok && JSON.parse(b.d['beta_' + SAVE_KEY]).wallet === 125, 'beta import copies the main save');
  ok(b.d[SAVE_KEY] === JSON.stringify(OLD) && !(SAVE_KEY + '_backup_v0' in b.d), 'import leaves the main save byte for byte');
  ok(loadSave(beta).save.slogan === 'زرقك على الله', 'beta loads the imported save'); }
console.log(fails ? fails + ' FAILED' : 'all save tests passed'); process.exit(fails ? 1 : 0);
