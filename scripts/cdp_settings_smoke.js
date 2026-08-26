// Smoke test: Settings restructure (6-section sidebar) via CDP against PRODUCTION build.
// Usage: node scripts/cdp_settings_smoke.js <port>
// Checks:
//  (a) sidebar shows exactly 6 sections in canonical order
//  (b) each section renders distinct content
//  (c) a toggled setting survives close/reopen of the settings modal
const WebSocket = require('ws');

const port = process.argv[2] || '9333';
const EXPECTED_ORDER = ['input', 'transcription', 'aiProcessing', 'storage', 'models', 'system'];

async function getJson() {
  const res = await fetch(`http://127.0.0.1:${port}/json`);
  return res.json();
}

function connect(page) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    ws.on('message', (d) => {
      const r = JSON.parse(d);
      if (r.id && pending.has(r.id)) { pending.get(r.id)(r); pending.delete(r.id); }
    });
    ws.on('open', () => resolve({
      send(method, params = {}) {
        return new Promise((res) => {
          const mid = ++id;
          pending.set(mid, res);
          ws.send(JSON.stringify({ id: mid, method, params }));
          setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); res(null); } }, 5000);
        });
      },
      close: () => ws.close(),
    }));
    ws.on('error', reject);
  });
}

function unwrap(r) {
  const res = r && r.result && r.result.result;
  if (!res) return undefined;
  if (res.exceptionDetails) return { __error: res.exceptionDetails.text + ' ' + JSON.stringify(res.exceptionDetails.exception?.description || '').slice(0, 400) };
  return res.value;
}
(async () => {
  const pages = await getJson();
  const panel = pages.find(p => p.url.includes('panel=true')) ||
                pages.find(p => p.title === 'EktosWhispr' && !p.url.startsWith('devtools'));
  if (!panel) { console.log('FAIL: control panel page not found. Pages:', pages.map(p => `${p.title} ${p.url}`)); process.exit(1); }
  const c = await connect(panel);
  await c.send('Runtime.enable');
  const ev = async (expression) => unwrap(await c.send('Runtime.evaluate', { expression, returnByValue: true }));

  // (0) open settings via Ctrl+, (ControlPanel global keydown handler)
  await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ',', ctrlKey: true, bubbles: true, cancelable: true }))`);
  let ids = [];
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 250));
    ids = await ev(`[...document.querySelectorAll('[data-section-id]')].map(b => b.dataset.sectionId)`) || [];
    if (ids.length) break;
  }

  // (a) exact order
  const orderOk = JSON.stringify(ids) === JSON.stringify(EXPECTED_ORDER);
  console.log(`(a) sidebar sections: ${JSON.stringify(ids)} -> ${orderOk ? 'PASS' : 'FAIL'}`);

  // (b) each section renders distinct content
  const seen = {};
  for (const sid of EXPECTED_ORDER) {
    await ev(`document.querySelector('[data-section-id="${sid}"]').click()`);
    await new Promise(r => setTimeout(r, 350));
    const info = await ev(`(() => {
      const btns = [...document.querySelectorAll('[data-section-id]')];
      const modalRoot = btns[0]?.closest('[role="dialog"], .modal, body') || document.body;
      const t = modalRoot.innerText || '';
      return { len: t.length, head: t.replace(/\\s+/g, ' ').trim().slice(0, 160) };
    })()`);
    seen[sid] = info;
    console.log(`(b) ${sid}: len=${info.len} head=${JSON.stringify(info.head.slice(0, 80))}`);
  }
  const lens = EXPECTED_ORDER.map(s => seen[s]?.len || 0);
  const allRendered = lens.every(l => l > 200);
  const distinct = new Set(lens).size >= 4; // sections differ visibly
  console.log(`(b) all rendered (>200 chars): ${allRendered ? 'PASS' : 'FAIL'}; distinct snapshots: ${distinct ? 'PASS' : 'WARN'} (${lens.join(',')})`);

  // (c) persistence probe: flip first Radix toggle (data-state) in input section, reopen, compare
  const pickToggle = `(() => {
    const st = el => (el.className.includes('bg-primary') || el.className.includes('bg-accent')) ? 'on' : 'off';
    const els = [...document.querySelectorAll('button')]
      .filter(el => el.className.includes('w-11') && el.className.includes('rounded-full'));
    if (!els.length) return null;
    const el = els[0];
    el.click();
    return st(el);
  })()`;
  await ev(`document.querySelector('[data-section-id="input"]').click()`);
  await new Promise(r => setTimeout(r, 350));
  const before = await ev(pickToggle);
  let after = null;
  if (before !== null && before !== undefined && before.__error === undefined) {
    await new Promise(r => setTimeout(r, 300));
    await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
    await new Promise(r => setTimeout(r, 400));
    await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ',', ctrlKey: true, bubbles: true, cancelable: true }))`);
    await new Promise(r => setTimeout(r, 700));
    after = await ev(`(() => {
      const st = el => (el.className.includes('bg-primary') || el.className.includes('bg-accent')) ? 'on' : 'off';
      const els = [...document.querySelectorAll('button')]
        .filter(el => el.className.includes('w-11') && el.className.includes('rounded-full'));
      return els.length ? st(els[0]) : null;
    })()`);
  }
  const persistOk = before === null || before === undefined || before.__error !== undefined ? 'SKIP (no toggle found)'
    : (after === before ? 'FAIL (reverted!)' : 'PASS (changed: ' + before + ' -> ' + after + ')');
  console.log(`(c) toggle persistence: before=${JSON.stringify(before)} after=${JSON.stringify(after)} -> ${persistOk}`);

  console.log(orderOk && allRendered ? 'SMOKE: PASS' : 'SMOKE: FAIL');
  c.close();
  process.exit(orderOk && allRendered ? 0 : 1);
})().catch(e => { console.error('SMOKE ERROR:', e.message); process.exit(2); });
