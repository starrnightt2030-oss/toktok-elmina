const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [w, h, n] of [[860, 412, 'land'], [412, 860, 'port']]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })).newPage();
    await p.goto(process.argv[2] + 'index.html'); await p.waitForFunction(() => window.portSim && window.portSim.car, null, { timeout: 400000 });
    await p.evaluate(() => { localStorage.setItem('aps_skipIntro', '1'); }); await p.reload(); await p.waitForFunction(() => window.portSim && window.portSim.car, null, { timeout: 400000 });
    await p.waitForFunction(() => !document.getElementById('menu').hidden, null, { timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(1500); await p.screenshot({ path: '/tmp/claude-0/-home-claude/ccfabe56-284b-5f9b-bd2c-039c81896ceb/scratchpad/shots/menu-' + n + '.png' });
    console.log(n, await p.evaluate(() => { const e = document.querySelector('.devCredit'); const r = e.getBoundingClientRect(); return [e.textContent, Math.round(r.bottom), innerHeight]; }));
  } await b.close(); })();
