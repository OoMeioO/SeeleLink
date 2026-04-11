const http = require('http');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    const pages = await fetchJson('http://localhost:9222/json');
    console.log('Pages found:', pages.length);
    for (const p of pages) {
      console.log('  Title:', p.title);
      console.log('  URL:', p.url);
      console.log('  Type:', p.type);
    }
  } catch(e) {
    console.log('Error:', e.message);
  }
  process.exit(0);
}
main();
