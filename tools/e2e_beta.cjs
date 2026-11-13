// End-to-end check of the Beta build in headless Chromium.
// Usage: node tools/e2e_beta.cjs <base url of the beta build>   (e.g. http://localhost:8770/toktok-elmina/beta/)
const { chromium } = require('playwright');
const BASE = process.argv[2];
const PFX = process.argv[3] === 'main' ? '' : 'beta_';   // main build saves on the un-prefixed keys
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const c = await b.newContext({ viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true, permissions: ['microphone'] });
  await c.addInitScript(pfx => { window.PFX_ = pfx; }, PFX);
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const res = []; const ok = (cond, msg) => { res.push((cond ? 'PASS ' : 'FAIL ') + msg); };
  const click = id => p.evaluate(i => document.getElementById(i).click(), id);
  const ready = () => p.waitForFunction(() => window.portSim && window.portSim.car, null, { timeout: 90000 });
  await p.goto(BASE + 'version.json'); await p.evaluate(() => localStorage.clear());
  await p.goto(BASE + 'index.html'); await ready();
  await p.evaluate(() => { document.getElementById('loading').style.display = 'none'; });
  // ---- garage: free paint + slogan, saved
  await click('btnGarage'); await p.waitForTimeout(300);
  await p.evaluate(() => { [...document.querySelectorAll('#paints .paint')][2].click(); [...document.querySelectorAll('#slogans .paint')][1].click(); });
  const g = await p.evaluate(() => JSON.parse(localStorage.getItem(PFX_ + 'aps_tuk_v2')));
  ok(g && g.paint === 'red' && g.saveVersion === 1 && typeof g.slogan === 'string', 'garage: paint + slogan saved to the beta key (' + (g && g.paint) + ')');
  if (PFX) ok(await p.evaluate(() => localStorage.getItem('aps_tuk_v2') === null), 'garage: main key never written');
  await click('garClose');
  // ---- radio UI
  await click('btnStart'); await p.waitForTimeout(1500);
  await p.evaluate(() => { document.getElementById('bRadio').click(); }); await p.waitForTimeout(300);
  await p.evaluate(() => { document.getElementById('rPower').click(); document.getElementById('st3').click(); }); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => window.portSim.radio.on && window.portSim.radio.idx === 3), 'radio: powers on and tunes to إذاعة الأغاني');
  await p.evaluate(() => { document.getElementById('rPower').click(); document.getElementById('rClose').click(); });
  // ---- driving: throttle, turbo, brake
  await p.evaluate(() => window.portSim.teleport(-160, 7, -Math.PI / 2));
  await p.evaluate(() => { window.portSim.input.up = 1; }); await p.waitForFunction(() => window.portSim.car.v > 4, null, { timeout: 60000 }).catch(() => {});
  const v1 = await p.evaluate(() => window.portSim.car.v); ok(v1 > 4, 'driving: throttle accelerates (' + (v1 * 3.6).toFixed(0) + ' km/h)');
  await p.evaluate(() => { window.portSim.input.turbo = 1; }); await p.waitForTimeout(4000);
  const tb = await p.evaluate(() => ({ boost: window.portSim.car.boost, y: window.portSim.car.y })); ok(tb.y < 0.5, 'turbo: stays on the ground (y=' + tb.y.toFixed(2) + ', boost=' + tb.boost + ')');
  await p.evaluate(() => { const i = window.portSim.input; i.turbo = 0; i.up = 0; i.down = 1; });
  await p.waitForFunction(() => Math.abs(window.portSim.car.v) < 0.6, null, { timeout: 90000 }).catch(() => {});
  ok(await p.evaluate(() => Math.abs(window.portSim.car.v) < 0.6), 'brakes: comes to a stop');
  await p.evaluate(() => { window.portSim.input.down = 0; });
  // ---- passenger + change
  await p.evaluate(() => { const s = window.portSim; const w = s.waiting[0]; const P = s.POI[w.poi]; s.teleport(P.x + 1, P.z + 1); });
  // Phase 8: the rider walks over, gets in and pays straight away; the change goes back by itself once it is right
  await p.waitForFunction(() => !document.getElementById('pay').hidden, null, { timeout: 120000 }).catch(() => {});
  ok(await p.evaluate(() => !!window.portSim.boarding && !document.getElementById('pay').hidden), 'passenger: boards when stopped next to them and pays on getting in');
  const f = await p.evaluate(() => { const s = window.portSim, b = s.boarding || s.riders[s.riders.length - 1]; return { price: b.price, given: b.given, change: b.change }; });
  await p.evaluate(ch => { const A = '٠١٢٣٤٥٦٧٨٩', ar = n => String(n).replace(/[0-9]/g, d => A[d]); let r = ch; for (const v of [50, 20, 10, 5, 1]) while (r >= v) { [...document.querySelectorAll('#pNotes .note')].find(x => x.textContent.replace('جنيه', '').trim() === ar(v)).click(); r -= v; } }, f.change);
  await p.waitForFunction(() => document.getElementById('pay').hidden && window.portSim.riders.length === 1, null, { timeout: 30000 }).catch(() => {});
  const mid = await p.evaluate(() => ({ n: window.portSim.riders.length, w: JSON.parse(localStorage.getItem(PFX_ + 'aps_tuk_v2')).wallet }));
  ok(mid.n === 1 && mid.w === 60 + f.price, 'fare + change: paid ' + f.given + ' for ' + f.price + ', change ' + f.change + ' handed back with no confirm button → wallet ' + mid.w);
  await p.evaluate(() => { const s = window.portSim, P = s.POI[s.riders[0].to]; s.teleport(P.x, P.z); });
  await p.waitForFunction(() => window.portSim.riders.length === 0, null, { timeout: 60000 }).catch(() => {});
  const after = await p.evaluate(() => ({ n: window.portSim.riders.length, saved: JSON.parse(localStorage.getItem(PFX_ + 'aps_tuk_v2')) }));
  ok(after.n === 0 && after.saved.trips === 1 && after.saved.wallet >= mid.w, 'drop-off: rider gets out at the destination, trips ' + after.saved.trips + ', wallet ' + after.saved.wallet);
  // ---- studio: record one line with the fake microphone
  await p.evaluate(() => { document.getElementById('pause') && (document.getElementById('pause').hidden = true); document.getElementById('hud').hidden = true; document.getElementById('menu').hidden = false; });
  await click('btnStudio'); await p.waitForTimeout(400);
  // headless rendering is slow, so wait on the page's own state instead of fixed delays
  await click('stRec'); await p.waitForFunction(() => document.getElementById('stRec').classList.contains('on'), null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(2500); await click('stRec');
  await p.waitForFunction(() => /اتسجّل (1|١) من/.test(document.getElementById('stDone').textContent), null, { timeout: 60000 }).catch(() => {});
  const st = await p.evaluate(() => document.getElementById('stDone').textContent); ok(/اتسجّل (1|١) من/.test(st), 'studio: records a line with the microphone (' + st + ')');
  const dbs = await p.evaluate(async () => (indexedDB.databases ? (await indexedDB.databases()).map(d => d.name) : []));
  ok(PFX ? (dbs.includes('beta_aps_voices') && !dbs.includes('aps_voices')) : dbs.includes('aps_voices'), 'studio: recordings stored in this channel\'s database (' + dbs.join(',') + ')');
  await click('stClose');
  // ---- reload keeps everything
  await p.reload(); await ready();
  const rl = await p.evaluate(() => document.getElementById('menuWallet').textContent); ok(/(مشاوير: 1|· 1 مشوار)/.test(rl), 'save: survives a reload (' + rl + ')');
  // ---- Phase 2 UI: every window opens/closes many times without leaking listeners, DOM nodes or hidden world objects
  {
    await p.evaluate(() => { document.getElementById('loading').style.display = 'none'; });
    const cdp = await c.newCDPSession(p); await cdp.send('Performance.enable');
    const metrics = async () => { await cdp.send('HeapProfiler.collectGarbage'); const m = (await cdp.send('Performance.getMetrics')).metrics; const g = n => (m.find(x => x.name === n) || {}).value; return { L: g('JSEventListeners'), N: g('Nodes'), H: Math.round(g('JSHeapUsedSize') / 1048576) }; };
    const visCount = () => p.evaluate(() => window.portSim.scene.children.filter(o => o.visible).length);
    const pairs = [['btnGarage', 'garClose', 'garage'], ['btnSettings', 'setClose', 'settings'], ['btnStudio', 'stClose', 'studio'], ['btnProgress', 'pgClose', 'progress'], ['btnMenuRadio', 'rClose', 'radio']];
    const cycle = n => p.evaluate(([pairs, n]) => { for (let k = 0; k < n; k++) for (const [o, x] of pairs) { document.getElementById(o).click(); document.getElementById(x).click(); } }, [pairs, n]);
    const v0 = await visCount(); await cycle(3); const m1 = await metrics(); await cycle(30); const m2 = await metrics();
    const allClosed = await p.evaluate(pairs => pairs.every(([, , id]) => document.getElementById(id).hidden), pairs);
    ok(allClosed, 'menus: garage, settings, studio, progress, radio open and close (x33 each)');
    ok(m2.L - m1.L <= 5 && m2.N - m1.N <= 40, 'menus: no listener/DOM growth after 150 more open/close (listeners ' + m1.L + '→' + m2.L + ', nodes ' + m1.N + '→' + m2.N + ', heap ' + m1.H + '→' + m2.H + ' MB)');
    ok((await visCount()) === v0 && await p.evaluate(() => !document.body.classList.contains('in-garage')), 'garage: world fully restored after leaving the workshop (' + v0 + ' visible objects)');
    const w0 = await p.evaluate(() => document.getElementById('menuWallet').textContent);
    await click('btnGarage'); await p.evaluate(() => [...document.querySelectorAll('#paints .paint')][1].click()); await click('garClose');
    ok(await p.evaluate(w => document.getElementById('menuWallet').textContent === w, w0), 'garage: re-applying an owned colour after many reopenings charges nothing');
    await click('btnStart'); await p.waitForTimeout(800);
    const cams = await p.evaluate(async () => { const out = []; for (let i = 0; i < 3; i++) { document.getElementById('bCam').click(); await new Promise(r => setTimeout(r, 400)); out.push(document.body.classList.contains('cam-in')); } return out; });
    ok(cams.join() === 'false,true,false', 'camera: far → inside → near cycle, cockpit mode toggles (' + cams.join() + ')');
    await p.evaluate(() => { document.getElementById('bHorn').click(); });
    ok(await p.evaluate(() => ['#bPause', '#bCam', '#bMute', '#bRadio', '#bHorn', '.pedal.gas', '#brakePad', '.cbtn.turbo', '.cbtn.horn', '.cbtn.drift'].every(q => { const e = document.querySelector(q); if (!e) return false; const r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return r.width >= 36 && r.height >= 36 && t && (t === e || e.contains(t)); })), 'hud: every driving button is visible, ≥36px and not covered');
    await p.reload(); await ready(); await p.evaluate(() => { document.getElementById('loading').style.display = 'none'; });
  }
  // ---- Suzuki line, one stop
  await p.evaluate(() => { document.getElementById('loading').style.display = 'none'; document.querySelectorAll('#vehPick button')[1].click(); });
  await p.waitForTimeout(2500); await ready();
  ok(await p.evaluate(() => window.portSim.car.kind === 'van' && JSON.parse(localStorage.getItem(PFX_ + 'aps_tuk_v2')).vehicle === 'van'), 'suzuki: selected and saved');
  await p.evaluate(() => { document.getElementById('loading').style.display = 'none'; document.getElementById('btnStart').click(); }); await p.waitForTimeout(1500);
  await p.evaluate(() => { const s = window.portSim, L = s.line; window._i0 = L.idx; const P = s.POI[L.stops[L.idx]]; s.teleport(P.x + 1, P.z + 1); });
  await p.waitForFunction(() => { const L = window.portSim.line; return (L.phase === 'drive' && L.idx !== window._i0) || !document.getElementById('pay').hidden; }, null, { timeout: 90000 }).catch(() => {});
  for (let k = 0; k < 8; k++) { if (await p.evaluate(() => document.getElementById('pay').hidden)) break;
    await p.evaluate(() => { const A = '٠١٢٣٤٥٦٧٨٩', ar = n => String(n).replace(/[0-9]/g, d => A[d]), de = t => Number(t.replace(/[٠-٩]/g, d => A.indexOf(d))); let r = de(document.getElementById('eGiven').textContent) - de(document.getElementById('eFare').textContent); for (const v of [50, 20, 10, 5, 1]) while (r >= v) { [...document.querySelectorAll('#pNotes .note')].find(x => x.textContent.replace('جنيه', '').trim() === ar(v)).click(); r -= v; } document.getElementById('pOk').click(); });
    await p.waitForFunction(() => !document.getElementById('pay').hidden || window.portSim.line.phase !== 'pay', null, { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(300); }
  await p.waitForFunction(() => window.portSim.line.phase === 'drive', null, { timeout: 30000 }).catch(() => {});
  const L = await p.evaluate(() => ({ idx: window.portSim.line.idx, riders: window.portSim.line.riders.length, i0: window._i0 }));
  ok(L.idx !== L.i0, 'suzuki: stop served and moved on (riders ' + L.riders + ')');
  if (PFX) ok(await p.evaluate(() => localStorage.getItem('aps_tuk_v2') === null), 'whole run: main save key never touched');
  console.log(res.join('\n')); console.log('page errors:', errs.length ? errs : 'none'); await b.close();
  process.exit(res.some(r => r.startsWith('FAIL')) ? 1 : 0);
})();
