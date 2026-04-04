const http = require('http');
const { WebSocket } = require('ws');

async function main() {
  const pages = JSON.parse(await new Promise((resolve) => {
    http.get('http://localhost:9222/json', res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve([]); } });
    }).on('error', () => resolve([]));
  }));

  if (!pages || pages.length === 0) { console.log('No pages'); return; }
  const appPage = pages[0];
  console.log('Page URL:', appPage.url);

  const ws = new WebSocket(appPage.webSocketDebuggerUrl);
  let done = 0;
  const checkDone = () => { if (++done >= 3) { ws.close(); process.exit(0); } };

  ws.on('open', () => {
    // Test 1+1
    ws.send(JSON.stringify({ id:1, method:'Runtime.evaluate', params:{ expression:'1+1', returnByValue:true }}));
    // Test root rect
    ws.send(JSON.stringify({ id:2, method:'Runtime.evaluate', params:{ expression:'root.getBoundingClientRect().width+","+root.getBoundingClientRect().height', returnByValue:true }}));
    // Test root innerHTML length
    ws.send(JSON.stringify({ id:3, method:'Runtime.evaluate', params:{ expression:'root.innerHTML.length', returnByValue:true }}));

    ws.on('message', data => {
      const msg = JSON.parse(data.toString());
      if (msg.id === 1) console.log('1+1 =', msg.result?.result?.value);
      if (msg.id === 2) console.log('Root rect =', msg.result?.result?.value);
      if (msg.id === 3) console.log('Root HTML length =', msg.result?.result?.value);
      checkDone();
    });
  });

  ws.on('error', e => { console.log('WS error:', e.message); process.exit(1); });
  setTimeout(() => { console.log('Timeout'); ws.terminate(); process.exit(0); }, 10000);
}

main();
