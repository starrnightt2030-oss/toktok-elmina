// End-to-end check of the driving update: slide steering, automatic gas, smoother/faster traffic, and «وضع المجنون».
// Usage: node tools/e2e_crazy.cjs <base url>   (e.g. http://localhost:8774/toktok-elmina/)
const { chromium } = require('playwright');
const BASE = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const c = await b.newContext({ viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const res = []; const ok = (cond, msg) => res.push((cond ? 'PASS ' : 'FAIL ') + msg);
  await p.goto(BASE + 'version.json'); await p.evaluate(() => localStorage.clear());
  await p.goto(BASE + 'index.html'); await p.waitForFunction(() => window.portSim && window.portSim.car, null, { timeout: 120000 });
  await p.evaluate(() => { document.getElementById('loading').style.display = 'none'; });

  // ---- traffic: step it offline-fast and look for jumps, overlaps and speeds
  const tr = await p.evaluate(() => {
    const T = window.portSim.traffic; const prev = T.map(t => ({ x: t.x, z: t.z, h: Math.atan2(t.hx, t.hz) }));
    let maxTurn = 0, maxJump = 0, nan = 0, vmax = 0, vsum = 0, n = 0, overlap = 0;
    for (let k = 0; k < 1800; k++) {   // 60 s at 30 fps
      window.portSim.trafficStep(1 / 30, 1);
      T.forEach((t, i) => {
        if (!isFinite(t.x) || !isFinite(t.z)) nan++;
        const h = Math.atan2(t.hx, t.hz); let d = h - prev[i].h; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        maxTurn = Math.max(maxTurn, Math.abs(d)); maxJump = Math.max(maxJump, Math.hypot(t.x - prev[i].x, t.z - prev[i].z));
        prev[i] = { x: t.x, z: t.z, h }; vmax = Math.max(vmax, t.v); vsum += t.v; n++;
      });
      if (k % 30 === 0) for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) { if (T[i].P !== T[j].P) continue; if (Math.hypot(T[i].x - T[j].x, T[i].z - T[j].z) < 1.5) overlap++; }
    }
    return { maxTurn, maxJump, nan, vmax: vmax * 3.6, vavg: vsum / n * 3.6, overlap, count: T.length };
  });
  ok(tr.nan === 0, 'traffic: positions stay finite');
  ok(tr.maxJump < 1.2, 'traffic: no position jumps (max ' + tr.maxJump.toFixed(2) + ' m per frame)');
  ok(tr.maxTurn < 0.25, 'traffic: heading turns smoothly at corners (max ' + (tr.maxTurn * 57.3).toFixed(1) + '° per frame)');
  ok(tr.vmax > 55 && tr.vavg > 25, 'traffic: faster (top ' + tr.vmax.toFixed(0) + ' km/h, average ' + tr.vavg.toFixed(0) + ' km/h)');
  ok(tr.overlap === 0, 'traffic: cars on the same loop never drive into each other (' + tr.overlap + ')');

  // ---- settings: slide steering + automatic gas exist and save
  await p.evaluate(() => document.getElementById('btnSettings').click()); await p.waitForTimeout(300);
  const segs = await p.evaluate(() => ({ ctl: [...document.querySelectorAll('#segCtl button')].map(b => b.textContent), gas: [...document.querySelectorAll('#segGas button')].map(b => b.textContent) }));
  ok(segs.ctl.includes('الأنالوج') && segs.gas.includes('أوتوماتيك'), 'settings: «الأنالوج» stick and automatic gas offered (' + segs.ctl.join('/') + ' · ' + segs.gas.join('/') + ')');
  await p.evaluate(() => { [...document.querySelectorAll('#segCtl button')].find(b => b.textContent === 'الأنالوج').click(); [...document.querySelectorAll('#segGas button')].find(b => b.textContent === 'أوتوماتيك').click(); });
  const sv = await p.evaluate(() => JSON.parse(localStorage.getItem('aps_ctl')));
  ok(sv && sv.mode === 'stick' && sv.auto === true, 'settings: choice saved (' + JSON.stringify(sv) + ')');
  await p.evaluate(() => { const s = document.getElementById('settings'); if (s) s.hidden = true; document.querySelectorAll('[id$=Close],[id^=sClose]').forEach(()=>{}); });

  // ---- crazy mode
  await p.evaluate(() => document.getElementById('menu').hidden = false);
  await p.evaluate(() => document.getElementById('btnCrazy').click()); await p.waitForTimeout(1500);
  let cs = await p.evaluate(() => ({ on: window.portSim.crazy.on, t: window.portSim.crazy.t, hud: !document.getElementById('crazyHud').hidden, time: document.getElementById('crazyTime').textContent }));
  ok(cs.on && cs.t > 80 && cs.hud, 'crazy: starts with the clock running and its HUD showing (' + cs.time + ')');
  const vis = await p.evaluate(() => { const s = document.getElementById('stick'); const r = s.getBoundingClientRect(); return { shown: getComputedStyle(s).display !== 'none', wheel: getComputedStyle(document.getElementById('joy')).display, r: [r.left, r.top, r.width, r.height] }; });
  ok(vis.shown && vis.wheel === 'none', 'analog stick: zone shown instead of the wheel');
  // slide: put a thumb down and drag right → steering right (joy negative)
  const r = vis.r; const cx = r[0] + r[2] * 0.4, cy = r[1] + r[3] * 0.6;
  await p.evaluate(([x, y]) => { const s = document.getElementById('stick'); const ev = (t, X) => s.dispatchEvent(new PointerEvent(t, { pointerId: 7, clientX: X, clientY: y, bubbles: true, pointerType: 'touch' })); ev('pointerdown', x); ev('pointermove', x + 40); }, [cx, cy]);
  const j1 = await p.evaluate(() => ({ joy: window.portSim.input.joy, wheel: window.portSim.input.wheel }));
  await p.evaluate(([x, y]) => { const s = document.getElementById('stick'); s.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' })); }, [cx, cy]);
  const j2 = await p.evaluate(() => window.portSim.input.joy);
  ok(j1.joy < -0.4 && j1.wheel === 1, 'analog stick: pushing right steers right (joy ' + j1.joy.toFixed(2) + ')');
  ok(j2 === 0, 'analog stick: letting go centres it');
  // auto gas: no pedal held, the vehicle still moves off
  await p.evaluate(() => window.portSim.teleport(-160, 7, -Math.PI / 2));
  await p.waitForFunction(() => window.portSim.car.v > 3, null, { timeout: 120000 }).catch(() => {});
  ok(await p.evaluate(() => window.portSim.car.v > 3), 'automatic gas: drives off without the gas pedal');
  // a drop-off adds seconds
  const t0 = await p.evaluate(() => window.portSim.crazy.t);
  await p.evaluate(() => window.portSim.crazyDrop({ budget: 60, t: 10 }, false));
  const t1 = await p.evaluate(() => ({ t: window.portSim.crazy.t, n: window.portSim.crazy.fares, pop: document.getElementById('crazyPop').textContent }));
  ok(t1.t - t0 > 10 && t1.n === 1, 'crazy: on-time drop-off adds seconds (+' + (t1.t - t0).toFixed(0) + ' s, «' + t1.pop + '»)');
  // time runs out → results card
  await p.evaluate(() => { window.portSim.crazy.t = 0.01; });
  await p.waitForFunction(() => !document.getElementById('crazyEnd').hidden, null, { timeout: 120000 }).catch(() => {});
  const end = await p.evaluate(() => ({ shown: !document.getElementById('crazyEnd').hidden, rank: document.getElementById('ceRank').textContent, best: document.getElementById('ceBest').textContent, saved: localStorage.getItem('aps_crazy_best') }));
  ok(end.shown && end.rank, 'crazy: results card when time runs out (' + end.rank + ' · ' + end.best + ')');
  ok(end.saved && JSON.parse(end.saved).fares === 1, 'crazy: best score saved (' + end.saved + ')');
  await p.evaluate(() => document.getElementById('ceAgain').click()); await p.waitForTimeout(500);
  cs = await p.evaluate(() => ({ on: window.portSim.crazy.on, t: window.portSim.crazy.t, f: window.portSim.crazy.fares, end: document.getElementById('crazyEnd').hidden }));
  ok(cs.on && cs.t > 80 && cs.f === 0 && cs.end, 'crazy: «العب تاني» restarts the clock');
  await p.evaluate(() => { window.portSim.crazy.t = 0.01; });
  await p.waitForFunction(() => !document.getElementById('crazyEnd').hidden, null, { timeout: 120000 }).catch(() => {});
  await p.evaluate(() => document.getElementById('ceMenu').click()); await p.waitForTimeout(400);
  cs = await p.evaluate(() => ({ on: window.portSim.crazy.on, menu: !document.getElementById('menu').hidden, hud: document.getElementById('crazyHud').hidden }));
  ok(!cs.on && cs.menu && cs.hud, 'crazy: «القائمة» goes back to the menu and turns the mode off');
  ok(errs.length === 0, 'page errors: ' + (errs.join(' | ') || 'none'));
  console.log(res.join('\n')); await b.close();
})();
