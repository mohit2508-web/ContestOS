import jwt from 'jsonwebtoken';
import WebSocket from 'ws';

const token = jwt.sign(
  { userId: 'fb90c789-5c94-4be3-92e0-97f7babfb469', email: 'admin@iitd.ac.in', role: 'org_admin', roleName: 'org_admin', hierarchyLevel: 2 },
  process.env.JS_SECRET,
  { expiresIn: '1d' }
);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const targets = await (await fetch('http://localhost:9222/json/list')).json();
const page = targets.find(t => t.type === 'page');
if (!page) { console.log('NO PAGE TARGET'); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = ++id;
  pending.set(mid, { resolve, reject });
  ws.send(JSON.stringify({ id: mid, method, params }));
});
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id).resolve(msg.result); pending.delete(msg.id); }
});
await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
await send('Page.enable');
await send('Runtime.enable');

const evalNow = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.value;
};

await send('Page.navigate', { url: 'http://localhost:5174/' });
await sleep(6000);
console.log('after first nav pathname:', await evalNow('window.location.pathname'));
console.log('setLocalStorage:', await evalNow(`
  (function(){
    try {
      localStorage.setItem('accessToken', ${JSON.stringify(token)});
      localStorage.setItem('user', ${JSON.stringify('{"id":"fb90c789-5c94-4be3-92e0-97f7babfb469","name":"Admin","email":"admin@iitd.ac.in","role":"org_admin"}')});
      return 'OK ' + localStorage.getItem('user');
    } catch(e) { return 'ERR ' + e.message; }
  })()
`));

await send('Page.navigate', { url: 'http://localhost:5174/playground/web-dev?problem=4fa5e72f-0fb9-4c1e-8c87-5c0381c458f1' });
await sleep(15000);

console.log('pathname now:', await evalNow('window.location.pathname'));
console.log('accessToken set:', await evalNow('!!localStorage.getItem("accessToken")'));
console.log('user set:', await evalNow('!!localStorage.getItem("user")'));
const text = (await evalNow('document.body.innerText') || '').toString();
console.log('--- first 400 chars of innerText ---');
console.log(text.slice(0, 400));
console.log('has Run Preview:', text.includes('Run Preview'));
console.log('has Submit:', text.includes('Submit'));
console.log('has "Build an Interactive Counter":', text.includes('Build an Interactive Counter'));
process.exit(0);
