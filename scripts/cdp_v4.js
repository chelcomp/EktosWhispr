const http = require('http');
const WS = require('ws');

http.get('http://127.0.0.1:9222/json', (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
        const pages = JSON.parse(data);
        const main = pages.find(p => !p.url.includes('panel=true'));
        const socket = new WS(main.webSocketDebuggerUrl);
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
                
                // Step 1: Show the dictation panel (makes window visible)
                await send('Runtime.evaluate', {
                    expression: 'window.electronAPI?.showDictationPanel?.()',
                    awaitPromise: true,
                    returnByValue: true
                });
                console.log('Panel shown');
                await new Promise(r => setTimeout(r, 1000));
                
                // Step 2: Force React to re-render with bar visible
                // Find React fiber root and set recording state
                const r = await send('Runtime.evaluate', {
                    expression: `(function() {
                        // Try to access React internals
                        // The root is rendered into #root
                        const rootEl = document.getElementById('root');
                        
                        // Access React fiber: React stores fiber on the root DOM element
                        // as __reactFiber$ + hash
                        const fiberKey = Object.keys(rootEl).find(k => k.startsWith('__reactFiber$'));
                        if (!fiberKey) return 'No React fiber found';
                        
                        let fiber = rootEl[fiberKey];
                        
                        // Walk up to find the App component (has memoizedState with state)
                        // App component fiber should be near the top
                        let attempts = 0;
                        while (fiber && attempts < 100) {
                            // Check if this fiber has the right tag (6 = ClassComponent, 0 = Indeterminate)
                            // FunctionComponent has tag 0 or 9
                            if (fiber.memoizedState && fiber.memoizedQueue === null) {
                                // Look for state hooks
                                let hook = fiber.memoizedState;
                                while (hook) {
                                    if (hook.queue && hook.queue.lastRenderedState !== undefined) {
                                        // Found a state hook - let's try to set isRecording
                                        // But hard to know which one...
                                    }
                                    hook = hook.next;
                                }
                            }
                            fiber = fiber.return;
                            attempts++;
                        }
                        
                        return 'Could not set recording state via fiber';
                    })()`,
                    returnByValue: true
                });
                console.log('Fiber:', r?.result?.result?.value);
                
                // Step 3: Alternative - simulate the IPC 'toggle-dictation' message
                // The preload uses registerListener which wraps ipcRenderer.on
                // We can directly invoke ipcRenderer listeners if we find them
                let r2 = await send('Runtime.evaluate', {
                    expression: `(function() {
                        // Try to access ipcRenderer via preload internals
                        // The preload runs in contextBridge, but we might access
                        // __contextBridge or similar
                        
                        // Alternative: just directly render a dictation-bar element
                        // for style testing purposes
                        const d = document.querySelector('.dictation-window');
                        if (d) {
                            d.innerHTML = '<div class="dictation-bar" data-state="capturing">' +
                                '<div class="dictation-bar__eq eq-capturing">' +
                                Array(30).fill().map((_,i) => 
                                    '<span class="bar" style="animation-delay:' + (i%8)*0.09 + 's"></span>'
                                ).join('') +
                                '</div>' +
                                '<span class="dictation-bar__timer">00:00</span>' +
                                '</div>';
                            return 'BAR RENDERED';
                        }
                        return 'NO DICTATION WINDOW';
                    })()`,
                    returnByValue: true
                });
                console.log('Render result:', r2?.result?.result?.value);
                
                // Step 4: Check bar now
                let r3 = await send('Runtime.evaluate', {
                    expression: "document.querySelector('.dictation-bar')?.outerHTML?.substring(0,500) || 'NO BAR'",
                    returnByValue: true
                });
                console.log('Bar HTML:', r3?.result?.result?.value);
                
                // Step 4: Get computed styles  
                if (r3?.result?.result?.value !== 'NO BAR') {
                    await send('DOM.enable');
                    await send('CSS.enable');
                    
                    const doc = await send('DOM.getDocument');
                    const rootId = doc?.result?.root?.nodeId;
                    
                    if (rootId) {
                        const qry = await send('DOM.querySelector', { nodeId: rootId, selector: '.dictation-bar' });
                        if (qry?.result?.nodeId) {
                            const styleR = await send('CSS.getComputedStyleForNode', { nodeId: qry.result.nodeId });
                            const styles = styleR?.result?.computedStyle || [];
                            console.log('\n=== BAR COMPUTED STYLES ===');
                            ['background-color','background','border-radius','border','box-shadow','height','width','opacity','border-top-left-radius','border-top-color','border-top-width','display'].forEach(key => {
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