// Talks to the app's WebView over the DevTools protocol (adb-forwarded to localhost:9222) and reports what the page is doing.
import WebSocket from 'ws';
const list = await (await fetch('http://localhost:9222/json')).json();
const page = list.find(p => p.type === 'page') || list[0];
console.log('page:', page && page.url);
const ws = new WebSocket(page.webSocketDebuggerUrl); let id = 0; const wait = {};
ws.on('message', m => { const d = JSON.parse(m); if (d.id && wait[d.id]) { wait[d.id](d); delete wait[d.id]; } });
await new Promise(r => ws.on('open', r));
const ev = (expr, timeout = 60000) => new Promise(res => { const i = ++id; const t = setTimeout(() => res('TIMEOUT ' + timeout + 'ms'), timeout);
  wait[i] = d => { clearTimeout(t); res(d.result && d.result.result ? d.result.result.value : JSON.stringify(d).slice(0, 300)); };
  ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } })); });
const t0 = Date.now(); console.log('main thread answers:', await ev('1+1'), 'in', Date.now() - t0, 'ms');
console.log('state:', await ev(`JSON.stringify({ld:document.getElementById('loading').className,cine:!document.getElementById('cine').hidden,menu:!document.getElementById('menu').hidden,ua:navigator.userAgent.slice(-40),gl:(()=>{try{const g=document.createElement('canvas').getContext('webgl');const e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):'?';}catch(x){return 'err '+x}})()})`));
console.log('frame time:', await ev(`new Promise(r=>{const t=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>r(Math.round(performance.now()-t)+' ms for 2 frames')))})`, 120000));
console.log('tap via pointer event:', await ev(`(document.getElementById('loading').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})),'sent')`));
await new Promise(r => setTimeout(r, 8000));
console.log('after tap:', await ev(`JSON.stringify({ld:document.getElementById('loading').className,cine:!document.getElementById('cine').hidden,menu:!document.getElementById('menu').hidden})`));
process.exit(0);
