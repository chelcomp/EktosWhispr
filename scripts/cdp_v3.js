const http = require('http');
const WS = require('ws');

http.get('http://127.0.0.1:9222/json', (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
        const pages = JSON.parse(data);
        const main = pages.find(p => !p.url.includes('panel=true'));
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
                await send('Runtime.enable');
                
                // 1. Show the dictation panel (makes window visible)
                await send('Runtime.evaluate', {
                    expression: 'window.electronAPI?.showDictationPanel?.()',
                    awaitPromise: true,
                    returnByValue: true
                });
                console.log('Panel show called');
                
                await new Promise(r => setTimeout(r, 1000));
                
                // 2. Manually set React state to show dictation bar
                // Find the React fiber and set isRecording to true via mock
                // Or just directly render the bar by dispatching the recording event
                // The App listens to window.electronAPI.onToggleDictation which fires when hotkey pressed
                
                // Check what event listeners are registered
                let r = await send('Runtime.evaluate', {
                    expression: `(function simulateToggle() {
                        // Check: does window.electronAPI have onToggleDictation?
                        const has = typeof window.electronAPI?.onToggleDictation;
                        if (has !== 'function') return 'no onToggleDictation: ' + has;
                        
                        // We need to call onToggleDictation, but that's a registration fn that takes a callback
                        // The toggle-dictation IPC goes: 
                        // main process -> webContents.send('toggle-dictation') 
                        // renderer -> window.electronAPI.onToggleDictation(callback) registers callback
                        // Actually onToggleDictation sets up an ipcRenderer listener for 'toggle-dictation'
                        // Let's fire a direct dispatch
                        return has;
                    })()`,
                    returnByValue: true
                });
                const val = r?.result?.result;
                console.log('onToggleDictation check:', val?.value);

                // 3. Try to manually set recording state via React DevTools approach
                // Access the App component and force re-render with recording state
                r = await send('Runtime.evaluate', {
                    expression: `(async function() {
                        // Try IPC: the main process listens for toggle-dictation hotkey
                        // and sends 'toggle-dictation' to renderer.
                        // The renderer's ipcRenderer listens to 'toggle-dictation' 
                        // and calls the registered callback.
                        // We can use preload bridge: window.electronAPI is the bridge.
                        // But onToggleDictation is a REGISTRATION function, not a trigger.
                        
                        // Alternative: send 'toggle-dictation' via the actual IPC channel
                        // that the main process uses.
                        // The preload script sets up ipcRenderer.on('toggle-dictation', ...)
                        // We can try direct ipcRenderer access if contextIsolation allows
                        
                        // Simplest: just dispatch a custom event that the App listens to
                        window.dispatchEvent(new CustomEvent('local-start-recording'));
                        return 'dispatched';
                    })()`,
                    returnByValue: true
                });
                const val2 = r?.result?.result;
                console.log('Dispatch:', val2?.value);
                
                await new Promise(r => setTimeout(r, 1500));
                
                // 4. Check bar
                r = await send('Runtime.evaluate', {
                    expression: "document.querySelector('.dictation-bar')?.getAttribute('data-state') || 'NO BAR'",
                    returnByValue: true
                });
                const barState = r?.result?.result;
                console.log('Bar state:', barState?.value);
                
                // 5. If bar appeared, get outer HTML and styles
                if (barState?.value && barState.value !== 'NO BAR') {
                    r = await send('Runtime.evaluate', {
                        expression: "document.querySelector('.dictation-bar')?.outerHTML?.substring(0,500)",
                        returnByValue: true
                    });
                    const html = r?.result?.result;
                    console.log('Bar HTML:', html?.value);
                    
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