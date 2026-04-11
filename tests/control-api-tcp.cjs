/**
 * SeeleLink Control API (TCP) Tests
 *
 * Tests the TCP JSON-RPC protocol at 127.0.0.1:9380
 * Protocol: one JSON object per line, {ok, result} or {ok:false, error}
 *
 * Run: node tests/control-api-tcp.js
 */
const net = require('net');

const CONTROL_HOST = '127.0.0.1';
const CONTROL_PORT = 9380;
const TIMEOUT_MS = 5000;

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, msg) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`  [PASS] ${msg}`);
    passed++;
  } else {
    console.log(`  [FAIL] ${msg}`);
    console.log(`         Expected: ${JSON.stringify(expected)}`);
    console.log(`         Got:      ${JSON.stringify(actual)}`);
    failed++;
  }
}

function assertTrue(value, msg) {
  if (value) {
    console.log(`  [PASS] ${msg}`);
    passed++;
  } else {
    console.log(`  [FAIL] ${msg}`);
    console.log(`         Expected truthy, got: ${JSON.stringify(value)}`);
    failed++;
  }
}

function sendCommand(cmd, args = []) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    const timer = setTimeout(() => {
      client.destroy();
      reject(new Error('Connection timeout'));
    }, TIMEOUT_MS);

    client.connect(CONTROL_PORT, CONTROL_HOST, () => {
      const req = JSON.stringify({ cmd, args });
      client.write(req + '\n');
    });

    let data = '';
    client.on('data', (chunk) => {
      data += chunk.toString();
      clearTimeout(timer);
      try {
        const resp = JSON.parse(data.trim());
        resolve(resp);
      } catch (e) {
        reject(new Error('Invalid JSON response: ' + data));
      }
    });
    client.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('SeeleLink Control API (TCP) Tests');
  console.log('='.repeat(60));
  console.log(`Target: ${CONTROL_HOST}:${CONTROL_PORT}`);
  console.log('');

  // Test 1: ping
  try {
    console.log('[Test] ping');
    const r = await sendCommand('ping');
    assertEqual(r.ok, true, 'ping returns ok=true');
    assertEqual(r.result, 'pong', 'ping returns pong');
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 2: health
  try {
    console.log('[Test] health');
    const r = await sendCommand('health');
    assertTrue(r.ok, 'health returns ok=true');
    assertTrue(Array.isArray(r.result.ssh), 'health has ssh array');
    assertTrue(Array.isArray(r.result.ps), 'health has ps array');
    assertTrue(Array.isArray(r.result.cmd), 'health has cmd array');
    assertTrue(Array.isArray(r.result.serial), 'health has serial array');
    assertTrue(Array.isArray(r.result.ws), 'health has ws array');
    assertTrue(typeof r.result.timestamp === 'number', 'health has timestamp');
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 3: status
  try {
    console.log('[Test] status');
    const r = await sendCommand('status');
    assertTrue(r.ok, 'status returns ok=true');
    assertTrue(Array.isArray(r.result.ssh), 'status has ssh array');
    assertTrue(Array.isArray(r.result.ps), 'status has ps array');
    assertTrue(Array.isArray(r.result.cmd), 'status has cmd array');
    assertTrue(Array.isArray(r.result.serial), 'status has serial array');
    assertTrue(Array.isArray(r.result.ws), 'status has ws array');
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 4: list (no connections)
  try {
    console.log('[Test] list (empty state)');
    const r = await sendCommand('list');
    assertTrue(r.ok, 'list returns ok=true');
    assertTrue(Array.isArray(r.result), 'list returns array');
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 5: invalid command
  try {
    console.log('[Test] invalid command');
    const r = await sendCommand('nonexistent_command_xyz');
    assertTrue(r.ok === false, 'invalid command returns ok=false');
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 6: control:platform:info
  try {
    console.log('[Test] control:platform:info');
    const r = await sendCommand('control:platform:info');
    assertTrue(r.ok, 'control:platform:info returns ok=true');
    assertTrue(['windows', 'macos', 'linux'].includes(r.result.type), 'platform type is valid');
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 7: control:mouse:position
  try {
    console.log('[Test] control:mouse:position');
    const r = await sendCommand('control:mouse:position');
    assertTrue(r.ok, 'control:mouse:position returns ok=true');
    assertTrue(typeof r.result.x === 'number', 'mouse x coordinate is number');
    assertTrue(typeof r.result.y === 'number', 'mouse y coordinate is number');
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 8: serial:list
  try {
    console.log('[Test] serial:list');
    const r = await sendCommand('serial:list');
    assertTrue(r.ok, 'serial:list returns ok=true');
    assertTrue(Array.isArray(r.result), 'serial list is array');
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 9: control:debug:getStats
  try {
    console.log('[Test] control:debug:getStats');
    const r = await sendCommand('control:debug:getStats');
    assertTrue(r.ok, 'control:debug:getStats returns ok=true');
    assertTrue(typeof r.result === 'object', 'stats is object');
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 10: control:screen:capture
  try {
    console.log('[Test] control:screen:capture');
    const r = await sendCommand('control:screen:capture');
    assertTrue(r.ok, 'control:screen:capture returns ok=true');
    assertTrue(r.result && r.result.base64 && r.result.base64.length > 100, 'screen capture returns base64 data');
    assertTrue(r.result.width > 0, 'capture has width');
    assertTrue(r.result.height > 0, 'capture has height');
    assertEqual(r.result.format, 'png', 'format is png');
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Summary
  console.log('');
  console.log('='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  console.error('Fatal error:', e.message);
  console.error('Is SeeleLink running with Control API enabled (port 9380)?');
  process.exit(1);
});
