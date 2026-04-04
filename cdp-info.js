const http = require('http');

function postJson(url, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const u = new URL(url);
    const options = {
      hostname: u.hostname, port: u.port, path: u.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = http.request(options, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(d); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  try {
    // Get page info
    const pages = await postJson('http://localhost:9222/json', {});
    console.log('Pages:', JSON.stringify(pages, null, 2));
    
    if (pages && pages.length > 0) {
      const page = pages[0];
      console.log('Page title:', page.title);
      console.log('Page URL:', page.url);
    }
  } catch(e) {
    console.log('Error:', e.message);
  }
  process.exit(0);
}
main();
