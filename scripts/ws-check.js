const http = require('http');
const { WebSocket } = require('ws');

async function main() {
  // Get pages
  const pages = await new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json', res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve([]); } });
    }).on('error', () => resolve([]));
  });

  if (!pages || pages.length === 0) { console.log('No pages'); return; }
  const appPage = pages[0];
  console.log('Page:', appPage.title, appPage.url);

  const ws = new WebSocket(appPage.webSocketDebuggerUrl);
  let id = 1;

  ws.on('open', () => {
    // Simple eval
    ws.send(JSON.stringify({ id: id++, method: 'Runtime.evaluate', params: { expression: '1+1', returnByValue: true }}));

    ws.on('message', data => {
      const msg = JSON.parse(data);
      if (msg.id === 1) {
        console.log('1+1 =', msg.result ? msg.result.result : msg.result);
      }
      if (msg.id === 2) {
        console.log('Root rect =', msg.result ? msg.result.result : msg.result);
        ws.close();
        process.exit(0);
      }
    });
  });

  ws.on('error', e => { console.log('WS error:', e.message); process.exit(1); });
  setTimeout(() => { console.log('Timeout'); ws.terminate(); process.exit(1); }, 8000);
}

main();
