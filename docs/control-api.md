# Control API Reference

> **Last updated:** 2026-04-11
> **Port:** `9380` (TCP JSON, newline-delimited)

## Overview

The Control API is a TCP JSON server that allows external programs to fully control SeeleLink. It listens on `127.0.0.1:9380` by default (configurable via Settings).

**Protocol:** JSON over TCP, one JSON object per line (newline-terminated)

**Request format:**
```json
{"cmd":"command:name","args":[arg1,arg2]}
```

**Response format:**
```json
{"ok":true,"result":<value>}   // Success
{"ok":false,"error":"message"} // Error
```

---

## Command Reference

### Session

| Command | Args | Description |
|---------|------|-------------|
| `ping` | — | Test connection, returns `"pong"` |
| `status` | — | Get all connection statuses `{ssh:[...],ps:[...],cmd:[...]}` |
| `health` | — | Health check, returns `{timestamp}` |
| `list` | — | List active connections `[{type,id},...]` |

### Platform Control

| Command | Args | Description |
|---------|------|-------------|
| `control:platform:info` | — | Platform info `{type:"windows\|linux\|darwin",...}` |

### Mouse Control (absolute screen coordinates)

| Command | Args | Description |
|---------|------|-------------|
| `control:mouse:position` | — | Get cursor position `{x,y}` |
| `control:mouse:move` | `[x, y]` | Move cursor to absolute coordinates |
| `control:mouse:click` | `[x, y, button?]` | Click at coordinates (button: `left`\|`right`, default `left`) |
| `control:mouse:doubleClick` | `[x, y]` | Double-click at coordinates |
| `control:mouse:drag` | `[fromX, fromY, toX, toY]` | Drag from one position to another |

### Keyboard Control (absolute screen coordinates)

| Command | Args | Description |
|---------|------|-------------|
| `control:keyboard:type` | `[text]` | Type text string (max 1000 chars) |
| `control:keyboard:press` | `[key]` | Press a single key (`Enter`, `Escape`, `Tab`, `Backspace`, `Delete`, `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Home`, `End`, `PageUp`, `PageDown`) |
| `control:keyboard:pressKeys` | `[[key1,key2,...]]` | Press combination keys (e.g. `["Control","A"]`) |
| `control:keyboard:copy` | — | Send Ctrl+C |
| `control:keyboard:paste` | — | Send Ctrl+V |
| `control:keyboard:cut` | — | Send Ctrl+X |
| `control:keyboard:selectAll` | — | Send Ctrl+A |

### Screen Capture (full system screen)

| Command | Args | Description |
|---------|------|-------------|
| `control:screen:capture` | — | Full screen capture, returns `{base64,width,height,format:"png",timestamp,screen:"primary"}` |
| `control:screen:captureRegion` | `[x, y, width, height]` | Capture a screen region |
| `control:screen:captureWindow` | `[{x,y,width,height}]` | Capture a specific window region |
| `control:screen:captureAndSave` | `[path, format?]` | Save capture to file (`format`: `png`\|`jpg`, default `png`) |
| `control:screen:list` | — | List all screens/displays |
| `control:screen:bringToForeground` | — | Bring SeeleLink window to foreground |

### Debug Log

| Command | Args | Description |
|---------|------|-------------|
| `control:debug:getLogs` | `[{level?}]` | Get recent logs (optional filter by `level`) |
| `control:debug:getStats` | — | Get log statistics `{total,counts:{debug,info,warn,error}}` |
| `control:debug:clear` | — | Clear all logs |
| `control:debug:setLevel` | `[level]` | Set log level (`debug`\|`info`\|`warn`\|`error`) |
| `control:debug:export` | `[format?]` | Export logs (`json`\|`text`, default `json`) |

### Window Control (SeeleLink app window)

| Command | Args | Description |
|---------|------|-------------|
| `window:capture` | — | Capture SeeleLink window as PNG `{png:"<base64>"}` |
| `window:bounds` | — | Get window bounds `{window:{x,y,width,height},content:{x,y,width,height},titleBarOffset}` |
| `window:click` | `[x, y]` | Click at window-relative coordinates |
| `window:moveMouse` | `[x, y]` | Move cursor to window-relative coordinates |
| `window:sendKeys` | `[[key1,key2,...]]` | Send key(s) to the window |
| `window:switchTab` | `[tabId]` | Switch to tab (`ssh`\|`serial`\|`ps`\|`cmd`\|`ws`\|`android`\|`ir`\|`settings`) |
| `window:minimize` | — | Minimize the window |
| `window:maximize` | — | Maximize or restore the window |
| `window:isMaximized` | — | Check if window is maximized `{result:true\|false}` |
| `window:startDebug` | — | Start debug mouse/keyboard mode |
| `window:stopDebug` | — | Stop debug mode |
| `window:getBounds` | — | Get window and content bounds (same as `window:bounds`) |

### App State (renderer process)

| Command | Args | Description |
|---------|------|-------------|
| `app:getState` | — | Get app state `{tabCount,tabs,[connection info]}` |
| `app:sendText` | `[text]` | Send text to the focused terminal |
| `app:focusTab` | `[tabId]` | Focus a specific tab |
| `app:getFocus` | — | Get focused element info |
| `app:getConnections` | — | Get all saved connections |
| `app:getInfo` | — | Get app info `{version,platform,electron,...}` |

### Control API Config

| Command | Args | Description |
|---------|------|-------------|
| `controlApi:getConfig` | — | Get Control API server config `{enabled,host,port}` |
| `controlApi:setConfig` | `[{enabled,host,port}]` | Set Control API server config |
| `controlApi:findAvailablePort` | `[host]` | Find an available port on host |

### MCP Config

| Command | Args | Description |
|---------|------|-------------|
| `mcpApi:getConfig` | — | Get MCP server config |
| `mcpApi:setConfig` | `[{enabled,host,port}]` | Set MCP server config |
| `mcpApi:findAvailablePort` | `[host]` | Find an available port |

### Session Log

| Command | Args | Description |
|---------|------|-------------|
| `log:getConfig` | — | Get session log config |
| `log:setConfig` | `[{enabled}]` | Set session log config |
| `log:getDir` | — | Get log directory path |
| `log:openFolder` | — | Open log folder in file explorer |

### Window Capture Config

| Command | Args | Description |
|---------|------|-------------|
| `windowCapture:getConfig` | — | Get window capture config `{mode:"auto"\|"foreground"\|"gdi"}` |
| `windowCapture:setConfig` | `[mode]` | Set window capture mode |

### Serial

| Command | Args | Description |
|---------|------|-------------|
| `serial:list` | — | List available COM ports |
| `serial:execute` | `[{connId,data}]` | Send data to serial connection |

### PowerShell

| Command | Args | Description |
|---------|------|-------------|
| `ps:execute` | `[{connId,cmd}]` | Execute PowerShell command on active session |

### CMD/Bash

| Command | Args | Description |
|---------|------|-------------|
| `cmd:execute` | `[{connId,cmd}]` | Execute CMD/Bash command on active session |
| `cmd:ready` | `[{connId}]` | Check if CMD session is ready |

### SSH

| Command | Args | Description |
|---------|------|-------------|
| `ssh:execute` | `[{connId,cmd}]` | Execute SSH command on active session |

### Android

| Command | Args | Description |
|---------|------|-------------|
| `android:devices` | — | List ADB devices |
| `android:getLocalIp` | — | Get local IP address |
| `android:scanNetwork` | `[{timeout}]` | Scan network for Android devices |
| `android:getLocalIpForTarget` | `[targetIp]` | Get local IP for specific target |

### ADB Execution

| Command | Args | Description |
|---------|------|-------------|
| `exec:adb` | `[[args...]]` | Execute ADB command (e.g. `["devices"]`) |
| `exec:adb:screenshot` | `[deviceId]` | Take screenshot via ADB |

### Plugin

| Command | Args | Description |
|---------|------|-------------|
| `plugin:list` | — | List all plugins `[{id,name,version,type,description,enabled}]` |
| `plugin:get` | `[pluginId]` | Get plugin info by ID |
| `plugin:getDir` | — | Get plugin directory path |
| `plugin:openFolder` | — | Open plugin folder in file explorer |

### IR (Infrared)

| Command | Args | Description |
|---------|------|-------------|
| `ir:load` | — | Load IR configuration |
| `ir:save` | `[data]` | Save IR configuration |

### Dialog

| Command | Args | Description |
|---------|------|-------------|
| `dialog:openDirectory` | — | Open native directory picker (UI interaction) |

---

## Usage Examples

### Node.js

```javascript
const net = require('net');

function sendCommand(cmd, args = []) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let data = '';
    const timer = setTimeout(() => { client.destroy(); reject(new Error('timeout')); }, 10000);
    client.connect(9380, '127.0.0.1', () => {
      client.write(JSON.stringify({ cmd, args }) + '\n');
    });
    client.on('data', (chunk) => {
      data += chunk.toString();
      const idx = data.indexOf('\n');
      if (idx === -1) return;
      clearTimeout(timer);
      resolve(JSON.parse(data.substring(0, idx)));
    });
    client.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

// Examples:
const r1 = await sendCommand('ping');              // {ok:true, result:"pong"}
const r2 = await sendCommand('control:mouse:position'); // {ok:true, result:{x,y}}
const r3 = await sendCommand('control:screen:capture'); // {ok:true, result:{base64,...}}
const r4 = await sendCommand('plugin:list');       // {ok:true, result:[...]}
```

### PowerShell

```powershell
node -e "const net=require('net');const c=new net.Socket();c.connect(9380,'127.0.0.1',()=>{c.write(JSON.stringify({cmd:'window:bounds'})+'\n');});c.on('data',d=>{console.log(d.toString());c.end();});"
```
