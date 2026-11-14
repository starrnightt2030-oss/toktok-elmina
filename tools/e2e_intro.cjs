// End-to-end check of the intro (film + realtime fallback) in headless Chromium.
// Usage: node tools/e2e_intro.cjs <base url of the beta build>
// Checks: the film is picked and preloaded during loading; nothing plays with sound before the tap; the film plays muted and
// the shots advance; tap skips to the menu with the cinematic transition; a broken / missing film falls back to the realtime intro.
const { chromium } = require('playwright');
const BASE = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });   // default autoplay policy (gesture needed for sound)
  const res = []; const ok = (cond, msg) => { res.push((cond ? 'PASS ' : 'FAIL ') + msg); };
  async function page(vp, route) {
    const c = await b.newContext({ viewport: vp, isMobile: vp.width < vp.height, hasTouch: true });
    if (route) await c.route('**/intro/intro.json', route);
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + 'version.json'); await p.evaluate(() => localStorage.clear());
    await p.goto(BASE + 'index.html');
    await p.waitForFunction(() => document.getElementById('loading').classList.contains("ready"), null, { timeout: 400000 });
    return { p, c, errs };
  }
  const tap = p => p.evaluate(() => document.getElementById('loading').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));

  // ---- 1) film path, phone landscape
  {
    const { p, c, errs } = await page({ width: 860, height: 412 });
    const pre = await p.evaluate(() => ({ f: window.portSim.film, v: (() => { const v = document.querySelector('#cine video.cfilm'); return v && { muted: v.muted, paused: v.paused, pre: v.preload, inline: v.playsInline }; })() }));
    ok(pre.v && pre.v.muted && pre.v.paused && pre.v.inline, 'film: preloaded during loading, muted, inline, not playing before the tap (' + JSON.stringify(pre.v) + ')');
    ok(pre.f.src && /intro-(480|720)\.mp4$/.test(pre.f.src), 'film: picked a size for the screen (' + pre.f.src + ')');
    const audioBefore = await p.evaluate(() => { const a = window.portSim.audio; return !a.ctx || a.ctx.state !== 'running'; });
    ok(audioBefore, 'no sound before the player taps (audio context not running)');
    await tap(p);
    await p.waitForFunction(() => window.portSim.film.on && window.portSim.film.t > .3, null, { timeout: 30000 }).catch(() => {});
    const st = await p.evaluate(() => ({ f: window.portSim.film, cls: document.getElementById('cine').className, shot: document.getElementById('cine').dataset.shot, logo: !!document.querySelector('#cine .clogo img[src*="logo-v2"]') }));
    ok(st.f.on && st.f.t > .3 && /film/.test(st.cls), 'film: plays after the tap (t=' + (st.f.t || 0).toFixed(2) + ', class=' + st.cls + ')');
    ok(st.logo, 'film: official logo (logo-v2) laid over the film');
    await p.evaluate(() => window.portSim.cineSeek(4.6)); await p.waitForTimeout(2200);
    ok(await p.evaluate(() => document.getElementById('cine').dataset.shot === 'hero'), 'film: shot clock follows the video (hero at 4.6 s)');
    const shot = await p.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + '/intro-film-land.png' : undefined });
    await p.evaluate(() => document.getElementById('cine').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await p.waitForTimeout(400);
    const m = await p.evaluate(() => ({ menu: !document.getElementById('menu').hidden, cine: document.body.classList.contains('menu-cine'), filmOn: window.portSim.film.on }));
    ok(m.menu && m.cine && !m.filmOn, 'skip: tap jumps to the main menu with the cinematic transition (' + JSON.stringify(m) + ')');
    await p.waitForTimeout(900);
    ok(await p.evaluate(() => !document.querySelector('#cine video.cfilm')), 'skip: the film is released after the intro (memory)');
    ok(errs.length === 0, 'film: no page errors (' + errs.join(' | ') + ')');
    await c.close();
  }
  // ---- 2) film plays to the end on its own (portrait)
  {
    const { p, c, errs } = await page({ width: 412, height: 860 });
    await tap(p);
    await p.waitForFunction(() => window.portSim.film.on, null, { timeout: 30000 }).catch(() => {});
    await p.evaluate(() => window.portSim.cineSeek(9.6));
    await p.waitForFunction(() => !document.getElementById('menu').hidden, null, { timeout: 30000 }).catch(() => {});
    ok(await p.evaluate(() => !document.getElementById('menu').hidden), 'film: ends by itself into the main menu (portrait)');
    ok(errs.length === 0, 'portrait: no page errors (' + errs.join(' | ') + ')');
    await c.close();
  }
  // ---- 3) fallback: intro.json missing → realtime intro
  {
    const { p, c, errs } = await page({ width: 860, height: 412 }, r => r.fulfill({ status: 404, body: '' }));
    ok(await p.evaluate(() => !document.querySelector('#cine video.cfilm')), 'fallback: no intro.json → no film element');
    await tap(p);
    await p.waitForFunction(() => window.portSim.cineShots && document.getElementById('cine').dataset.shot, null, { timeout: 30000 }).catch(() => {});
    const r = await p.evaluate(() => ({ film: window.portSim.film.on, shots: window.portSim.cineShots, cls: document.getElementById('cine').className }));
    ok(!r.film && r.shots && r.shots.length === 3 && !/film/.test(r.cls), 'fallback: realtime intro runs instead (' + JSON.stringify(r.shots && r.shots.map(s => s[0])) + ')');
    ok(errs.length === 0, 'fallback: no page errors (' + errs.join(' | ') + ')');
    await c.close();
  }
  // ---- 4) fallback: film file broken → realtime intro after the tap
  {
    const { p, c, errs } = await page({ width: 860, height: 412 }, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: true, duration: 10.6, shots: [{ id: 'harbor', dur: 3.8 }, { id: 'hero', dur: 4.2 }, { id: 'flash', dur: 2.6 }], sources: [{ height: 720, url: './intro/missing.mp4', type: 'video/mp4' }] }) }));
    await tap(p); await p.waitForTimeout(4500);
    const r = await p.evaluate(() => ({ film: window.portSim.film, shot: document.getElementById('cine').dataset.shot, hidden: document.getElementById('cine').hidden }));
    ok(!r.film.on && r.film.bad && !r.hidden && r.shot, 'fallback: broken film file → realtime intro (' + JSON.stringify(r) + ')');
    ok(errs.length === 0, 'broken film: no page errors (' + errs.join(' | ') + ')');
    await c.close();
  }
  console.log(res.join('\n'));
  await b.close();
  process.exit(res.some(r => r.startsWith('FAIL')) ? 1 : 0);
})();
