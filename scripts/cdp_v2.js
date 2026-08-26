const http = require('http');
const WS = require('ws');

http.get('http://127.0.0.1:9222/json', (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
        const pages = JSON.parse(data);
        const main = pages.find(p => !p.url.includes('panel=true'));
        console.log('PAGE URL:', main.url);
        const wsUrl = main.webSocketDebuggerUrl;
        
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
                // Must wait for Runtime.enable to complete before other commands
                let r = await send('Runtime.enable');
                console.log('Runtime.enable:', r?.error?.message || 'OK');
                
                // Test basic eval
                r = await send('Runtime.evaluate', {
                    expression: '1+1',
                    returnByValue: true
                });
                // CORRECT PATH: r.result is CDP result, r.result.result is evaluate result
                const evalResult = r?.result?.result;
                console.log('1+1:', evalResult?.value, 'type:', evalResult?.type);
                
                // Check readyState
                r = await send('Runtime.evaluate', {
                    expression: 'document.readyState',
                    returnByValue: true
                });
                const state = r?.result?.result;
                console.log('readyState:', state?.value, state?.type);
                
                // Check for dictation-window
                r = await send('Runtime.evaluate', {
                    expression: 'document.querySelector(".dictation-window") !== null',
                    returnByValue: true
                });
                const hasDW = r?.result?.result;
                console.log('Has dictation-window:', hasDW?.value);
                
                // Check root
                r = await send('Runtime.evaluate', {
                    expression: "document.getElementById('root')?.innerHTML?.substring(0,200) || 'empty'",
                    returnByValue: true
                });
                const rootHtml = r?.result?.result;
                console.log('Root HTML:', rootHtml?.value);
                
                // Show dictation panel
                r = await send('Runtime.evaluate', {
                    expression: 'window.electronAPI?.showDictationPanel?.()',
                    awaitPromise: true,
                    returnByValue: true
                });
                const showResult = r?.result?.result;
                console.log('showDictationPanel type:', showResult?.type);
                
                // Wait and check
                await new Promise(r => setTimeout(r, 2000));
                
                r = await send('Runtime.evaluate', {
                    expression: "document.querySelector('.dictation-bar')?.getAttribute('data-state') || 'NO BAR'",
                    returnByValue: true
                });
                const barState = r?.result?.result;
                console.log('Bar state:', barState?.value);
                
                r = await send('Runtime.evaluate', {
                    expression: "document.querySelector('.dictation-window')?.innerHTML?.substring(0,500) || 'EMPTY'",
                    returnByValue: true
                });
                const dw = r?.result?.result;
                console.log('Dictation window inner:', dw?.value);
                
                // If bar exists, get styles
                if (barState?.value && barState.value !== 'NO BAR') {
                    await send('DOM.enable');
                    await send('CSS.enable');
                    
                    const doc = await send('DOM.getDocument');
                    const rootId = doc?.result?.root?.nodeId;
                    
                    if (rootId) {
                        const qry = await send('DOM.querySelector', { nodeId: rootId, selector: '.dictation-bar' });
                        if (qry?.result?.nodeId) {
                            const styleR = await send('CSS.getComputedStyleForNode', { nodeId: qry.result.nodeId });
                            const styles = styleR?.result?.computedStyle || [];
                            console.log('\n=== BAR STYLES ===');
                            ['background-color','background','border-radius','border','box-shadow','height','width','opacity'].forEach(key => {
                                const v = styles.find(s => s.name === key);
                                if (v) console.log(`  ${key}: ${v.value}`);
                            });
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