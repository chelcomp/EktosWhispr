const http = require('http');
const WS = require('ws');

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
                
                // First just evaluate a basic expression to make sure CDP works
                let r = await send('Runtime.evaluate', {
                    expression: '1+1',
                    returnByValue: true
                });
                console.log('1+1:', r?.result?.value, r?.error?.message || '');
                
                // Check if electronAPI exists and showDictationPanel is a function
                r = await send('Runtime.evaluate', {
                    expression: 'typeof window.electronAPI?.showDictationPanel',
                    returnByValue: true
                });
                console.log('showDictationPanel type:', r?.result?.value, r?.error?.message || '');
                
                // Check if document is loaded  
                r = await send('Runtime.evaluate', {
                    expression: 'document.readyState',
                    returnByValue: true
                });
                console.log('readyState:', r?.result?.value, r?.error?.message || '');
                
                // Check for dictation-window
                r = await send('Runtime.evaluate', {
                    expression: 'document.querySelector(".dictation-window") !== null',
                    returnByValue: true
                });
                console.log('Has dictation-window:', r?.result?.value, r?.error?.message || '');
                
                // Check root content
                r = await send('Runtime.evaluate', {
                    expression: `document.getElementById('root')?.innerHTML?.substring(0, 200) || 'empty root'`,
                    returnByValue: true
                });
                console.log('Root:', r?.result?.value, r?.error?.message || '');
                
                // Show the panel 
                r = await send('Runtime.evaluate', {
                    expression: `window.electronAPI.showDictationPanel()`,
                    awaitPromise: true,
                    returnByValue: true
                });
                console.log('showDictationPanel result:', JSON.stringify(r?.result).slice(0,100), r?.error?.message || '');
                
                // Wait
                await new Promise(r => setTimeout(r, 2000));
                
                // Check for bar now
                r = await send('Runtime.evaluate', {
                    expression: `document.querySelector('.dictation-bar')?.outerHTML?.substring(0,600) || 'NO BAR'`,
                    returnByValue: true
                });
                console.log('Bar HTML:', r?.result?.value, r?.error?.message || '');
                
                if (r?.result?.value !== 'NO BAR') {
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