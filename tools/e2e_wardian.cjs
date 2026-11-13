// Wardian district checks (Phase 3) in headless Chromium against a main build.
// Usage: node tools/e2e_wardian.cjs <base url>   (e.g. http://localhost:8773/toktok-elmina/)
const { chromium } = require('playwright');
const BASE = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const c = await b.newContext({ viewport: { width: +(process.env.VW || 480), height: +(process.env.VH || 240) }, isMobile: true, hasTouch: true });   // small viewport: the software renderer runs faster, the logic is the same
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const res = []; const ok = (cond, msg) => { res.push((cond ? 'PASS ' : 'FAIL ') + msg); console.log((cond ? 'PASS ' : 'FAIL ') + msg); };
  const ready = () => p.waitForFunction(() => window.portSim && window.portSim.car, null, { timeout: 150000 });
  await p.goto(BASE + 'version.json'); await p.evaluate(() => localStorage.clear());
  await p.goto(BASE + 'index.html'); await ready();
  await p.evaluate(() => { document.getElementById('loading').style.display = 'none'; document.getElementById('btnStart').click(); });
  await p.waitForTimeout(1000);
  // ---- layout: every street point is free of colliders, the district is in the road graph
  const lay = await p.evaluate(() => { const s = window.portSim, C = s.colliders; const pts = [];
    for (let z = 5; z <= 200; z += 2.5) pts.push([-375, z]); for (let z = 5; z <= 118; z += 2.5) pts.push([-440, z]); for (let x = -440; x <= -250; x += 2.5) pts.push([x, 120]); for (let x = -445; x <= -300; x += 2.5) pts.push([x, 3]);
    const hit = pts.filter(([x, z]) => C.some(b => b.h > .05 && x > b.x0 - 1 && x < b.x1 + 1 && z > b.z0 - 1 && z < b.z1 + 1) && !(Math.hypot(x + 375, z - 195) < 3.5));
    const r1 = s.route(-160, 7, -375, 199), r2 = s.route(-250, 200, -375, 199);
    return { n: pts.length, hit: hit.slice(0, 5), r1: Math.round(r1.len), r2: Math.round(r2.len), r2pts: r2.pts.map(q => q.join(',')).join(' ') }; });
  ok(lay.hit.length === 0, 'layout: ' + lay.n + ' street points free of walls/objects' + (lay.hit.length ? ' — blocked at ' + JSON.stringify(lay.hit) : ''));
  ok(lay.r1 > 0 && lay.r1 < 600 && lay.r2 > 0 && lay.r2 < 500 && /-250,120/.test(lay.r2pts), 'roads: GPS reaches the square from the port avenue (' + lay.r1 + ' m) and from the city through the cross street (' + lay.r2 + ' m)');
  // ---- drive: real physics with the throttle, steering toward a target
  const drive = (tx, tz, maxS) => p.evaluate(async ([tx, tz, maxS]) => { const s = window.portSim, t0 = performance.now(); let maxY = 0;
    while (performance.now() - t0 < maxS * 1000) { const d = Math.hypot(tx - s.car.x, tz - s.car.z); maxY = Math.max(maxY, s.car.y); if (d < 4) break;
      const want = Math.atan2(-(tx - s.car.x), -(tz - s.car.z)); let e = want - s.car.h; while (e > Math.PI) e -= 2 * Math.PI; while (e < -Math.PI) e += 2 * Math.PI;
      s.input.joy = Math.max(-1, Math.min(1, e * 2)); s.input.up = Math.abs(s.car.v) < 7 ? 1 : 0; await new Promise(r => setTimeout(r, 80)); }
    s.input.up = 0; s.input.joy = 0; return { x: Math.round(s.car.x), z: Math.round(s.car.z), d: Math.round(Math.hypot(tx - s.car.x, tz - s.car.z)), maxY: +maxY.toFixed(2) }; }, [tx, tz, maxS]);
  await p.evaluate(() => window.portSim.teleport(-360, 3.5, Math.PI / 2)); await p.waitForTimeout(800);
  const d1 = await drive(-376, 30, +(process.env.SLOW || 1) * 150);
  ok(d1.d < 6 && d1.maxY < .6, 'drive in: from the avenue into the main street (ended ' + d1.d + ' m from target, max height ' + d1.maxY + ')');
  await p.evaluate(() => window.portSim.teleport(-306, 122, -Math.PI / 2)); await p.waitForTimeout(800);
  const d2 = await drive(-252, 121, +(process.env.SLOW || 1) * 240);
  ok(d2.d < 6, 'drive out: cross street joins the city street, no invisible wall (reached x ' + d2.x + ')');
  // ---- collisions: buildings and the west edge stop the tuk
  const ram = (x, z, h, sec) => p.evaluate(async ([x, z, h, sec]) => { const s = window.portSim; s.teleport(x, z, h); s.input.up = 1; await new Promise(r => setTimeout(r, sec * 1000)); s.input.up = 0; return { x: s.car.x, z: s.car.z, y: s.car.y }; }, [x, z, h, sec]);
  const c1 = await ram(-376, 36, Math.PI / 2, 25);   // away from the سوق الورديان stop so no rider boards here
  ok(c1.x > -384.6 && c1.y < .6, 'collision: shop fronts stop the tuk (x ' + c1.x.toFixed(1) + ', building face at -384.2)');
  const c2 = await ram(-440, 60, Math.PI / 2, 25);
  ok(c2.x > -451 && c2.y < .6, 'world edge: cannot leave the map on the west (x ' + c2.x.toFixed(1) + ')');
  // ---- mission «مشوار الورديان»
  await p.evaluate(() => window.portSim.teleport(-160, 7, -Math.PI / 2));
  await p.waitForFunction(() => window.portSim.waiting.some(w => w.mission), null, { timeout: +(process.env.SLOW || 1) * 120000 }).catch(() => {});
  const mw = await p.evaluate(() => { const w = window.portSim.waiting.find(w => w.mission); return w ? { poi: w.poi, name: w.name } : null; });
  ok(mw && mw.poi === 'fish', 'mission: rider waits at the fish market in the existing world (' + (mw && mw.name) + ')');
  await p.evaluate(() => { const s = window.portSim, P = s.POI.fish; s.teleport(P.x + 1, P.z + .5, -Math.PI / 2); });
  await p.waitForFunction(() => window.portSim.fare && window.portSim.fare.mission, null, { timeout: +(process.env.SLOW || 1) * 90000 }).catch(() => {});
  const mf = await p.evaluate(() => { const f = window.portSim.fare; return f ? { to: f.to, mission: f.mission, price: f.price } : null; });
  ok(mf && mf.to === 'wplaza', 'mission: she boards and asks for ساحة الورديان (price ' + (mf && mf.price) + ')');
  await p.waitForFunction(() => /الورديان/.test(document.getElementById('navName').textContent), null, { timeout: 60000 }).catch(() => {});
  ok(await p.evaluate(() => /الورديان/.test(document.getElementById('navName').textContent)), 'mission: navigation points to the new street (' + await p.evaluate(() => document.getElementById('navName').textContent) + ')');
  await p.waitForFunction(() => window.portSim.fare && window.portSim.fare.phase === 'ride', null, { timeout: +(process.env.SLOW || 1) * 240000 }).catch(() => {});
  const w0 = await p.evaluate(() => window.portSim.save.wallet);
  await p.evaluate(() => { const s = window.portSim, P = s.POI.wplaza; s.teleport(P.x + 1.5, P.z - .5, Math.PI); });
  await p.waitForFunction(() => !document.getElementById('pay').hidden, null, { timeout: +(process.env.SLOW || 1) * 120000 }).catch(() => {});
  const f = await p.evaluate(() => ({ open: !document.getElementById('pay').hidden, price: window.portSim.fare && window.portSim.fare.price, change: window.portSim.fare && window.portSim.fare.change }));
  ok(f.open, 'mission: arriving at the square opens the fare + change panel');
  await p.evaluate(ch => { const A = '٠١٢٣٤٥٦٧٨٩', ar = n => String(n).replace(/[0-9]/g, d => A[d]); let r = ch; for (const v of [50, 20, 10, 5, 1]) while (r >= v) { [...document.querySelectorAll('#pNotes .note')].find(x => x.textContent.replace('جنيه', '').trim() === ar(v)).click(); r -= v; } document.getElementById('pOk').click(); }, f.change || 0);
  await p.waitForFunction(() => !window.portSim.fare, null, { timeout: 30000 }).catch(() => {});
  const sv = await p.evaluate(() => JSON.parse(localStorage.getItem('aps_tuk_v2')));
  ok(sv && sv.missions && sv.missions.wardian === 1 && sv.wallet >= w0 + f.price + 20 && sv.saveVersion === 1, 'mission: done, paid fare ' + f.price + ' + bonus 20 (wallet ' + w0 + ' → ' + (sv && sv.wallet) + '), saved with saveVersion 1');
  await p.reload(); await ready();
  await p.evaluate(() => { document.getElementById('loading').style.display = 'none'; document.getElementById('btnStart').click(); }); await p.waitForTimeout(12000);
  ok(await p.evaluate(() => window.portSim.save.missions && window.portSim.save.missions.wardian === 1 && !window.portSim.waiting.some(w => w.mission)), 'save: mission stays done after a reload and is not offered again');
  console.log('page errors:', errs.length ? errs : 'none'); await b.close();
  process.exit(res.some(r => r.startsWith('FAIL')) ? 1 : 0);
})();
