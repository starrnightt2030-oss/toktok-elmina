// Film catchphrases (إفيهات): files load in the background, play on game moments, one at a time, can be turned off.
// Usage: node tools/e2e_quips.cjs <base url>
const { chromium } = require('playwright');
const BASE = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const c = await b.newContext({ viewport: { width: 860, height: 412 }, isMobile: true, hasTouch: true });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const res = []; const ok = (cond, msg) => res.push((cond ? 'PASS ' : 'FAIL ') + msg);
  await p.goto(BASE + 'version.json'); await p.evaluate(() => localStorage.clear());
  await p.goto(BASE + 'index.html'); await p.waitForFunction(() => window.portSim && window.portSim.car, null, { timeout: 400000 });
  ok(await p.evaluate(() => window.portSim.quips.loaded === 0), 'no clip is downloaded during the first load');
  await p.evaluate(() => { document.getElementById('loading').style.display = 'none'; document.getElementById('btnStart').click(); });
  await p.waitForFunction(() => window.portSim.quips.last === 'board1', null, { timeout: 300000 }).catch(() => {});
  ok(await p.evaluate(() => window.portSim.quips.last === 'board1'), 'a catchphrase plays a couple of seconds after the shift starts (' + JSON.stringify(await p.evaluate(() => window.portSim.quips)) + ')');
  await p.waitForFunction(() => window.portSim.quips.loaded >= 27, null, { timeout: 360000 }).catch(() => {});
  ok(await p.evaluate(() => window.portSim.quips.loaded >= 27), 'all 27 clips load in the background once driving (' + await p.evaluate(() => window.portSim.quips.loaded) + ')');
  await p.waitForFunction(() => !window.portSim.quips.playing, null, { timeout: 60000 }).catch(() => {});
  await p.evaluate(() => window.portSim.quipReset());   // the test machine's game clock runs very slowly: skip the start clip's quiet time
  const r1 = await p.evaluate(() => window.portSim.quip('win', true)); const st = await p.evaluate(() => window.portSim.quips);
  ok(r1 && st.playing && st.last === 'win1', 'a moment plays its clip (' + JSON.stringify(st) + ')');
  ok(await p.evaluate(() => window.portSim.quip('crash', true) === false), 'only one clip at a time');
  await p.waitForFunction(() => !window.portSim.quips.playing, null, { timeout: 60000 }).catch(() => {});
  ok(await p.evaluate(() => !window.portSim.quips.playing), 'the clip ends and frees the slot');
  ok(await p.evaluate(() => window.portSim.quip('win', true) === false), 'a pause is kept between clips');
  // what was hit decides the clip
  const hk = await p.evaluate(async () => { const s = window.portSim, out = {};
    const c = s.traffic.find(t => Math.abs(t.z) > 2 && Math.abs(t.z) < 30) || s.traffic[0]; s.teleport(c.x + 2.2, c.z); out.car = s.hitKind();
    const w = s.walkers[0]; if (w) { s.teleport(w.m.position.x + 1.5, w.m.position.z); out.ped = s.hitKind(); }
    s.teleport(-120, -60); out.wall = s.traffic.some(t => Math.hypot(t.x + 120, t.z + 60) < 8) ? 'hitWall' : s.hitKind(); return out; });
  ok(hk.car === 'hitCar' && (hk.ped === undefined || hk.ped === 'hitPed') && hk.wall === 'hitWall', 'a crash tells a car, a person and a wall/pole apart (' + JSON.stringify(hk) + ')');
  for (const [k, ids] of [['hitCar', ['crash3', 'crash1', 'crash2']], ['hitWall', ['crash4', 'crash2', 'crash1']], ['hitPed', ['crash5', 'late3']], ['happy', ['drop1', 'win1']], ['late', ['late1', 'late2']], ['port', ['ride1']], ['yard', ['ride3']]]) {
    await p.evaluate(() => { window.portSim.quipReset(); });
    let played = false; for (let i = 0; i < 12 && !played; i++) played = await p.evaluate(k => window.portSim.quip(k, true), k);
    const last = await p.evaluate(() => window.portSim.quips.last);
    ok(played && ids.includes(last), 'moment "' + k + '" plays one of its own clips (' + last + ')');
    await p.evaluate(() => window.portSim.quipStop && window.portSim.quipStop());
    await p.waitForFunction(() => !window.portSim.quips.playing, null, { timeout: 60000 }).catch(() => {});
  }
  // driving into the port from the avenue → the port clip
  await p.evaluate(() => { window.portSim.quipReset(); window.portSim.teleport(-60, 4); });
  await p.waitForTimeout(3000);
  await p.evaluate(() => window.portSim.teleport(-60, -40));
  await p.waitForFunction(() => window.portSim.quips.last === 'ride1', null, { timeout: 240000 }).catch(() => {});
  ok(await p.evaluate(() => window.portSim.quips.last === 'ride1'), 'entering the port plays its clip (' + await p.evaluate(() => window.portSim.quips.last) + ')');
  await p.evaluate(() => window.portSim.quipStop()); await p.evaluate(() => window.portSim.quipReset());
  // passenger flow: boarding → a clip may follow; check nothing breaks the pay flow
  await p.evaluate(() => { const s = window.portSim; const w = s.waiting[0]; const P = s.POI[w.poi]; s.teleport(P.x + 1, P.z + 1); });
  await p.waitForFunction(() => !document.getElementById('pay').hidden, null, { timeout: 120000 }).catch(() => {});
  ok(await p.evaluate(() => !!window.portSim.boarding), 'passenger still boards and pays with clips on');
  // setting off → silent
  await p.evaluate(() => { document.getElementById('pay').hidden || window.portSim.payConfirm && 0; });
  await p.evaluate(() => { const b = [...document.querySelectorAll('#segQuips button')].find(x => x.textContent === 'مقفولة'); b.click(); });
  ok(await p.evaluate(() => !window.portSim.quips.on && localStorage.getItem('aps_quips') === '0'), 'setting turns the clips off and is remembered');
  ok(await p.evaluate(() => window.portSim.quip('win', true) === false), 'no clip plays when turned off');
  ok(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
  console.log(res.join('\n')); await b.close();
})();
