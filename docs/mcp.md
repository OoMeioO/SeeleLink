# MCP Server Reference

> **Last updated:** 2026-04-11
> **Port:** `9381` (HTTP + SSE)
> **Protocol:** JSON-RPC 2.0 over HTTP POST

## Overview

SeeleLink acts as an MCP (Model Context Protocol) server, allowing AI tools like OpenClaw and Claude Desktop to call its tools via MCP.

**Endpoint:** `http://127.0.0.1:9381/` (POST), `http://127.0.0.1:9381/mcp` (SSE)
**Health:** `http://127.0.0.1:9381/health`

## Configuration

### Enable MCP Server

1. Open SeeleLink → Settings tab
2. Find **MCP Server (HTTP+SSE)**
3. Check **Enabled**, configure host/port (default: `127.0.0.1:9381`)
4. Click **Save Changes**

### OpenClaw Configuration

Add to `~/.openclaw/config.json`:

```json
{
  "mcpServers": {
    "SeeleLink": {
      "url": "http://127.0.0.1:9381/"
    }
  }
}
```

Or use the **Settings → OpenClaw → Copy Config** button.

---

## MCP Tools (89 total)

Tools use `snake_case` naming. Arguments are passed as an object.

### Session / Connection Management

| Tool | Arguments | Returns | Description |
|------|-----------|--------|------------|
| `list_connections` | — | `[{type,id},...]` | List active connections |
| `ps_connect` | `{id:string}` | — | Connect PowerShell session |
| `ps_execute` | `{id,command}` | string | Execute PowerShell command |
| `ps_disconnect` | `{id}` | — | Disconnect PowerShell |
| `cmd_connect` | `{id}` | — | Connect CMD/Bash session |
| `cmd_execute` | `{id,command}` | string | Execute CMD/Bash command |
| `cmd_disconnect` | `{id}` | — | Disconnect CMD/Bash |
| `ssh_connect` | `{id,host,username,password}` | — | Connect SSH |
| `ssh_execute` | `{id,command}` | string | Execute SSH command |
| `ssh_disconnect` | `{id}` | — | Disconnect SSH |
| `serial_connect` | `{id,port,baudRate?}` | — | Connect serial port |
| `serial_execute` | `{id,data,newline?}` | string | Send data to serial |
| `serial_disconnect` | `{id}` | — | Disconnect serial |
| `serial_list` | — | `string[]` | List COM ports |
| `ws_connect` | `{id,url}` | — | Connect WebSocket |
| `ws_send` | `{id,data}` | — | Send to WebSocket |
| `ws_disconnect` | `{id}` | — | Disconnect WebSocket |

### Window Control (SeeleLink app)

| Tool | Arguments | Returns | Description |
|------|-----------|--------|------------|
| `window_minimize` | — | — | Minimize window |
| `window_maximize` | — | — | Maximize/restore window |
| `window_close` | — | — | Close window (closes app) |
| `window_is_maximized` | — | `boolean` | Check if maximized |
| `window_start_debug` | — | — | Start debug mode |
| `window_stop_debug` | — | — | Stop debug mode |
| `window_get_debug_state` | — | object | Get debug state |
| `window_capture` | — | `{png}` | Capture window as PNG |
| `window_click` | `{x,y,button?}` | `{absX,absY}` | Click at window-relative coords |
| `window_move_mouse` | `{x,y}` | `{absX,absY}` | Move cursor to window-relative coords |
| `window_send_keys` | `{keys:string[]}` | — | Send keys (e.g. `["Ctrl","a"]`) |
| `window_capture_get_config` | — | `{mode}` | Get capture config |
| `window_capture_set_config` | `{mode}` | — | Set capture mode |

### Mouse Control (absolute screen coordinates)

| Tool | Arguments | Returns | Description |
|------|-----------|--------|------------|
| `control_mouse_position` | — | `{x,y}` | Get cursor position |
| `control_mouse_move` | `{x,y}` | — | Move cursor to absolute coords |
| `control_mouse_click` | `{x,y,button?}` | — | Click at absolute coords |
| `control_mouse_doubleclick` | `{x,y}` | — | Double-click |
| `control_mouse_drag` | `{fromX,fromY,toX,toY}` | — | Drag operation |

### Keyboard Control (absolute screen coordinates)

| Tool | Arguments | Returns | Description |
|------|-----------|--------|------------|
| `control_keyboard_type` | `{text}` | — | Type text |
| `control_keyboard_press` | `{key}` | — | Press single key |
| `control_keyboard_press_keys` | `{keys}` | — | Press key combination |
| `control_keyboard_copy` | — | — | Send Ctrl+C |
| `control_keyboard_paste` | — | — | Send Ctrl+V |
| `control_keyboard_cut` | — | — | Send Ctrl+X |
| `control_keyboard_select_all` | — | — | Send Ctrl+A |

### Screen Capture (full system screen)

| Tool | Arguments | Returns | Description |
|------|-----------|--------|------------|
| `control_screen_capture` | — | `{base64,width,height,...}` | Full screen capture |
| `control_screen_capture_region` | `{x,y,width,height}` | `{base64,...}` | Capture region |
| `control_screen_capture_window` | `{bounds:{x,y,w,h}}` | `{base64,...}` | Capture window region |
| `control_screen_capture_and_save` | `{path,format?}` | — | Save to file |
| `control_screen_list` | — | `Screen[]` | List all screens |
| `control_screen_bring_to_foreground` | — | — | Bring window to front |

### Debug Log

| Tool | Arguments | Returns | Description |
|------|-----------|--------|------------|
| `control_debug_get_logs` | `{filter?}` | `Log[]` | Get recent logs |
| `control_debug_get_stats` | — | `{total,counts}` | Get log stats |
| `control_debug_clear` | — | — | Clear logs |
| `control_debug_set_level` | `{level}` | — | Set log level |
| `control_debug_export` | `{format?}` | string | Export logs |

### Android

| Tool | Arguments | Returns | Description |
|------|-----------|--------|------------|
| `android_devices` | — | `{devices:[],error?}` | List ADB devices |
| `android_scan_network` | `{timeout?}` | `Device[]` | Scan for Android devices |
| `android_get_local_ip` | — | string | Get local IP address |
| `android_get_local_ip_for_target` | `{targetIp}` | string | Get local IP for target |
| `android_execute_adb` | `{args}` | string | Execute ADB command |
| `android_adb_screenshot` | `{deviceId?}` | `{base64}` | Take ADB screenshot |

### App State

| Tool | Arguments | Returns | Description |
|------|-----------|--------|------------|
| `app_get_state` | — | object | Get app state |
| `app_get_info` | — | object | Get app metadata |
| `app_get_connections` | — | `SavedConn[]` | Get saved connections |
| `app_send_text` | `{text}` | — | Send text to focused terminal |
| `app_focus_tab` | `{tabId}` | — | Focus a tab |
| `app_get_focus` | — | object | Get focus info |
| `app_get_theme` | — | string | Get current theme |
| `app_set_theme` | `{theme}` | — | Set theme (`dark`\|`light`) |
| `app_get_zoom` | — | number | Get zoom level |
| `app_set_zoom` | `{zoom}` | — | Set zoom (percent) |
| `app_get_color_scheme` | — | string | Get color scheme |
| `app_set_color_scheme` | `{scheme}` | — | Set color scheme |
| `app_save_connection` | `{connection}` | — | Save a connection |
| `app_delete_connection` | `{id}` | — | Delete a connection |

### Config

| Tool | Arguments | Returns | Description |
|------|-----------|--------|------------|
| `control_api_get_config` | — | object | Get Control API config |
| `control_api_set_config` | `{config}` | — | Set Control API config |
| `control_api_find_available_port` | `{host}` | `{port}` | Find available port |
| `mcp_api_get_config` | — | object | Get MCP config |
| `mcp_api_set_config` | `{config}` | — | Set MCP config |
| `mcp_api_find_available_port` | `{host}` | `{port}` | Find available port |

### Session Log

| Tool | Arguments | Returns | Description |
|------|-----------|--------|------------|
| `log_get_config` | — | object | Get log config |
| `log_set_config` | `{enabled?,path?}` | — | Set log config |
| `log_get_dir` | — | string | Get log directory |
| `log_open_folder` | — | — | Open log folder |

### Plugin

| Tool | Arguments | Returns | Description |
|------|-----------|--------|------------|
| `plugin_list` | — | `Plugin[]` | List all plugins |
| `plugin_get` | `{pluginId}` | `Plugin\|null` | Get plugin info |
| `plugin_enable` | `{pluginId}` | — | Enable a plugin |
| `plugin_disable` | `{pluginId}` | — | Disable a plugin |
| `plugin_uninstall` | `{pluginId}` | — | Uninstall a plugin |
| `plugin_open_folder` | — | — | Open plugin folder |

### Dialog

| Tool | Arguments | Returns | Description |
|------|-----------|--------|------------|
| `dialog_open_directory` | — | `string\|null` | Open directory picker |

---

## JSON-RPC 2.0 Format

### Request (POST)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "window_get_bounds",
    "arguments": {}
  }
}
```

### Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{ "type": "text", "text": "..." }]
  }
}
```

### Error

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": { "code": -32600, "message": "Invalid request" }
}
```

---

## Health Check

```bash
curl http://127.0.0.1:9381/health
# -> {"status":"ok"}
```

---

## cURL Examples

```bash
# Health check
curl http://127.0.0.1:9381/health

# List tools
curl -X POST http://127.0.0.1:9381/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Call a tool
curl -X POST http://127.0.0.1:9381/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"window_is_maximized","arguments":{}}}'
```

---

## OpenClaw Usage

```javascript
// Window control
const bounds = await mcpSeeleLink.window_get_bounds();
await mcpSeeleLink.window_click({ x: 80, y: 50 });

// Mouse automation
await mcpSeeleLink.control_mouse_click({ x: 100, y: 100 });

// SSH
await mcpSeeleLink.ssh_connect({ id: 'prod', host: '10.0.0.1', username: 'admin', password: 'secret' });
const result = await mcpSeeleLink.ssh_execute({ id: 'prod', command: 'ls -la' });
```
