const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  psConnect: (connId) => ipcRenderer.invoke('ps:connect', { connId }),
  psExecute: (connId, cmd) => ipcRenderer.invoke('ps:execute', { connId, cmd }),
  psDisconnect: (connId) => ipcRenderer.invoke('ps:disconnect', connId),
  onPsData: (connId, callback) => {
    const channel = 'ps:data:' + connId;
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_, data) => callback(data));
  },
  onPsError: (connId, callback) => {
    const channel = 'ps:error:' + connId;
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_, data) => callback(data));
  },
  
  // CMD support
  cmdConnect: (connId) => ipcRenderer.invoke('cmd:connect', { connId }),
  cmdExecute: (connId, cmd) => ipcRenderer.invoke('cmd:execute', { connId, cmd }),
  cmdDisconnect: (connId) => ipcRenderer.invoke('cmd:disconnect', connId),
  cmdReady: (connId) => ipcRenderer.invoke('cmd:ready', { connId }),
  onCmdData: (connId, callback) => {
    const channel = 'cmd:data:' + connId;
    console.log('[Preload] onCmdData setting up for:', channel);
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_, data) => {
      console.log('[Preload] onCmdData received data:', data.length);
      callback(data);
    });
  },
  
  // SSH
  sshConnect: (config) => ipcRenderer.invoke('ssh:connect', config),
  sshDisconnect: (connId) => ipcRenderer.invoke('ssh:disconnect', connId),
  sshExecute: (connId, cmd) => ipcRenderer.invoke('ssh:execute', { connId, cmd }),
  onSshData: (connId, callback) => {
    const channel = 'ssh:data:' + connId;
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_, data) => callback(data));
  },
  
  // Serial
  serialConnect: (config) => ipcRenderer.invoke('serial:connect', config),
  serialDisconnect: (connId) => ipcRenderer.invoke('serial:disconnect', connId),
  serialExecute: (connId, data) => ipcRenderer.invoke('serial:execute', { connId, data }),
  onSerialData: (connId, callback) => {
    const channel = 'serial:data:' + connId;
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_, data) => callback(data));
  },
  serialList: () => ipcRenderer.invoke('serial:list'),

  // Android
  androidConnect: (connId, deviceId) => ipcRenderer.invoke('android:connect', { connId, deviceId }),
  androidDisconnect: (connId) => ipcRenderer.invoke('android:disconnect', connId),
  androidDevices: () => ipcRenderer.invoke('android:devices'),
  androidScreenshot: (connId) => ipcRenderer.invoke('android:screenshot', connId),
  androidHierarchy: (connId) => ipcRenderer.invoke('android:hierarchy', connId),
  androidPageInfo: (connId) => ipcRenderer.invoke('android:pageinfo', connId),
  androidTap: (connId, x, y) => ipcRenderer.invoke('android:tap', { connId, x, y }),
  androidSwipe: (connId, startX, startY, endX, endY, duration) => ipcRenderer.invoke('android:swipe', { connId, startX, startY, endX, endY, duration }),
  androidText: (connId, text) => ipcRenderer.invoke('android:text', { connId, text }),
  androidKey: (connId, keycode) => ipcRenderer.invoke('android:key', { connId, keycode }),
  onAndroidData: (connId, callback) => {
    const channel = 'android:data:' + connId;
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_, data) => callback(data));
  },

  // WebSocket
  wsConnect: (connId, url) => ipcRenderer.invoke('ws:connect', { connId, url }),
  wsDisconnect: (connId) => ipcRenderer.invoke('ws:disconnect', connId),
  wsSend: (connId, data) => ipcRenderer.invoke('ws:send', { connId, data }),
  onWsData: (connId, callback) => {
    const channel = 'ws:data:' + connId;
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_, data) => callback(data));
  },
  
  // Console log forwarding
  consoleLog: (...args) => ipcRenderer.send('log', '[Console]', ...args),
  
  saveConnection: (conn) => ipcRenderer.invoke('saveConnection', conn),
  loadConnections: () => ipcRenderer.invoke('loadConnections'),
  deleteConnection: (id) => ipcRenderer.invoke('deleteConnection', id),
  saveCommands: (connId, commands) => ipcRenderer.invoke('saveCommands', connId, commands),
  loadCommands: (connId) => ipcRenderer.invoke('loadCommands', connId),

  // Control API (Settings)
  controlApiGetConfig: () => ipcRenderer.invoke('controlApi:getConfig'),
  controlApiSetConfig: (cfg) => ipcRenderer.invoke('controlApi:setConfig', cfg),
  controlApiFindAvailablePort: (host) => ipcRenderer.invoke('controlApi:findAvailablePort', { host }),

  // MCP API (Settings)
  mcpApiGetConfig: () => ipcRenderer.invoke('mcpApi:getConfig'),
  mcpApiSetConfig: (cfg) => ipcRenderer.invoke('mcpApi:setConfig', cfg),
  mcpApiFindAvailablePort: (host) => ipcRenderer.invoke('mcpApi:findAvailablePort', { host }),

  appGetInfo: () => ipcRenderer.invoke('app:getInfo'),

  // Window controls (frameless mode)
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximize: () => ipcRenderer.send('window:maximize'),
  windowClose: () => ipcRenderer.send('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // ── Window Control & Automation API ────────────────────────────────────
  // Capture screenshot, returns base64 PNG
  windowCapture: () => ipcRenderer.invoke('window:capture'),
  // Get window position and size on screen
  windowGetBounds: () => ipcRenderer.invoke('window:getBounds'),
  // Click at window-relative coordinates (x, y)
  windowClick: (x, y, button) => ipcRenderer.send('window:click', { x, y, button: button || 'left' }),

  // ADB commands
  execAdb: (args) => ipcRenderer.invoke('exec:adb', args),
  execAdbScreenshot: (deviceId) => ipcRenderer.invoke('exec:adb:screenshot', deviceId),
  // Move mouse to window-relative coordinates
  windowMoveMouse: (x, y) => ipcRenderer.send('window:moveMouse', { x, y }),
  // Switch to a specific tab (e.g., 'settings', 'ssh', 'serial', etc.)
  windowSwitchTab: (tab) => ipcRenderer.send('window:switchTab', tab),
  // Listen for tab switch events (from main process)
  onWindowSwitchTab: (callback) => {
    const ch = 'window:switchTab';
    ipcRenderer.removeAllListeners(ch);
    console.log('[Preload] Setting up onWindowSwitchTab listener');
    ipcRenderer.on(ch, (_, tab) => {
      console.log('[Preload] Received window:switchTab event:', tab);
      callback(tab);
    });
  },
  // Send keyboard keys (array of key strings)
  windowSendKeys: (keys) => ipcRenderer.send('window:sendKeys', keys),
  // Debug mode: capture all mouse/keyboard events in the window
  windowStartDebug: () => ipcRenderer.send('window:startDebug'),
  windowStopDebug: () => ipcRenderer.send('window:stopDebug'),
  // Debug event listeners
  onDebugMouseClick: (callback) => {
    const ch = 'debug:mouseClick';
    ipcRenderer.removeAllListeners(ch);
    ipcRenderer.on(ch, (_, data) => callback(data));
  },
  onDebugMouseMove: (callback) => {
    const ch = 'debug:mouseMove';
    ipcRenderer.removeAllListeners(ch);
    ipcRenderer.on(ch, (_, data) => callback(data));
  },
  onDebugKeyDown: (callback) => {
    const ch = 'debug:keyDown';
    ipcRenderer.removeAllListeners(ch);
    ipcRenderer.on(ch, (_, data) => callback(data));
  },

  // Session Log API
  logGetConfig: () => ipcRenderer.invoke('log:getConfig'),
  logSetConfig: (config) => ipcRenderer.invoke('log:setConfig', config),
  logGetDir: () => ipcRenderer.invoke('log:getDir'),
  logOpenFolder: (logId) => ipcRenderer.invoke('log:openFolder', logId),

  // Dialog
  dialogOpenDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

  // ── New Control Service API (P1) ────────────────────────────────────────
  // Mouse Control
  controlMousePosition: () => ipcRenderer.invoke('control:mouse:position'),
  controlMouseMove: (x, y) => ipcRenderer.invoke('control:mouse:move', x, y),
  controlMouseClick: (x, y, button) => ipcRenderer.invoke('control:mouse:click', x, y, button),
  controlMouseDoubleClick: (x, y) => ipcRenderer.invoke('control:mouse:doubleClick', x, y),
  controlMouseDrag: (fromX, fromY, toX, toY) => ipcRenderer.invoke('control:mouse:drag', fromX, fromY, toX, toY),
  
  // Keyboard Control
  controlKeyboardType: (text) => ipcRenderer.invoke('control:keyboard:type', text),
  controlKeyboardPress: (key) => ipcRenderer.invoke('control:keyboard:press', key),
  controlKeyboardPressKeys: (keys) => ipcRenderer.invoke('control:keyboard:pressKeys', keys),
  controlKeyboardCopy: () => ipcRenderer.invoke('control:keyboard:copy'),
  controlKeyboardPaste: () => ipcRenderer.invoke('control:keyboard:paste'),
  controlKeyboardCut: () => ipcRenderer.invoke('control:keyboard:cut'),
  controlKeyboardSelectAll: () => ipcRenderer.invoke('control:keyboard:selectAll'),
  
  // Screen Control
  controlScreenList: () => ipcRenderer.invoke('control:screen:list'),
  controlScreenCapture: (screen) => ipcRenderer.invoke('control:screen:capture', screen),
  controlScreenCaptureRegion: (x, y, width, height) => ipcRenderer.invoke('control:screen:captureRegion', x, y, width, height),
  controlScreenCaptureAndSave: (path, format) => ipcRenderer.invoke('control:screen:captureAndSave', path, format),
  
  // Debug Control
  controlDebugGetLogs: (filter) => ipcRenderer.invoke('control:debug:getLogs', filter),
  controlDebugGetStats: () => ipcRenderer.invoke('control:debug:getStats'),
  controlDebugClear: () => ipcRenderer.invoke('control:debug:clear'),
  controlDebugSetLevel: (level) => ipcRenderer.invoke('control:debug:setLevel', level),
  controlDebugExport: (format) => ipcRenderer.invoke('control:debug:export', format),
  
  // Platform Info
  controlPlatformInfo: () => ipcRenderer.invoke('control:platform:info'),

  // ── Android Network Discovery ──────────────────────────────────────────
  // Get local machine IP addresses
  androidGetLocalIp: () => ipcRenderer.invoke('android:getLocalIp'),
  // Get local IP used to reach a specific target IP
  androidGetLocalIpForTarget: (targetIp) => ipcRenderer.invoke('android:getLocalIpForTarget', targetIp),
  // Scan LAN for Android devices (port 5555 discovery)
  androidScanNetwork: (options) => ipcRenderer.invoke('android:scanNetwork', options),

  // ── IR Storage ────────────────────────────────────────────────────────
  irLoad: () => ipcRenderer.invoke('ir:load'),
  irSave: (data) => ipcRenderer.invoke('ir:save', data),

  // Window Capture Config
  windowCaptureGetConfig: () => ipcRenderer.invoke('windowCapture:getConfig'),
  windowCaptureSetConfig: (mode) => ipcRenderer.invoke('windowCapture:setConfig', { mode }),
  controlScreenCaptureWindow: (bounds) => ipcRenderer.invoke('control:screen:captureWindow', bounds),
  controlScreenBringToForeground: (hwnd) => ipcRenderer.invoke('control:screen:bringToForeground', hwnd),
});
