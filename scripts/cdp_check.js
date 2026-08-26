const WebSocket = require('ws');
const pages = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const mainPage = pages.find(p => !p.url.includes('panel=true') && p.title === 'EktosWhispr');
if (!mainPage) { console.log('No main page found'); process.exit(1); }

const ws = new WebSocket(mainPage.webSocketDebuggerUrl);
let id = 100;
const pending = {};

ws.on('message', (data) => {
    const r = JSON.parse(data);
    if (r.id && pending[r.id]) pending[r.id](r);
});

function send(m, p = {}) {
    return new Promise(resolve => {
        pending[++id] = resolve;
        ws.send(JSON.stringify({ id, method: m, params: p }));
        setTimeout(() => resolve(null), 3000);
    });
}

ws.on('open', async () => {
    await send('Runtime.enable');
    
    let r = await send('Runtime.evaluate', {
        expression: "document.querySelector('.dictation-bar')?.outerHTML?.substring(0,600) || 'NO BAR'",
        returnByValue: true
    });
    console.log('BAR HTML:', JSON.stringify(r?.result?.value));

    console.log('=== Current Window State ===');
    r = await send('Runtime.evaluate', {
        expression: "document.querySelector('.dictation-window')?.innerHTML?.trim()?.substring(0,1000) || 'EMPTY'",
        returnByValue: true
    });
    console.log('Window:', JSON.stringify(r?.result?.value));

    ws.close();
});