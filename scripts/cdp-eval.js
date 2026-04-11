const http = require('http');

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve(data); }
      });
    }).on('error', reject);
  });
}

async function evaluate(pageUrl, expr) {
  // Get CDP websocket URL for the page
  const targets = await getJson(pageUrl);
  if (!targets || targets.length === 0) { console.log('No targets'); return; }
  const wsUrl = targets[0].webSocketDebuggerUrl;
  console.log('WS URL:', wsUrl);
  
  const { WebSocket } = require('ws');
  const ws = new WebSocket(wsUrl);
  let id = 1;
  
  ws.on('open', () => {
    ws.send(JSON.stringify({id: id++, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true }}));
  });
  
  ws.on('message', data => {
    const msg = JSON.parse(data);
    if (msg.id) {
      console.log('Result:', JSON.stringify(msg.result, null, 2));
      ws.close();
      process.exit(0);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.log('EXCEPTION:', msg.params.exceptionDetails.text);
    }
  });
  
  ws.on('error', e => { console.log('WS Error:', e.message); process.exit(1); });
  
  setTimeout(() => { console.log('Timeout'); ws.terminate(); process.exit(1); }, 10000);
}

evaluate('http://localhost:9222/json', 'document.getElementById("root").innerHTML.substring(0, 500)');
