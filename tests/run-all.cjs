/**
 * SeeleLink Test Runner
 *
 * Runs all automated tests:
 *   1. Control API (TCP) tests
 *   2. MCP API (HTTP) tests
 *   3. UI Build smoke tests
 *
 * Prerequisites:
 *   - SeeleLink must be running with Control API (port 9380) and MCP API (port 9381) enabled
 *   - For TCP/HTTP tests: start with `npm run electron:dev`
 *
 * Run all:  node tests/run-all.cjs
 * Run one:  node tests/control-api-tcp.cjs
 *           node tests/mcp-api-http.cjs
 *           node tests/ui-smoke.cjs
 */
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

const TESTS = [
  { name: 'UI Build Smoke Tests', file: 'ui-smoke.cjs', needsElectron: false },
  { name: 'Control API (TCP)', file: 'control-api-tcp.cjs', needsElectron: true },
  { name: 'MCP API (HTTP)', file: 'mcp-api-http.cjs', needsElectron: true },
];

const CONTROL_PORT = 9380;
const MCP_PORT = 9381;

function checkPort(port, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    const timer = setTimeout(() => {
      client.destroy();
      resolve(false);
    }, timeoutMs);
    client.connect(port, '127.0.0.1', () => {
      clearTimeout(timer);
      client.destroy();
      resolve(true);
    });
    client.on('error', () => {
      clearTimeout(timer);
      client.destroy();
      resolve(false);
    });
  });
}

async function runTest(test) {
  return new Promise((resolve) => {
    console.log('');
    const proc = spawn('node', [test.file], {
      cwd: path.join(__dirname),
      stdio: 'inherit',
    });
    proc.on('close', (code) => resolve(code));
    proc.on('error', (e) => {
      console.error(`Failed to run ${test.name}: ${e.message}`);
      resolve(1);
    });
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('SeeleLink Automated Test Suite');
  console.log('='.repeat(60));

  // Check if Electron is running
  console.log('\nChecking Electron services...');
  const controlOk = await checkPort(CONTROL_PORT);
  const mcpOk = await checkPort(MCP_PORT);
  console.log(`  Control API (${CONTROL_PORT}): ${controlOk ? 'RUNNING' : 'NOT running'}`);
  console.log(`  MCP API (${MCP_PORT}): ${mcpOk ? 'RUNNING' : 'NOT running'}`);

  if (!controlOk || !mcpOk) {
    console.log('\n⚠️  Warning: SeeleLink appears to not be running.');
    console.log('   Start it with: npm run electron:dev');
    console.log('   Then run this script again.');
    console.log('');
    console.log('   Running UI smoke tests only (no Electron needed)...\n');
  }

  const results = [];
  for (const test of TESTS) {
    if (test.needsElectron && !controlOk) {
      console.log(`\n⏭️  Skipping ${test.name} (Electron not running)\n`);
      results.push({ name: test.name, status: 'skipped' });
      continue;
    }
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Running: ${test.name}`);
    const code = await runTest(test);
    results.push({ name: test.name, status: code === 0 ? 'passed' : 'failed' });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  for (const r of results) {
    const icon = r.status === 'passed' ? '✅' : r.status === 'failed' ? '❌' : '⏭️';
    console.log(`  ${icon} ${r.name}: ${r.status}`);
  }
  const failed = results.filter(r => r.status === 'failed').length;
  console.log(`\nTotal: ${results.length}, Passed: ${results.length - failed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
