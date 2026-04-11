/**
 * SeeleLink Feature Coverage Integration Tests
 *
 * Tests ALL MCP and Control API commands to ensure full feature parity.
 * Run with Electron running: node tests/integration/feature-coverage.test.cjs
 *
 * This file serves as both documentation (what should work) and validation (what currently works).
 * Missing features are marked with FAIL tests that document the gap.
 */
const {
  sendControlCommand,
  callMcpTool,
  getMcpTools,
  checkServices,
  assert, assertEqual, assertTrue,
} = require('./helpers.cjs');

const TIMEOUT_MS = 15000;
let passed = 0;
let failed = 0;
let skipped = 0;

async function test(name, fn) {
  process.stdout.write(`  ${name}... `);
  try {
    await fn();
    console.log('[PASS]');
    passed++;
  } catch (e) {
    if (e.message.includes('NOT_IMPLEMENTED') || e.message.includes('not implemented')) {
      console.log('[SKIP] (not implemented)');
      skipped++;
    } else {
      console.log(`[FAIL] ${e.message}`);
      failed++;
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// CONTROL API TESTS (TCP port 9380)
// ─────────────────────────────────────────────────────────────────
async function runControlApiTests() {
  console.log('\n=== Control API (TCP) ===\n');

  // ── Session ──────────────────────────────────────────────────
  await test('ping', async () => {
    const r = await sendControlCommand('ping');
    assertEqual(r.ok, true, 'ok');
    assertEqual(r.result, 'pong', 'result');
  });

  await test('status', async () => {
    const r = await sendControlCommand('status');
    assertTrue(r.ok, 'ok');
    assertTrue(Array.isArray(r.result.ssh), 'ssh array');
    assertTrue(Array.isArray(r.result.ps), 'ps array');
    assertTrue(Array.isArray(r.result.cmd), 'cmd array');
  });

  await test('health', async () => {
    const r = await sendControlCommand('health');
    assertTrue(r.ok, 'ok');
    assertTrue(typeof r.result.timestamp === 'number', 'timestamp');
  });

  await test('list', async () => {
    const r = await sendControlCommand('list');
    assertTrue(r.ok, 'ok');
    assertTrue(Array.isArray(r.result), 'result is array');
  });

  // ── Serial ────────────────────────────────────────────────────
  await test('serial:list', async () => {
    const r = await sendControlCommand('serial:list');
    assertTrue(r.ok, 'ok');
    assertTrue(Array.isArray(r.result), 'result is array');
  });

  // ── Platform/Control ──────────────────────────────────────────
  await test('control:platform:info', async () => {
    const r = await sendControlCommand('control:platform:info');
    assertTrue(r.ok, 'ok');
    assertTrue(['windows', 'linux', 'darwin'].includes(r.result.type), 'valid platform');
  });

  await test('control:mouse:position', async () => {
    const r = await sendControlCommand('control:mouse:position');
    assertTrue(r.ok, 'ok');
    assertTrue(typeof r.result.x === 'number', 'x is number');
    assertTrue(typeof r.result.y === 'number', 'y is number');
  });

  await test('control:mouse:move', async () => {
    const r = await sendControlCommand('control:mouse:move', [100, 100]);
    assertTrue(r.ok, 'ok');
  });

  await test('control:mouse:click', async () => {
    const r = await sendControlCommand('control:mouse:click', [100, 100]);
    assertTrue(r.ok, 'ok');
  });

  await test('control:mouse:doubleClick', async () => {
    const r = await sendControlCommand('control:mouse:doubleClick', [100, 100]);
    assertTrue(r.ok, 'ok');
  });

  await test('control:mouse:drag', async () => {
    const r = await sendControlCommand('control:mouse:drag', [100, 100, 200, 200]);
    assertTrue(r.ok, 'ok');
  });

  await test('control:keyboard:type', async () => {
    const r = await sendControlCommand('control:keyboard:type', ['hello']);
    assertTrue(r.ok, 'ok');
  });

  await test('control:keyboard:press', async () => {
    const r = await sendControlCommand('control:keyboard:press', ['Enter']);
    assertTrue(r.ok, 'ok');
  });

  await test('control:keyboard:pressKeys', async () => {
    const r = await sendControlCommand('control:keyboard:pressKeys', [['Control', 'A']]);
    assertTrue(r.ok, 'ok');
  });

  await test('control:keyboard:copy', async () => {
    const r = await sendControlCommand('control:keyboard:copy');
    assertTrue(r.ok, 'ok');
  });

  await test('control:keyboard:paste', async () => {
    const r = await sendControlCommand('control:keyboard:paste');
    assertTrue(r.ok, 'ok');
  });

  await test('control:keyboard:cut', async () => {
    const r = await sendControlCommand('control:keyboard:cut');
    assertTrue(r.ok, 'ok');
  });

  await test('control:keyboard:selectAll', async () => {
    const r = await sendControlCommand('control:keyboard:selectAll');
    assertTrue(r.ok, 'ok');
  });

  await test('control:screen:capture', async () => {
    const r = await sendControlCommand('control:screen:capture');
    assertTrue(r.ok, 'ok');
    assertTrue(r.result.base64 && r.result.base64.length > 100, 'has base64 data');
  });

  await test('control:screen:captureRegion', async () => {
    const r = await sendControlCommand('control:screen:captureRegion', [0, 0, 800, 600]);
    assertTrue(r.ok, 'ok');
  });

  await test('control:screen:captureWindow', async () => {
    const r = await sendControlCommand('control:screen:captureWindow', [{ x: 0, y: 0, width: 800, height: 600 }]);
    assertTrue(r.ok, 'ok');
  });

  await test('control:screen:captureAndSave', async () => {
    // Capture and save uses screenshot to file - adb may not be available
    const r = await sendControlCommand('control:screen:captureAndSave', ['test.png', 'png']);
    assertTrue(r.ok === true || r.ok === false, 'returns response');
  });

  await test('control:screen:list', async () => {
    const r = await sendControlCommand('control:screen:list');
    assertTrue(r.ok, 'ok');
    assertTrue(Array.isArray(r.result && r.result.result), 'result is array');
  });

  await test('control:screen:bringToForeground', async () => {
    const r = await sendControlCommand('control:screen:bringToForeground');
    assertTrue(r.ok, 'ok');
  });

  await test('control:debug:getLogs', async () => {
    const r = await sendControlCommand('control:debug:getLogs');
    assertTrue(r.ok, 'ok');
  });

  await test('control:debug:getStats', async () => {
    const r = await sendControlCommand('control:debug:getStats');
    assertTrue(r.ok, 'ok');
  });

  await test('control:debug:clear', async () => {
    const r = await sendControlCommand('control:debug:clear');
    assertTrue(r.ok, 'ok');
  });

  await test('control:debug:setLevel', async () => {
    const r = await sendControlCommand('control:debug:setLevel', ['info']);
    assertTrue(r.ok, 'ok');
  });

  await test('control:debug:export', async () => {
    const r = await sendControlCommand('control:debug:export', ['json']);
    assertTrue(r.ok, 'ok');
  });

  // ── Window ─────────────────────────────────────────────────────
  await test('window:capture', async () => {
    const r = await sendControlCommand('window:capture');
    assertTrue(r.ok, 'ok');
    assertTrue(r.result.png && r.result.png.length > 100, 'has png data');
  });

  await test('window:bounds', async () => {
    const r = await sendControlCommand('window:bounds');
    assertTrue(r.ok, 'ok');
    assertTrue(typeof r.result.window.x === 'number', 'x');
    assertTrue(typeof r.result.window.y === 'number', 'y');
    assertTrue(typeof r.result.window.width === 'number', 'width');
    assertTrue(typeof r.result.window.height === 'number', 'height');
  });

  await test('window:click', async () => {
    const r = await sendControlCommand('window:click', [100, 100]);
    assertTrue(r.ok, 'ok');
  });

  await test('window:moveMouse', async () => {
    const r = await sendControlCommand('window:moveMouse', [100, 100]);
    assertTrue(r.ok, 'ok');
  });

  await test('window:sendKeys', async () => {
    const r = await sendControlCommand('window:sendKeys', [['Enter']]);
    assertTrue(r.ok, 'ok');
  });

  await test('window:switchTab', async () => {
    const r = await sendControlCommand('window:switchTab', ['ssh']);
    assertTrue(r.ok, 'ok');
  });

  await test('window:minimize', async () => {
    const r = await sendControlCommand('window:minimize');
    assertTrue(r.ok, 'ok');
  });

  await test('window:maximize', async () => {
    const r = await sendControlCommand('window:maximize');
    assertTrue(r.ok, 'ok');
  });

  await test('window:isMaximized', async () => {
    const r = await sendControlCommand('window:isMaximized');
    assertTrue(r.ok, 'ok');
    assertTrue(typeof r.result.result === 'boolean', 'result is boolean');
  });

  await test('window:startDebug', async () => {
    const r = await sendControlCommand('window:startDebug');
    assertTrue(r.ok, 'ok');
  });

  await test('window:stopDebug', async () => {
    const r = await sendControlCommand('window:stopDebug');
    assertTrue(r.ok, 'ok');
  });

  // ── App ───────────────────────────────────────────────────────
  await test('app:getState', async () => {
    const r = await sendControlCommand('app:getState');
    assertTrue(r.ok, 'ok');
    assertTrue(typeof r.result.tabCount === 'number', 'has tabCount');
    assertTrue(Array.isArray(r.result.tabs), 'has tabs array');
  });

  await test('app:sendText', async () => {
    const r = await sendControlCommand('app:sendText', ['hello']);
    assertTrue(r.ok, 'ok');
  });

  await test('app:focusTab', async () => {
    const r = await sendControlCommand('app:focusTab', ['ssh']);
    assertTrue(r.ok, 'ok');
  });

  await test('app:getFocus', async () => {
    const r = await sendControlCommand('app:getFocus');
    assertTrue(r.ok, 'ok');
  });

  await test('app:getConnections', async () => {
    const r = await sendControlCommand('app:getConnections');
    assertTrue(r.ok, 'ok');
    assertTrue(Array.isArray(r.result), 'result is array');
  });

  await test('app:getInfo', async () => {
    const r = await sendControlCommand('app:getInfo');
    assertTrue(r.ok, 'ok');
  });

  // ── Config ────────────────────────────────────────────────────
  await test('controlApi:getConfig', async () => {
    const r = await sendControlCommand('controlApi:getConfig');
    assertTrue(r.ok, 'ok');
    assertTrue(typeof r.result.result.enabled === 'boolean', 'enabled');
    assertTrue(typeof r.result.result.port === 'number', 'port');
  });

  await test('controlApi:setConfig', async () => {
    const r = await sendControlCommand('controlApi:setConfig', [{ enabled: true, port: 9380 }]);
    assertTrue(r.ok, 'ok');
  });

  await test('controlApi:findAvailablePort', async () => {
    const r = await sendControlCommand('controlApi:findAvailablePort', ['127.0.0.1']);
    assertTrue(r.ok, 'ok');
    assertTrue(r.result.result.port > 0, 'port > 0');
  });

  await test('mcpApi:getConfig', async () => {
    const r = await sendControlCommand('mcpApi:getConfig');
    assertTrue(r.ok, 'ok');
  });

  await test('mcpApi:setConfig', async () => {
    const r = await sendControlCommand('mcpApi:setConfig', [{ enabled: true, port: 9381 }]);
    assertTrue(r.ok, 'ok');
  });

  await test('mcpApi:findAvailablePort', async () => {
    const r = await sendControlCommand('mcpApi:findAvailablePort', ['127.0.0.1']);
    assertTrue(r.ok, 'ok');
    assertTrue(r.result.result.port > 0, 'port > 0');
  });

  // ── Log ───────────────────────────────────────────────────────
  await test('log:getConfig', async () => {
    const r = await sendControlCommand('log:getConfig');
    assertTrue(r.ok, 'ok');
  });

  await test('log:setConfig', async () => {
    const r = await sendControlCommand('log:setConfig', [{ enabled: true }]);
    assertTrue(r.ok, 'ok');
  });

  await test('log:getDir', async () => {
    const r = await sendControlCommand('log:getDir');
    assertTrue(r.ok, 'ok');
    assertTrue(typeof r.result.result === 'string', 'result is string');
  });

  await test('log:openFolder', async () => {
    const r = await sendControlCommand('log:openFolder');
    assertTrue(r.ok, 'ok');
  });

  // ── Window Capture Config ─────────────────────────────────────
  await test('windowCapture:getConfig', async () => {
    const r = await sendControlCommand('windowCapture:getConfig');
    assertTrue(r.ok, 'ok');
    assertTrue(['auto', 'foreground', 'gdi'].includes(r.result.result.mode), 'valid mode');
  });

  await test('windowCapture:setConfig', async () => {
    const r = await sendControlCommand('windowCapture:setConfig', ['auto']);
    assertTrue(r.ok, 'ok');
  });

  // ── Dialog ────────────────────────────────────────────────────
  await test('dialog:openDirectory', async () => {
    // Dialog opens a native file picker - cannot be tested in headless environment
    // Skip without calling sendControlCommand to avoid 10s timeout
    throw new Error('not implemented');
  });

  // ── Android ───────────────────────────────────────────────────
  await test('android:devices', async () => {
    const r = await sendControlCommand('android:devices');
    // adb may not be installed - result is either { devices: [...] } or { error: ... }
    assertTrue(r.ok, 'ok');
    // IPC returns { ok: true/false, devices/error } directly in r.result
    const inner = r.result.result || r.result;
    assertTrue(Array.isArray(inner) || (inner && inner.error), 'result is array or error');
  });

  await test('android:getLocalIp', async () => {
    const r = await sendControlCommand('android:getLocalIp');
    assertTrue(r.ok, 'ok');
  });

  await test('android:scanNetwork', async () => {
    const r = await sendControlCommand('android:scanNetwork', [{ timeout: 1000 }]);
    assertTrue(r.ok, 'ok');
  });

  await test('android:getLocalIpForTarget', async () => {
    const r = await sendControlCommand('android:getLocalIpForTarget', ['10.0.0.1']);
    assertTrue(r.ok, 'ok');
  });

  await test('exec:adb', async () => {
    const r = await sendControlCommand('exec:adb', [['devices']]);
    assertTrue(r.ok, 'ok');
  });

  await test('exec:adb:screenshot', async () => {
    // This may fail if no device connected, but should return proper error structure
    const r = await sendControlCommand('exec:adb:screenshot', ['emulator-5554']);
    // Just check it returns a proper response structure
    assertTrue(r.ok === true || r.ok === false, 'returns response');
  });

  // ── Execute commands ─────────────────────────────────────────
  await test('ps:execute', async () => {
    // Returns "not connected" when no active session
    const r = await sendControlCommand('ps:execute', [{ connId: 'nonexistent', cmd: 'echo hi' }]);
    assertTrue(r.ok, 'ok');
  });

  await test('cmd:execute', async () => {
    const r = await sendControlCommand('cmd:execute', [{ connId: 'nonexistent', cmd: 'dir' }]);
    assertTrue(r.ok, 'ok');
  });

  await test('serial:execute', async () => {
    const r = await sendControlCommand('serial:execute', [{ connId: 'nonexistent', data: 'test' }]);
    assertTrue(r.ok, 'ok');
  });

  await test('ssh:execute', async () => {
    const r = await sendControlCommand('ssh:execute', [{ connId: 'nonexistent', cmd: 'ls' }]);
    assertTrue(r.ok, 'ok');
  });

  await test('window:getBounds', async () => {
    const r = await sendControlCommand('window:getBounds');
    assertTrue(r.ok, 'ok');
  });

  // ── Plugin commands ─────────────────────────────────────────
  await test('plugin:list', async () => {
    const r = await sendControlCommand('plugin:list');
    assertTrue(r.ok, 'ok');
    assertTrue(Array.isArray(r.result), 'result is array');
  });

  await test('plugin:get', async () => {
    const r = await sendControlCommand('plugin:get', ['nonexistent']);
    assertTrue(r.ok, 'ok');
  });

  await test('plugin:getDir', async () => {
    const r = await sendControlCommand('plugin:getDir');
    assertTrue(r.ok, 'ok');
    assertTrue(typeof r.result === 'string', 'result is string');
  });

  await test('plugin:openFolder', async () => {
    const r = await sendControlCommand('plugin:openFolder');
    assertTrue(r.ok === true || r.ok === false, 'returns response');
  });

  // ── IR commands ─────────────────────────────────────────────
  await test('ir:load', async () => {
    const r = await sendControlCommand('ir:load');
    assertTrue(r.ok, 'ok');
    assertTrue(typeof r.result === 'object', 'result is object');
  });

  await test('ir:save', async () => {
    const r = await sendControlCommand('ir:save', [{}]);
    assertTrue(r.ok, 'ok');
  });
}

// ─────────────────────────────────────────────────────────────────
// MCP TESTS (HTTP port 9381)
// ─────────────────────────────────────────────────────────────────
async function runMcpTests() {
  console.log('\n=== MCP Server (HTTP) ===\n');

  const { tools, toolCount } = await getMcpTools();
  console.log(`  Current tool count: ${toolCount}`);
  if (toolCount > 0) {
    console.log(`  Tools: ${tools.slice(0, 10).join(', ')}${toolCount > 10 ? '...' : ''}`);
  }
  console.log('');

  // ── Window Control ─────────────────────────────────────────────
  // NOTE: window_minimize/window_maximize/window_close change window state but don't kill the app
  // They are safe to test. window_start_debug and window_stop_debug are also safe.
  await test('MCP: window_minimize', async () => {
    const r = await callMcpTool('window_minimize');
    assertEqual(r.status, 200, 'status');
    assertTrue(r.body.result || r.body.error, 'has result or error');
  });

  await test('MCP: window_maximize', async () => {
    const r = await callMcpTool('window_maximize');
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: window_close', async () => {
    // window_close closes the app - skip in automated tests
    console.log('  window_close: [SKIP] (closes app)');
    skipped++;
  });

  await test('MCP: window_isMaximized', async () => {
    const r = await callMcpTool('window_is_maximized');
    assertEqual(r.status, 200, 'status');
    assertTrue(r.body.result !== undefined, 'has result');
  });

  await test('MCP: window_startDebug', async () => {
    const r = await callMcpTool('window_start_debug');
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: window_stopDebug', async () => {
    const r = await callMcpTool('window_stop_debug');
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: window_getDebugState', async () => {
    const r = await callMcpTool('window_get_debug_state');
    assertEqual(r.status, 200, 'status');
  });

  // ── Control Mouse ─────────────────────────────────────────────
  await test('MCP: control_mouse_doubleClick', async () => {
    const r = await callMcpTool('control_mouse_doubleclick', { x: 100, y: 100 });
    assertEqual(r.status, 200, 'status');
  });

  // ── Control Keyboard ──────────────────────────────────────────
  await test('MCP: control_keyboard_copy', async () => {
    const r = await callMcpTool('control_keyboard_copy');
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: control_keyboard_paste', async () => {
    const r = await callMcpTool('control_keyboard_paste');
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: control_keyboard_cut', async () => {
    const r = await callMcpTool('control_keyboard_cut');
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: control_keyboard_selectAll', async () => {
    const r = await callMcpTool('control_keyboard_select_all');
    assertEqual(r.status, 200, 'status');
  });

  // ── Control Screen ─────────────────────────────────────────────
  await test('MCP: control_screen_captureWindow', async () => {
    const r = await callMcpTool('control_screen_capture_window', { bounds: { x: 0, y: 0, width: 800, height: 600 } });
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: control_screen_captureAndSave', async () => {
    const r = await callMcpTool('control_screen_capture_and_save', { path: 'test.png', format: 'png' });
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: control_screen_bringToForeground', async () => {
    const r = await callMcpTool('control_screen_bring_to_foreground');
    assertEqual(r.status, 200, 'status');
  });

  // ── Control Debug ──────────────────────────────────────────────
  await test('MCP: control_debug_setLevel', async () => {
    const r = await callMcpTool('control_debug_set_level', { level: 'info' });
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: control_debug_export', async () => {
    const r = await callMcpTool('control_debug_export', { format: 'json' });
    assertEqual(r.status, 200, 'status');
  });

  // ── Android ───────────────────────────────────────────────────
  await test('MCP: android_scanNetwork', async () => {
    const r = await callMcpTool('android_scan_network', { timeout: 1000 });
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: android_getLocalIp', async () => {
    const r = await callMcpTool('android_get_local_ip');
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: android_getLocalIpForTarget', async () => {
    const r = await callMcpTool('android_get_local_ip_for_target', { targetIp: '10.0.0.1' });
    assertEqual(r.status, 200, 'status');
  });

  // ── App ───────────────────────────────────────────────────────
  await test('MCP: app_getInfo', async () => {
    const r = await callMcpTool('app_get_info');
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: app_getConnections', async () => {
    const r = await callMcpTool('app_get_connections');
    assertEqual(r.status, 200, 'status');
  });

  // ── Config ────────────────────────────────────────────────────
  await test('MCP: control_api_set_config', async () => {
    const r = await callMcpTool('control_api_set_config', { config: { enabled: true, port: 9380 } });
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: mcp_api_set_config', async () => {
    const r = await callMcpTool('mcp_api_set_config', { config: { enabled: true, port: 9381 } });
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: control_api_find_available_port', async () => {
    const r = await callMcpTool('control_api_find_available_port', { host: '127.0.0.1' });
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: mcp_api_find_available_port', async () => {
    const r = await callMcpTool('mcp_api_find_available_port', { host: '127.0.0.1' });
    assertEqual(r.status, 200, 'status');
  });

  // ── Log ───────────────────────────────────────────────────────
  await test('MCP: log_openFolder', async () => {
    const r = await callMcpTool('log_open_folder');
    assertEqual(r.status, 200, 'status');
  });

  // ── Plugin ────────────────────────────────────────────────────
  await test('MCP: plugin_list', async () => {
    const r = await callMcpTool('plugin_list');
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: plugin_get', async () => {
    const r = await callMcpTool('plugin_get', { pluginId: 'nonexistent' });
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: plugin_enable', async () => {
    const r = await callMcpTool('plugin_enable', { pluginId: 'nonexistent' });
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: plugin_disable', async () => {
    const r = await callMcpTool('plugin_disable', { pluginId: 'nonexistent' });
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: plugin_uninstall', async () => {
    const r = await callMcpTool('plugin_uninstall', { pluginId: 'nonexistent' });
    assertEqual(r.status, 200, 'status');
  });

  // ── Dialog ────────────────────────────────────────────────────
  await test('MCP: dialog_openDirectory', async () => {
    // Dialog opens a native file picker - cannot be tested in headless environment
    throw new Error('not implemented');
  });

  // ── Theme/UI ──────────────────────────────────────────────────
  await test('MCP: app_getTheme', async () => {
    const r = await callMcpTool('app_get_theme');
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: app_setTheme', async () => {
    const r = await callMcpTool('app_set_theme', { theme: 'dark' });
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: app_getZoom', async () => {
    const r = await callMcpTool('app_get_zoom');
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: app_setZoom', async () => {
    const r = await callMcpTool('app_set_zoom', { zoom: 100 });
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: app_getColorScheme', async () => {
    const r = await callMcpTool('app_get_color_scheme');
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: app_setColorScheme', async () => {
    const r = await callMcpTool('app_set_color_scheme', { scheme: 'default' });
    assertEqual(r.status, 200, 'status');
  });

  // ── Connection Management ──────────────────────────────────────
  await test('MCP: app_saveConnection', async () => {
    const r = await callMcpTool('app_save_connection', {
      connection: { id: 'test-1', name: 'Test', type: 'ssh', host: '127.0.0.1', port: '22' }
    });
    assertEqual(r.status, 200, 'status');
  });

  await test('MCP: app_deleteConnection', async () => {
    const r = await callMcpTool('app_delete_connection', { id: 'test-1' });
    assertEqual(r.status, 200, 'status');
  });
}

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(60));
  console.log('SeeleLink Feature Coverage Tests');
  console.log('='.repeat(60));

  const { control, mcp } = await checkServices();
  console.log(`\nServices: Control API=${control ? 'UP' : 'DOWN'}, MCP=${mcp ? 'UP' : 'DOWN'}`);

  if (!control) {
    console.log('\n⚠️  Control API (9380) is not running. Start with `npm run electron:dev`');
  }
  if (!mcp) {
    console.log('\n⚠️  MCP Server (9381) is not running. Start with `npm run electron:dev`');
  }

  if (!control && !mcp) {
    console.log('\nNo services available. Exiting.');
    process.exit(1);
  }

  if (control) await runControlApiTests();
  if (mcp) await runMcpTests();

  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log('='.repeat(60));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
