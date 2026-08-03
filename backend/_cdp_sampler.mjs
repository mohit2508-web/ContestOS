import jwt from 'jsonwebtoken';
import WebSocket from 'ws';

const token = jwt.sign(
  { userId: 'fb90c789-5c94-4be3-92e0-97f7babfb469', email: 'admin@iitd.ac.in', role: 'org_admin', roleName: 'org_admin', hierarchyLevel: 2 },
  process.env.JS_SECRET,
  { expiresIn: '1d' }
);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const withTimeout = (p, ms, what) => Promise.race([p, sleep(ms).then(() => { throw new Error('TIMEOUT: ' + what); })]);

const targets = await withTimeout(fetch('http://localhost:9222/json/list'), 8000, 'json/list');
const list = await targets.json();
const pages = list.filter(t => t.type === 'page');
console.log('page targets:', pages.length);
const page = pages[pages.length - 1];

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const consoleLogs = [];
let loadResolvers = [];
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = ++id;
  pending.set(mid, { resolve, reject });
  ws.send(JSON.stringify({ id: mid, method, params }));
});
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id).resolve(msg.result); pending.delete(msg.id); }
  if (msg.method === 'Page.loadEventFired') { loadResolvers.forEach(r => r()); loadResolvers = []; }
  if (msg.method === 'Runtime.consoleAPICalled') {
    const args = msg.params.args.map(a => a.value ?? a.description ?? '').join(' ');
    consoleLogs.push(`[${msg.params.type}] ${args}`);
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    consoleLogs.push('[EXCEPTION] ' + (d.exception?.description || d.text || ''));
  }
});
await withTimeout(new Promise((r, j) => { ws.on('open', r); ws.on('error', j); }), 8000, 'ws open');
await send('Page.enable');
await send('Runtime.enable');

const evalNow = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) return 'EXC: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result?.value;
};
const navigate = async (url) => {
  const loaded = new Promise(r => loadResolvers.push(r));
  await send('Page.navigate', { url });
  await withTimeout(loaded, 15000, 'load event');
};

await navigate('http://localhost:5174/');
await sleep(3000);
await evalNow(`
  (function(){
    try {
      localStorage.setItem('accessToken', ${JSON.stringify(token)});
      localStorage.setItem('user', ${JSON.stringify('{"id":"fb90c789-5c94-4be3-92e0-97f7babfb469","name":"Admin","email":"admin@iitd.ac.in","role":"org_admin"}')});
      localStorage.setItem('web_playground_playMode', 'problem');
      localStorage.setItem('web_playground_selected_problem', '4fa5e72f-0fb9-4c1e-8c87-5c0381c458f1');
      localStorage.setItem('web_playground_4fa5e72f-0fb9-4c1e-8c87-5c0381c458f1_web', '{"htmlCode":"<div id=\\"count\\">0</div>","cssCode":"","jsCode":""}');
      return 'localStorage seeded';
    } catch (e) { return 'ERR ' + e.message; }
  })()
`);

await navigate('http://localhost:5174/playground/web-dev?problem=4fa5e72f-0fb9-4c1e-8c87-5c0381c458f1');

for (let i = 0; i < 12; i++) {
  await sleep(1000);
  const info = await evalNow(`(function(){
    var btns = Array.prototype.slice.call(document.querySelectorAll('button')).filter(b => b.textContent.trim() === 'Run Preview' || b.textContent.trim() === 'Submit' || b.textContent.trim() === 'Reset');
    var out = btns.map(function(b){
      var r = b.getBoundingClientRect();
      var cs = getComputedStyle(b);
      return b.textContent.trim() + ' {x:' + Math.round(r.x) + ' y:' + Math.round(r.y) + ' w:' + Math.round(r.width) + ' h:' + Math.round(r.height) + ' disp:' + cs.display + ' vis:' + cs.visibility + ' op:' + cs.opacity + '}';
    });
    return 'path=' + location.pathname + ' body=' + document.body.innerText.length + ' btns=[' + out.join(' ') + ']';
  })()`);
  console.log('t=' + (i + 1) + 's ' + info);
}

console.log('--- console errors/exceptions ---');
for (const l of consoleLogs.filter(x => x.startsWith('[error]') || x.startsWith('[EXCEPTION]')).slice(0, 20)) console.log(l);
process.exit(0);
