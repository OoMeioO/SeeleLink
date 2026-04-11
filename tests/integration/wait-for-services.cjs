/**
 * wait-for-services.cjs
 *
 * Waits for SeeleLink services to be ready:
 *   - Port 9380: Control API (TCP JSON) — check with net.Socket
 *   - Port 9381: MCP Server (HTTP)     — check with http.get
 *
 * Usage: node tests/integration/wait-for-services.cjs
 *   --control-port <n>   (default: 9380)
 *   --mcp-port <n>       (default: 9381)
 *   --timeout <seconds>   (default: 60)
 */

const net = require('net');
const http = require('http');
const path = require('path');

const CONTROL_PORT = parseInt(process.argv.find(a => a === '--control-port') ?
  process.argv[process.argv.indexOf('--control-port') + 1] : '9380');
const MCP_PORT = parseInt(process.argv.find(a => a === '--mcp-port') ?
  process.argv[process.argv.indexOf('--mcp-port') + 1] : '9381');
const TIMEOUT_SEC = parseInt(process.argv.find(a => a === '--timeout') ?
  process.argv[process.argv.indexOf('--timeout') + 1] : '60');

function checkTcpPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 3000);
    socket.connect(port, '127.0.0.1', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(false);
    });
  });
}

function checkHttpPort(port, path = '/health') {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(false);
    }, 5000);
    const req = http.get(`http://127.0.0.1:${port}${path}`, (res) => {
      clearTimeout(timer);
      resolve(res.statusCode === 200);
    });
    req.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
    req.end();
  });
}

async function waitForServices() {
  const maxAttempts = TIMEOUT_SEC;
  console.log(`Waiting for Control API (${CONTROL_PORT}) and MCP (${MCP_PORT})...`);

  for (let i = 1; i <= maxAttempts; i++) {
    const [controlOk, mcpOk] = await Promise.all([
      checkTcpPort(CONTROL_PORT),
      checkHttpPort(MCP_PORT, '/health'),
    ]);

    if (controlOk && mcpOk) {
      console.log(`Both services ready after ${i} attempts`);
      process.exit(0);
    }

    process.stdout.write(`Attempt ${i}/${maxAttempts}: ` +
      `Control=${controlOk ? 'OK' : 'NOT ready'}, ` +
      `MCP=${mcpOk ? 'OK' : 'NOT ready'}\n`);

    await new Promise(r => setTimeout(r, 2000));
  }

  console.error('Timeout waiting for services');
  process.exit(1);
}

waitForServices();
