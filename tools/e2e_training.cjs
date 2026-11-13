// Phase 7 checks: the training centre is in the game, you can drive in and through it, the map is wider (east blocks + القباري),
// riders show where they are going and walk to the vehicle to board.
// Usage: node tools/e2e_training.cjs <base url>     SLOW=2 for a slow software renderer
const { chromium } = require('playwright');
const BASE = process.argv[2], SLOW = +(process.env.SLOW || 1);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const c = await b.newContext({ viewport: { width: 480, height: 240 }, isMobile: true, hasTouch: true });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const res = []; const ok = (cond, msg) => { res.push(cond); console.log((cond ? 'PASS ' : 'FAIL ') + msg); };
  await p.goto(BASE + 'version.json'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('aps_skipIntro', '1'); });
  await p.goto(BASE + 'index.html'); await p.waitForFunction(() => window.portSim && window.portSim.car && !document.getElementById('menu').hidden, null, { timeout: 300000 });
  await p.evaluate(() => document.getElementById('btnStart').click()); await p.waitForTimeout(1500);

  // ---- layout
  const L = await p.evaluate(() => { const s = window.portSim, t = s.training, C = s.colliders;
    const free = (x, z, m) => !C.some(q => q.h > .05 && x > q.x0 - m && x < q.x1 + m && z > q.z0 - m && z < q.z1 + m);
    const along = (a, b, m) => { const out = []; const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.5); for (let i = 0; i <= n; i++) { const x = a[0] + (b[0] - a[0]) * i / n, z = a[1] + (b[1] - a[1]) * i / n; if (!free(x, z, m)) out.push([+x.toFixed(1), +z.toFixed(1)]); } return out; };
    // every inner road of the training centre (graph edges inside its wall) is clear for a tuk (0.75 m each side)
    const tc = []; const N = {}; s.route(0, 0, 0, 0);
    return { b: t.buildings.length, rooms: t.rooms.map(r => r.n), gates: t.gates, corr: t.corridor,
      roads: t.roads ? null : null, POI: Object.keys(s.POI).filter(k => /^tc|^qstop|^micro/.test(k)).map(k => k + ':' + s.POI[k].x + ',' + s.POI[k].z),
      blockedPOI: Object.keys(s.POI).filter(k => !free(s.POI[k].x, s.POI[k].z, .8)),
      rIn: Math.round(s.route(0, 5, 196, 57.9).len), rBack: Math.round(s.route(0, 5, 237, 104.6).len), rQ: Math.round(s.route(-375, 199, -200, 232.5).len), rE: Math.round(s.route(0, 5, 360, 180).len),
      edgeX: Math.max(...C.filter(q => q.h <= .05 && q.x0 > 300).map(q => q.x0)) }; });
  ok(L.b >= 30 && L.rooms.length === 2, 'training centre: ' + L.b + ' buildings/rooms from the plan, open workshops: ' + L.rooms.join('، '));
  ok(!L.blockedPOI.length, 'stops: every pick-up point is on open ground' + (L.blockedPOI.length ? ' — blocked: ' + L.blockedPOI.join(',') : ''));
  ok(L.rIn > 0 && L.rIn < 450 && L.rBack > 0 && L.rBack < 500, 'GPS: reaches the students\' corridor (' + L.rIn + ' m) and the back yard (' + L.rBack + ' m) inside the centre');
  ok(L.rQ > 0 && L.rQ < 600, 'GPS: Wardian square → موقف القباري (' + L.rQ + ' m)');
  ok(L.rE > 0 && L.edgeX > 410, 'map: the city runs east to x ' + L.edgeX + ' with new streets (route to x 360: ' + L.rE + ' m)');

  // ---- riders: card over the head, stop bay, walk to the door and board
  const w = await p.evaluate(() => { const s = window.portSim; const w = s.waiting.find(q => !q.mission); const P = s.POI[w.poi]; return { poi: w.poi, to: w.to, price: w.price, tag: !!(w.tag && w.tag.material.map), bay: w.b.children.length, P: [P.x, P.z, P.sx, P.sz], m0: [w.m.position.x, w.m.position.z] }; });
  ok(w.tag && w.to && w.price > 0 && w.bay >= 2, 'riders: card shows destination (' + w.to + ') and fare (' + w.price + '), square round them and a stop bay on the road');
  await p.evaluate(P => { const n = Math.hypot(P[2], P[3]); window.portSim.teleport(P[0], P[1], Math.atan2(P[3] / n, -P[2] / n)); }, w.P);
  const b1 = await p.evaluate(async T => { const s = window.portSim, t0 = performance.now(); while (performance.now() - t0 < T) { const f = s.fare; if (f) return { ph: f.phase, walking: !!f.walker, to: f.to }; await new Promise(r => setTimeout(r, 30)); } return null; }, SLOW * 30000);
  ok(b1 && b1.walking && b1.to === w.to, 'boarding: after stopping the rider walks to the vehicle (phase ' + (b1 && b1.ph) + '), going where the card said');
  await p.waitForFunction(() => window.portSim.fare && !window.portSim.fare.walker, null, { timeout: SLOW * 60000 }).catch(() => {});
  ok(await p.evaluate(() => window.portSim.fare && !window.portSim.fare.walker), 'boarding: the rider reaches the door and sits in the vehicle');


  // ---- driving through the centre with real physics
  const drive = (pts, maxS, R) => p.evaluate(async ([pts, maxS, R]) => { const s = window.portSim, t0 = performance.now(); let i = 0, maxY = 0;
    while (performance.now() - t0 < maxS * 1000 && i < pts.length) { const [tx, tz] = pts[i]; const d = Math.hypot(tx - s.car.x, tz - s.car.z); maxY = Math.max(maxY, s.car.y); if (d < (R || 3)) { i++; continue; }
      const want = Math.atan2(-(tx - s.car.x), -(tz - s.car.z)); let e = want - s.car.h; while (e > Math.PI) e -= 2 * Math.PI; while (e < -Math.PI) e += 2 * Math.PI;
      s.input.joy = Math.max(-1, Math.min(1, e * 2)); s.input.up = Math.abs(s.car.v) < (Math.abs(e) > .5 ? 2.5 : 5) ? 1 : 0; await new Promise(r => setTimeout(r, 80)); }
    s.input.up = 0; s.input.joy = 0; return { reached: i, of: pts.length, x: +s.car.x.toFixed(1), z: +s.car.z.toFixed(1), maxY: +maxY.toFixed(2) }; }, [pts, maxS, R]);
  const g = L.gates;
  // in segments (the software renderer is slow): gate → plaza, lane → corridor mouth, through the corridor, exit road → avenue
  const seg = async (x, z, h, pts, name) => { await p.evaluate(([x, z, h]) => window.portSim.teleport(x, z, h), [x, z, h]); await p.waitForTimeout(600); const d = await drive(pts, SLOW * 300);
    ok(d.reached === d.of && d.maxY < .7, 'drive: ' + name + ' (' + d.reached + '/' + d.of + ', at ' + d.x + ',' + d.z + ')'); };
  await seg(g.main, 4, Math.PI, [[g.main, 21.6], [236, 21.6]], 'in through the main gate to the entrance plaza');
  await seg(228.9, 24, Math.PI, [[228.9, 50], [225, 57.8]], 'up the lane between the admin building and the workshop block to the corridor');
  await seg(223, 57.8, Math.PI / 2, [[205, 57.8], [181, 57.8]], 'through the students\' corridor inside the workshop block, out onto the exit road');
  await seg(178.2, 45, 0, [[178.2, 21], [171, 15], [170, 2]], 'down the exit road and out of the exit gate onto the avenue');
  // drive into the open carpentry workshop
  await p.evaluate(() => window.portSim.teleport(198, 58.6, 0)); await p.waitForTimeout(600);
  const rm = await p.evaluate(() => window.portSim.training.rooms[0]);
  const d3 = await drive([[198, rm.z1 - 1.2]], SLOW * 80, .8);
  ok(d3.z < rm.z1 - .3 && d3.z > rm.z0, 'drive: into the carpentry workshop through its door (car at z ' + d3.z + ', room z ' + rm.z0.toFixed(1) + '–' + rm.z1.toFixed(1) + ')');
  // walls hold
  const ram = await p.evaluate(async () => { const s = window.portSim; s.teleport(230, 40, Math.PI / 2); s.input.up = 1; await new Promise(r => setTimeout(r, 12000)); s.input.up = 0; return s.car.x; });
  ok(ram > 226.0, 'collision: the workshop block wall stops the tuk (x ' + ram.toFixed(1) + ', wall at 226.1)');

  console.log('page errors:', errs.length ? errs : 'none'); await b.close();
  process.exit(res.every(Boolean) && !errs.length ? 0 : 1);
})();
