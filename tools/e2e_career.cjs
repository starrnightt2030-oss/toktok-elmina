// Phase 6 career checks: missions list, reputation, garage customisations (preview, buy once, saved after reload).
// Usage: node tools/e2e_career.cjs <base url>
const { chromium } = require('playwright');
const BASE = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const c = await b.newContext({ viewport: { width: 480, height: 260 }, isMobile: true, hasTouch: true });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const res = []; const ok = (cond, msg) => { res.push(cond); console.log((cond ? 'PASS ' : 'FAIL ') + msg); };
  const ready = () => p.waitForFunction(() => window.portSim && window.portSim.car && !document.getElementById('menu').hidden, null, { timeout: 200000 });
  await p.goto(BASE + 'version.json');
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('aps_skipIntro', '1');
    localStorage.setItem('aps_tuk_v2', JSON.stringify({ saveVersion: 1, wallet: 400, total: 400, trips: 5, owned: ['yellow', 'orange', 'red'], paint: 'red', slogan: 'ماشي بدعا الوالدين', vehicle: 'tuk', rep: { xp: 70 }, missions: { wardian: 1 } })); });
  await p.goto(BASE + 'index.html'); await ready();
  // missions list
  await p.evaluate(() => document.getElementById('btnMissions').click());
  const ms = await p.evaluate(() => [...document.querySelectorAll('#msList .msn')].map(e => e.querySelector('b').textContent + ':' + e.querySelector('.pill').textContent));
  ok(ms.length === 8 && /مشوار الورديان:خلصت/.test(ms.join()) && /مشوار القباري:متاحة/.test(ms.join()) && /مشوار مستعجل:تتفتح/.test(ms.join()), 'missions: 8 listed with real state (' + ms.join(' | ') + ')');
  await p.evaluate(() => document.getElementById('msClose').click());
  // reputation
  await p.evaluate(() => document.getElementById('btnProgress').click());
  const rp = await p.evaluate(() => [document.getElementById('pgRepName').textContent, document.getElementById('pgRepNext').textContent, document.getElementById('pgRepBar').style.width]);
  ok(/اسطى/.test(rp[0]) && /اسطى شاطر/.test(rp[1]) && parseInt(rp[2]) > 0, 'reputation: level, next level and bar shown (' + rp.join(' · ') + ')');
  await p.evaluate(() => document.getElementById('pgClose').click());
  // garage: preview, then buy chrome rims once
  await p.evaluate(() => document.getElementById('btnGarage').click()); await p.waitForTimeout(800);
  const rimBefore = await p.evaluate(() => { let c = null; window.portSim.scene.traverse(o => { if (o.isMesh && !c) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m && m.name === 'Rim') c = m.color.getHexString(); }); }); return c; });
  const clickOpt = (item, name) => p.evaluate(([item, name]) => { const mod = [...document.querySelectorAll('#mods .mod')].find(m => m.querySelector('h3').textContent.includes(item)); [...mod.querySelectorAll('.mopt')].find(b => b.textContent.includes(name)).click(); }, [item, name]);
  await clickOpt('الجنوط', 'كروم');
  const prev = await p.evaluate(() => ({ wallet: JSON.parse(localStorage.getItem('aps_tuk_v2')).wallet, buy: !!document.querySelector('#mods .mbuy:not([hidden]) .primary') }));
  const rimPrev = await p.evaluate(() => { let c = null; window.portSim.scene.traverse(o => { if (o.isMesh && !c) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m && m.name === 'Rim') c = m.color.getHexString(); }); }); return c; });
  ok(prev.buy && prev.wallet === 400 && rimPrev !== rimBefore, 'garage: tapping an option previews it on the tuk without charging (' + rimBefore + ' → ' + rimPrev + ')');
  await p.evaluate(() => document.querySelector('#mods .mbuy:not([hidden]) .primary').click());
  await p.evaluate(() => { for (let i = 0; i < 5; i++) { const mod = [...document.querySelectorAll('#mods .mod')].find(m => m.querySelector('h3').textContent.includes('الجنوط')); [...mod.querySelectorAll('.mopt')].find(b => b.textContent.includes('كروم')).click(); } });
  const s1 = await p.evaluate(() => JSON.parse(localStorage.getItem('aps_tuk_v2')));
  ok(s1.wallet === 280 && s1.mods.rims === 'chrome' && s1.modsOwned.includes('rims:chrome') && s1.saveVersion === 1, 'garage: bought once for 120 (wallet ' + s1.wallet + '), fitted and saved; tapping again charges nothing');
  // a locked-level item cannot be bought, previews are cancelled when leaving
  await clickOpt('الفرش', 'نمر');
  await p.evaluate(() => document.getElementById('garClose').click()); await p.waitForTimeout(300);
  const s2 = await p.evaluate(() => JSON.parse(localStorage.getItem('aps_tuk_v2')));
  ok(s2.wallet === 280 && !(s2.mods.seats), 'garage: leaving the garage drops an unbought preview (wallet ' + s2.wallet + ')');
  // reload keeps it
  await p.reload(); await ready();
  const after = await p.evaluate(() => { let c = null; window.portSim.scene.traverse(o => { if (o.isMesh && !c) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m && m.name === 'Rim') c = m.color.getHexString(); }); }); return { c, mods: window.portSim.save.mods }; });
  ok(after.mods.rims === 'chrome' && after.c === rimPrev, 'save: chrome rims still fitted after a reload');
  console.log('page errors:', errs.length ? errs : 'none'); await b.close();
  process.exit(res.every(Boolean) && !errs.length ? 0 : 1);
})();
