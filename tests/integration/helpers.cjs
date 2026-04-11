/**
 * Shared test helpers for integration tests
 * Used by both Control API (TCP) and MCP (HTTP) integration tests
 */
const net = require('net');
const http = require('http');

const CONTROL_HOST = '127.0.0.1';
const CONTROL_PORT = 9380;
const MCP_HOST = '127.0.0.1';
const MCP_PORT = 9381;
const TIMEOUT_MS = 10000;

/**
 * Send a command to Control API via TCP
 * @param {string} cmd - Command name
 * @param {any[]} [args] - Command arguments
 * @returns {Promise<{ok: boolean, result?: any, error?: string}>}
 */
function sendControlCommand(cmd, args = []) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let data = '';

    const timer = setTimeout(() => {
      client.destroy();
      reject(new Error(`Timeout waiting for command: ${cmd}`));
    }, TIMEOUT_MS);

    client.connect(CONTROL_PORT, CONTROL_HOST, () => {
      const req = JSON.stringify({ cmd, args });
      client.write(req + '\n');
    });

    client.on('data', (chunk) => {
      data += chunk.toString();
      // Responses are newline-delimited. Accumulate until we see the trailing newline.
      const idx = data.indexOf('\n');
      if (idx === -1) return; // no complete line yet, keep waiting
      clearTimeout(timer);
      const line = data.substring(0, idx);
      try {
        resolve(JSON.parse(line));
      } catch (e) {
        reject(new Error(`Invalid JSON response for ${cmd}: ${line.substring(0, 500)}`));
      }
    });

    client.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

/**
 * Send a JSON-RPC request to MCP server via HTTP
 * @param {string} method - JSON-RPC method
 * @param {object} [params] - Method parameters
 * @returns {Promise<{status: number, body: object}>}
 */
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
          resolve({ status: res.statusCode, body: JSON.parse(data.trim()) });
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(TIMEOUT_MS, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(body);
    req.end();
  });
}

/**
 * Call an MCP tool by name
 * @param {string} toolName - Tool name (e.g., 'control_mouse_position')
 * @param {object} [arguments={}] - Tool arguments
 * @returns {Promise<{status: number, body: object}>}
 */
function callMcpTool(toolName, arguments_ = {}) {
  return mcpRequest('tools/call', { name: toolName, arguments: arguments_ });
}

/**
 * Check if both Control API and MCP are reachable
 * @returns {Promise<{control: boolean, mcp: boolean}>}
 */
async function checkServices() {
  const checkPort = (port, host) => new Promise((resolve) => {
    const client = new net.Socket();
    const timer = setTimeout(() => { client.destroy(); resolve(false); }, 2000);
    client.connect(port, host, () => { clearTimeout(timer); client.destroy(); resolve(true); });
    client.on('error', () => { clearTimeout(timer); resolve(false); });
  });

  const [control, mcp] = await Promise.all([
    checkPort(CONTROL_PORT, CONTROL_HOST),
    checkPort(MCP_PORT, MCP_HOST),
  ]);
  return { control, mcp };
}

/**
 * Get MCP server info (server info + tool list)
 * @returns {Promise<{tools: string[], toolCount: number}>}
 */
async function getMcpTools() {
  const r = await mcpRequest('tools/list', {});
  if (r.body?.result?.tools) {
    const tools = r.body.result.tools.map(t => t.name);
    return { tools, toolCount: tools.length };
  }
  return { tools: [], toolCount: 0 };
}

/**
 * Assert helper - throws on failure
 */
function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\n  Expected: ${JSON.stringify(expected)}\n  Got: ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value, message) {
  if (!value) throw new Error(`${message} (expected truthy, got: ${JSON.stringify(value)})`);
}

module.exports = {
  sendControlCommand,
  mcpRequest,
  callMcpTool,
  checkServices,
  getMcpTools,
  assert,
  assertEqual,
  assertTrue,
  CONTROL_HOST, CONTROL_PORT,
  MCP_HOST, MCP_PORT,
  TIMEOUT_MS,
};
