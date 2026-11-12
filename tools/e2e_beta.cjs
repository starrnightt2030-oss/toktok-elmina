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
  await p.waitForFunction(() => window.portSim.fare, null, { timeout: 60000 }).catch(() => {});
  ok(await p.evaluate(() => !!window.portSim.fare), 'passenger: boards when stopped next to them');
  for (let k = 0; k < 20; k++) { await p.evaluate(() => window.portSim.startPay()); if (await p.evaluate(() => window.portSim.fare.change > 0)) break; }
  const f = await p.evaluate(() => ({ price: window.portSim.fare.price, given: window.portSim.fare.given, change: window.portSim.fare.change }));
  await p.evaluate(ch => { const A = '٠١٢٣٤٥٦٧٨٩', ar = n => String(n).replace(/[0-9]/g, d => A[d]); let r = ch; for (const v of [50, 20, 10, 5, 1]) while (r >= v) { [...document.querySelectorAll('#pNotes .note')].find(x => x.textContent.replace('جنيه', '').trim() === ar(v)).click(); r -= v; } document.getElementById('pOk').click(); }, f.change);
  await p.waitForTimeout(600);
  const after = await p.evaluate(() => ({ fare: !!window.portSim.fare, saved: JSON.parse(localStorage.getItem(PFX_ + 'aps_tuk_v2')) }));
  ok(!after.fare && after.saved.trips === 1 && after.saved.wallet > 60, 'fare + change: paid ' + f.given + ' for ' + f.price + ', change ' + f.change + ' → wallet ' + after.saved.wallet + ', trips ' + after.saved.trips);
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
  const rl = await p.evaluate(() => document.getElementById('menuWallet').textContent); ok(/مشاوير: 1/.test(rl), 'save: survives a reload (' + rl + ')');
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
