// Screenshot of a passenger reaction (bubble + emoji over the head) after drop-off, for a visual check.
// Usage: node tools/shot_reaction.cjs <base url> <out.png> [mood]
const { chromium } = require('playwright');
(async () => {
  const [BASE, OUT, MOOD] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 860, height: 412 }, deviceScaleFactor: 2 })).newPage();
  await p.goto(BASE + 'version.json'); await p.evaluate(() => localStorage.clear());
  await p.goto(BASE + 'index.html'); await p.waitForFunction(() => window.portSim && window.portSim.car, null, { timeout: 400000 });
  await p.evaluate(() => { document.getElementById('loading').style.display = 'none'; document.getElementById('btnStart').click(); });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const s = window.portSim; const w = s.waiting[0]; const P = s.POI[w.poi]; s.teleport(P.x + 1, P.z + 1); });
  await p.waitForFunction(() => !document.getElementById('pay').hidden, null, { timeout: 120000 });
  await p.evaluate(() => { const A = '٠١٢٣٤٥٦٧٨٩', ar = n => String(n).replace(/[0-9]/g, d => A[d]); const s = window.portSim, b = s.boarding; let r = b.change; for (const v of [50, 20, 10, 5, 1]) while (r >= v) { [...document.querySelectorAll('#pNotes .note')].find(x => x.textContent.replace('جنيه', '').trim() === ar(v)).click(); r -= v; } });
  await p.waitForFunction(() => document.getElementById('pay').hidden && window.portSim.riders.length === 1, null, { timeout: 60000 });
  if (MOOD === 'kick') await p.evaluate(() => { window.portSim.riders[0].hits = 4; });
  await p.evaluate(() => { const s = window.portSim, P = s.POI[s.riders[0].to]; s.teleport(P.x, P.z); });
  await p.waitForFunction(() => window.portSim.leavers.length > 0, null, { timeout: 90000 });
  await p.waitForTimeout(700);
  // side-on camera close to the person who got out
  await p.evaluate(() => { const L = window.portSim.leavers[0], m = L.m.position, c = window.portSim.cam; window.portSim.shot(true); c.position.set(m.x + 4.2, 2.4, m.z + 4.2); c.lookAt(m.x, 1.6, m.z); });
  await p.waitForTimeout(1200);
  console.log(await p.evaluate(() => window.portSim.leavers.map(L => L.mood).join(',')));
  await p.screenshot({ path: OUT }); await b.close();
})();
