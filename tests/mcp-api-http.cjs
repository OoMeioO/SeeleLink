/**
 * SeeleLink MCP API (HTTP) Tests
 *
 * Tests the MCP HTTP protocol at 127.0.0.1:9381
 * Protocol: JSON-RPC over HTTP, enableJsonResponse: true (stateless)
 *
 * Run: node tests/mcp-api-http.js
 */
const http = require('http');

const MCP_HOST = '127.0.0.1';
const MCP_PORT = 9381;
const TIMEOUT_MS = 10000;

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
    failed++;
  }
}

function mcpRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    });

    const options = {
      hostname: MCP_HOST,
      port: MCP_PORT,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk.toString(); });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data.trim());
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          reject(new Error('Invalid JSON response: ' + data.slice(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(body);
    req.end();
  });
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('SeeleLink MCP API (HTTP) Tests');
  console.log('='.repeat(60));
  console.log(`Target: ${MCP_HOST}:${MCP_PORT}`);
  console.log('');

  // Test 1: health endpoint
  try {
    console.log('[Test] GET /health');
    const result = await new Promise((resolve, reject) => {
      const req = http.get(`http://${MCP_HOST}:${MCP_PORT}/health`, (res) => {
        let data = '';
        res.on('data', (c) => { data += c.toString(); });
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.setTimeout(TIMEOUT_MS, () => { req.destroy(); reject(new Error('timeout')); });
    });
    assertEqual(result.status, 200, 'health returns 200');
    assertEqual(result.body.status, 'ok', 'health status is ok');
    assertEqual(result.body.service, 'SeeleLink MCP', 'service name correct');
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 2: MCP initialize (JSON-RPC)
  try {
    console.log('[Test] MCP initialize');
    const r = await mcpRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' },
    });
    assertEqual(r.status, 200, 'initialize returns 200');
    assertEqual(r.body.jsonrpc, '2.0', 'response is jsonrpc 2.0');
    assertTrue(r.body.result && r.body.result.capabilities, 'result has capabilities');
    assertTrue(r.body.result && r.body.result.serverInfo, 'result has serverInfo');
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 3: MCP tools/list
  try {
    console.log('[Test] MCP tools/list');
    const r = await mcpRequest('tools/list', {});
    assertEqual(r.status, 200, 'tools/list returns 200');
    assertEqual(r.body.jsonrpc, '2.0', 'response is jsonrpc 2.0');
    assertTrue(Array.isArray(r.body.result?.tools), 'tools list is array');
    // Should have tools registered
    const toolNames = r.body.result.tools.map(t => t.name);
    console.log(`       Found ${toolNames.length} tools: ${toolNames.slice(0, 5).join(', ')}${toolNames.length > 5 ? '...' : ''}`);
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 4: MCP tools/call - control:mouse:position
  try {
    console.log('[Test] MCP tools/call - control:mouse:position');
    const r = await mcpRequest('tools/call', {
      name: 'control_mouse_position',
      arguments: {},
    });
    assertEqual(r.status, 200, 'tools/call returns 200');
    assertEqual(r.body.jsonrpc, '2.0', 'response is jsonrpc 2.0');
    assertTrue(r.body.result && r.body.result.content, 'result has content');
    if (r.body.result.content[0]?.text) {
      // content[0].text may be a JSON string or plain text
      const raw = r.body.result.content[0].text;
      if (raw.trim().startsWith('{')) {
        const parsed = JSON.parse(raw);
        assertTrue(typeof parsed.x === 'number', 'mouse_position has x coordinate');
        assertTrue(typeof parsed.y === 'number', 'mouse_position has y coordinate');
      } else {
        assertTrue(typeof raw === 'string' && raw.length > 0, 'mouse_position returns text content');
      }
    }
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 5: MCP tools/call - control:screen:capture
  try {
    console.log('[Test] MCP tools/call - control:screen:capture');
    const r = await mcpRequest('tools/call', {
      name: 'control_screen_capture',
      arguments: {},
    });
    assertEqual(r.status, 200, 'tools/call returns 200');
    assertEqual(r.body.jsonrpc, '2.0', 'response is jsonrpc 2.0');
    if (r.body.result?.content?.[0]?.text) {
      const raw = r.body.result.content[0].text;
      if (raw.trim().startsWith('{')) {
        const parsed = JSON.parse(raw);
        assertTrue(parsed.ok === true, 'screen_capture returns ok=true');
        assertTrue(parsed.result && parsed.result.base64 && parsed.result.base64.length > 100, 'returns base64 data');
      } else {
        assertTrue(typeof raw === 'string', 'screen_capture returns text content');
      }
    }
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 6: MCP tools/call - ps:connect
  try {
    console.log('[Test] MCP tools/call - ps:connect');
    const r = await mcpRequest('tools/call', {
      name: 'ps_connect',
      arguments: {},
    });
    assertEqual(r.status, 200, 'tools/call returns 200');
    assertEqual(r.body.jsonrpc, '2.0', 'response is jsonrpc 2.0');
    if (r.body.result?.content?.[0]?.text) {
      const raw = r.body.result.content[0].text;
      assertTrue(typeof raw === 'string', 'ps:connect returns text content');
    }
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 7: MCP tools/call - invalid tool
  try {
    console.log('[Test] MCP tools/call - invalid tool');
    const r = await mcpRequest('tools/call', {
      name: 'nonexistent_tool_xyz',
      arguments: {},
    });
    assertEqual(r.status, 200, 'tools/call returns 200 even for unknown tool');
    // MCP may return isError: true for unknown tools
    const isError = r.body.result?.isError || r.body.error;
    assertTrue(isError, 'unknown tool returns error');
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 8: MCP notifications/list (MCP servers may not implement resources)
  try {
    console.log('[Test] MCP notifications/list (optional)');
    const r = await mcpRequest('notifications/list', {});
    // This is optional - server may not implement it
    console.log(`       notifications/list status: ${r.status}, error: ${r.body.error ? 'yes' : 'no'}`);
    // Just verify we get a valid JSON-RPC response
    assertEqual(r.body.jsonrpc, '2.0', 'response is jsonrpc 2.0');
  } catch (e) {
    console.log(`  [ERROR] ${e.message}`);
    failed++;
  }

  // Test 9: MCP ping
  try {
    console.log('[Test] MCP ping');
    const r = await mcpRequest('ping', {});
    assertEqual(r.status, 200, 'ping returns 200');
    assertEqual(r.body.jsonrpc, '2.0', 'response is jsonrpc 2.0');
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
  console.error('Is SeeleLink running with MCP API enabled (port 9381)?');
  process.exit(1);
});
