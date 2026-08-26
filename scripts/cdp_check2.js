const ws = require('ws');
const socket = new ws('ws://127.0.0.1:9222/devtools/page/61B95FA4E7E6446099F799FD76B3E40A');
let id = 0;

socket.on('open', () => {
    function send(m, p = {}) {
        return new Promise(resolve => {
            const mid = ++id;
            socket.on('message', function handler(raw) {
                const r = JSON.parse(raw);
                if (r.id === mid) { socket.removeListener('message', handler); resolve(r); }
            });
            socket.send(JSON.stringify({ id: mid, method: m, params: p }));
            setTimeout(() => resolve(null), 5000);
        });
    }
    
    (async () => {
        await send('Runtime.enable');
        
        let r = await send('Runtime.evaluate', {
            expression: 'document.title',
            returnByValue: true
        });
        console.log('TITLE:', r?.result?.value);
        
        r = await send('Runtime.evaluate', {
            expression: 'document.querySelector(".dictation-window")?.innerHTML?.substring(0,200) || "empty"',
            returnByValue: true
        });
        console.log('WINDOW:', r?.result?.value);
        
        r = await send('Runtime.evaluate', {
            expression: 'window.electronAPI?.showDictationPanel?.()',
            awaitPromise: true,
            returnByValue: true
        });
        console.log('SHOW:', JSON.stringify(r?.result));
        
        await new Promise(r => setTimeout(r, 2000));
        
        r = await send('Runtime.evaluate', {
            expression: 'document.querySelector(".dictation-bar")?.outerHTML?.substring(0,600) || "NO BAR"',
            returnByValue: true
        });
        console.log('BAR:', r?.result?.value || 'null');
        
        if (r?.result?.value && r.result.value !== 'NO BAR') {
            await send('DOM.enable');
            await send('CSS.enable');
            
            const doc = await send('DOM.getDocument');
            const rootId = doc?.result?.root?.nodeId;
            if (rootId) {
                const qry = await send('DOM.querySelector', { nodeId: rootId, selector: '.dictation-bar' });
                if (qry?.result?.nodeId) {
                    const styleR = await send('CSS.getComputedStyleForNode', { nodeId: qry.result.nodeId });
                    console.log('STYLES:');
                    const keys = ['background-color','background','border-radius','border','box-shadow','height','width','opacity','border-top-left-radius'];
                    styleR?.result?.computedStyle?.forEach(s => {
                        if (keys.includes(s.name)) console.log('  ' + s.name + ': ' + s.value);
                    });
                }
            }
        }
        
        socket.close();
        process.exit(0);
    })();
});