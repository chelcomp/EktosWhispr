const http = require('http');
const WS = require('ws');

// Get main page WS URL
http.get('http://127.0.0.1:9222/json', (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
        const pages = JSON.parse(data);
        const main = pages.find(p => !p.url.includes('panel=true'));
        const wsUrl = main.webSocketDebuggerUrl;
        console.log('WS URL:', wsUrl);
        
        const socket = new WS(wsUrl);
        let id = 0;
        const pending = {};
        
        socket.on('message', (raw) => {
            const d = JSON.parse(raw.data || raw);
            if (d.id && pending[d.id]) { pending[d.id](d); delete pending[d.id]; }
        });
        
        function send(m, p = {}) {
            return new Promise(resolve => {
                const mid = ++id;
                pending[mid] = resolve;
                socket.send(JSON.stringify({ id: mid, method: m, params: p }));
                setTimeout(() => { if (pending[mid]) { pending[mid](null); delete pending[mid]; } }, 8000);
            });
        }
        
        socket.on('open', async () => {
            try {
                await send('Runtime.enable');
                
                // Step 1: Show dictation panel
                let r = await send('Runtime.evaluate', {
                    expression: 'window.electronAPI?.showDictationPanel?.()',
                    awaitPromise: true,
                    returnByValue: true
                });
                console.log('showDictationPanel:', r?.result?.type || 'null');
                
                // Step 2: Wait for React
                await new Promise(r => setTimeout(r, 2000));
                
                // Step 3: Check bar existence
                r = await send('Runtime.evaluate', {
                    expression: 'document.querySelector(".dictation-bar")?.getAttribute("data-state") || "NO_BAR"',
                    returnByValue: true
                });
                console.log('Bar state:', r?.result?.value);
                
                // Step 4: Full dictation window HTML
                r = await send('Runtime.evaluate', {
                    expression: 'document.querySelector(".dictation-window")?.innerHTML?.substring(0,500) || "EMPTY dictation-window"',
                    returnByValue: true
                });
                console.log('Window innerHTML:', r?.result?.value);
                
                // Step 5: If bar exists, get computed styles
                r = await send('Runtime.evaluate', {
                    expression: '!!document.querySelector(".dictation-bar")',
                    returnByValue: true
                });
                
                if (r?.result?.value) {
                    await send('DOM.enable');
                    await send('CSS.enable');
                    
                    const doc = await send('DOM.getDocument');
                    const rootId = doc?.result?.root?.nodeId;
                    
                    if (rootId) {
                        const qry = await send('DOM.querySelector', { nodeId: rootId, selector: '.dictation-bar' });
                        if (qry?.result?.nodeId) {
                            const styleR = await send('CSS.getComputedStyleForNode', { nodeId: qry.result.nodeId });
                            if (styleR?.result?.computedStyle) {
                                console.log('\n=== BAR COMPUTED STYLES ===');
                                ['background-color','background','border-radius','border','box-shadow','height','width','opacity','border-top-left-radius','border-top-color','border-top-width'].forEach(key => {
                                    const v = styleR.result.computedStyle.find(s => s.name === key);
                                    if (v) console.log(`  ${key}: ${v.value}`);
                                });
                            }
                        }
                    }
                }
            } catch(e) {
                console.error('Error:', e.message);
            }
            
            socket.close();
            process.exit(0);
        });
    });
});