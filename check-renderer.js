const WebSocket = require('ws');
const wsUrl = 'ws://localhost:9222/devtools/page/428DD43DED19B11EE7FB2E735C90605E';
const ws = new WebSocket(wsUrl);
ws.on('open', () => {
  ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:'document.getElementById("root").innerHTML.substring(0,300)'}}));
});
ws.on('message', data => {
  const msg = JSON.parse(data);
  if (msg.id === 1) {
    console.log('root innerHTML:', msg.result.result.value || 'EMPTY OR ERROR: ' + JSON.stringify(msg.result));
    ws.close();
    process.exit(0);
  }
});
ws.on('error', e => { console.log('WS error:', e.message); process.exit(1); });
setTimeout(() => { console.log('Timeout'); ws.terminate(); process.exit(1); }, 8000);
