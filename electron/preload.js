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
  onCmdData: (connId, callback) => {
    const channel = 'cmd:data:' + connId;
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_, data) => callback(data));
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
});
