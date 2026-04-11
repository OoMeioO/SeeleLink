# SeeleLink API Reference

> **Last updated:** 2026-04-11
> **Three layers:** MCP (HTTP+SSE/9381) | Control API (TCP JSON/9380) | IPC (Electron/internal)

---

## Transport Overview

| Layer | Protocol | Default Port | Implementation |
|-------|----------|-------------|----------------|
| **MCP** | HTTP + SSE + POST (JSON-RPC 2.0) | 9381 | `electron/main.cjs` |
| **Control API** | TCP JSON (newline-delimited) | 9380 | `electron/main.cjs` |
| **IPC** | Electron `ipcMain`/`ipcRenderer` | internal | `electron/main.cjs` + `controlHandlers.cjs` |

**Full feature list:**
- **Control API:** 72 commands (see [control-api.md](control-api.md))
- **MCP:** 89 tools (see [mcp.md](mcp.md))

---

## Feature Coverage Matrix

### Status Legend

- ✅ **Complete** — implemented on this layer
- ❌ **Not available** — not available on this layer

---

### 1. Session / Connection Management

| Feature | MCP | Control API | IPC |
|---------|-----|-------------|-----|
| `list_connections` / `list` | ✅ | ✅ | ❌ |
| `ps_connect` | ✅ | ❌ | ✅ |
| `ps_execute` | ✅ | ✅ (`ps:execute`) | ✅ |
| `ps_disconnect` | ✅ | ❌ | ✅ |
| `cmd_connect` | ✅ | ❌ | ✅ |
| `cmd_execute` | ✅ | ✅ (`cmd:execute`) | ✅ |
| `cmd_disconnect` | ✅ | ❌ | ✅ |
| `cmd:ready` | ❌ | ✅ | ✅ |
| `ssh_connect` | ✅ | ❌ | ✅ |
| `ssh_execute` | ✅ | ✅ (`ssh:execute`) | ✅ |
| `ssh_disconnect` | ✅ | ❌ | ✅ |
| `serial_list` | ✅ | ✅ (`serial:list`) | ✅ |
| `serial_connect` | ✅ | ❌ | ✅ |
| `serial_execute` | ✅ | ✅ (`serial:execute`) | ✅ |
| `serial_disconnect` | ✅ | ❌ | ✅ |
| `ws_connect` | ✅ | ❌ | ✅ |
| `ws_send` | ✅ | ❌ | ✅ |
| `ws_disconnect` | ✅ | ❌ | ✅ |

---

### 2. Mouse Control (absolute screen coordinates)

| Feature | MCP | Control API | IPC |
|---------|-----|-------------|-----|
| `control_mouse_position` / `control:mouse:position` | ✅ | ✅ | ✅ |
| `control_mouse_move` / `control:mouse:move` | ✅ | ✅ | ✅ |
| `control_mouse_click` / `control:mouse:click` | ✅ | ✅ | ✅ |
| `control_mouse_doubleclick` / `control:mouse:doubleClick` | ✅ | ✅ | ✅ |
| `control_mouse_drag` / `control:mouse:drag` | ✅ | ✅ | ✅ |

---

### 3. Keyboard Control (absolute screen coordinates)

| Feature | MCP | Control API | IPC |
|---------|-----|-------------|-----|
| `control_keyboard_type` / `control:keyboard:type` | ✅ | ✅ | ✅ |
| `control_keyboard_press` / `control:keyboard:press` | ✅ | ✅ | ✅ |
| `control_keyboard_press_keys` / `control:keyboard:pressKeys` | ✅ | ✅ | ✅ |
| `control_keyboard_copy` / `control:keyboard:copy` | ✅ | ✅ | ✅ |
| `control_keyboard_paste` / `control:keyboard:paste` | ✅ | ✅ | ✅ |
| `control_keyboard_cut` / `control:keyboard:cut` | ✅ | ✅ | ✅ |
| `control_keyboard_select_all` / `control:keyboard:selectAll` | ✅ | ✅ | ✅ |

---

### 4. Screen Capture (full system screen)

| Feature | MCP | Control API | IPC |
|---------|-----|-------------|-----|
| `control_screen_capture` / `control:screen:capture` | ✅ | ✅ | ✅ |
| `control_screen_capture_region` / `control:screen:captureRegion` | ✅ | ✅ | ✅ |
| `control_screen_capture_window` / `control:screen:captureWindow` | ✅ | ✅ | ✅ |
| `control_screen_capture_and_save` / `control:screen:captureAndSave` | ✅ | ✅ | ✅ |
| `control_screen_list` / `control:screen:list` | ✅ | ✅ | ✅ |
| `control_screen_bring_to_foreground` / `control:screen:bringToForeground` | ✅ | ✅ | ✅ |

---

### 5. Debug Log

| Feature | MCP | Control API | IPC |
|---------|-----|-------------|-----|
| `control_debug_get_logs` / `control:debug:getLogs` | ✅ | ✅ | ✅ |
| `control_debug_get_stats` / `control:debug:getStats` | ✅ | ✅ | ✅ |
| `control_debug_clear` / `control:debug:clear` | ✅ | ✅ | ✅ |
| `control_debug_set_level` / `control:debug:setLevel` | ✅ | ✅ | ✅ |
| `control_debug_export` / `control:debug:export` | ✅ | ✅ | ✅ |

---

### 6. Window Control (SeeleLink app)

| Feature | MCP | Control API | IPC |
|---------|-----|-------------|-----|
| `window_minimize` / `window:minimize` | ✅ | ✅ | ✅ |
| `window_maximize` / `window:maximize` | ✅ | ✅ | ✅ |
| `window_close` / `window:close` | ✅ | ❌ | ✅ |
| `window_is_maximized` / `window:isMaximized` | ✅ | ✅ | ✅ |
| `window_start_debug` / `window:startDebug` | ✅ | ✅ | ✅ |
| `window_stop_debug` / `window:stopDebug` | ✅ | ✅ | ✅ |
| `window_get_debug_state` | ✅ | ❌ | ❌ |
| `window_capture` / `window:capture` | ✅ | ✅ | ✅ |
| `window_get_bounds` / `window:bounds` / `window:getBounds` | ✅ | ✅ | ✅ |
| `window_click` / `window:click` | ✅ | ✅ | ✅ |
| `window_move_mouse` / `window:moveMouse` | ✅ | ✅ | ✅ |
| `window_send_keys` / `window:sendKeys` | ✅ | ✅ | ✅ |
| `window_switchTab` / `window:switchTab` | ❌ | ✅ | ✅ |
| `window_capture_get_config` / `windowCapture:getConfig` | ✅ | ✅ | ✅ |
| `window_capture_set_config` / `windowCapture:setConfig` | ✅ | ✅ | ✅ |

---

### 7. App State (renderer process)

| Feature | MCP | Control API | IPC |
|---------|-----|-------------|-----|
| `app_get_state` / `app:getState` | ✅ | ✅ | ❌ |
| `app_get_info` / `app:getInfo` | ✅ | ✅ | ✅ |
| `app_get_connections` / `app:getConnections` | ✅ | ✅ | ❌ |
| `app_send_text` / `app:sendText` | ✅ | ✅ | ❌ |
| `app_focus_tab` / `app:focusTab` | ✅ | ✅ | ❌ |
| `app_get_focus` / `app:getFocus` | ✅ | ✅ | ❌ |
| `app_get_theme` / `app:setTheme` | ✅ | ❌ | ❌ |
| `app_set_theme` | ✅ | ❌ | ❌ |
| `app_get_zoom` / `app:setZoom` | ✅ | ❌ | ❌ |
| `app_get_color_scheme` / `app:setColorScheme` | ✅ | ❌ | ❌ |
| `app_save_connection` / `app:deleteConnection` | ✅ | ❌ | ❌ |

---

### 8. Android

| Feature | MCP | Control API | IPC |
|---------|-----|-------------|-----|
| `android_devices` / `android:devices` | ✅ | ✅ | ✅ |
| `android_scan_network` / `android:scanNetwork` | ✅ | ✅ | ✅ |
| `android_get_local_ip` / `android:getLocalIp` | ✅ | ✅ | ✅ |
| `android_get_local_ip_for_target` / `android:getLocalIpForTarget` | ✅ | ✅ | ✅ |
| `android_execute_adb` / `exec:adb` | ✅ | ✅ | ✅ |
| `android_adb_screenshot` / `exec:adb:screenshot` | ✅ | ✅ | ✅ |

---

### 9. Plugin

| Feature | MCP | Control API | IPC |
|---------|-----|-------------|-----|
| `plugin_list` / `plugin:list` | ✅ | ✅ | ✅ |
| `plugin_get` / `plugin:get` | ✅ | ✅ | ✅ |
| `plugin_enable` | ✅ | ❌ | ❌ |
| `plugin_disable` | ✅ | ❌ | ❌ |
| `plugin_uninstall` | ✅ | ❌ | ❌ |
| `plugin_getDir` / `plugin:getDir` | ❌ | ✅ | ✅ |
| `plugin_open_folder` / `plugin:openFolder` | ✅ | ✅ | ✅ |

---

### 10. Config / Settings

| Feature | MCP | Control API | IPC |
|---------|-----|-------------|-----|
| `control_api_get_config` / `controlApi:getConfig` | ✅ | ✅ | ✅ |
| `control_api_set_config` / `controlApi:setConfig` | ✅ | ✅ | ✅ |
| `control_api_find_available_port` / `controlApi:findAvailablePort` | ✅ | ✅ | ✅ |
| `mcp_api_get_config` / `mcpApi:getConfig` | ✅ | ✅ | ✅ |
| `mcp_api_set_config` / `mcpApi:setConfig` | ✅ | ✅ | ✅ |
| `mcp_api_find_available_port` / `mcpApi:findAvailablePort` | ✅ | ✅ | ✅ |
| `log_get_config` / `log:getConfig` | ✅ | ✅ | ✅ |
| `log_set_config` / `log:setConfig` | ✅ | ✅ | ✅ |
| `log_get_dir` / `log:getDir` | ✅ | ✅ | ✅ |
| `log_open_folder` / `log:openFolder` | ✅ | ✅ | ✅ |

---

### 11. IR (Infrared)

| Feature | MCP | Control API | IPC |
|---------|-----|-------------|-----|
| `ir:load` | ✅ | ✅ | ✅ |
| `ir:save` | ✅ | ✅ | ✅ |

---

### 12. Session / System

| Feature | MCP | Control API | IPC |
|---------|-----|-------------|-----|
| `ping` | ❌ | ✅ | ❌ |
| `health` | ❌ | ✅ | ❌ |
| `status` | ❌ | ✅ | ❌ |
| `quit` | ❌ | ✅ | ❌ |
| `control:platform:info` | ❌ | ✅ | ✅ |
| `dialog_open_directory` / `dialog:openDirectory` | ✅ | ✅ | ❌ |

---

## Naming Convention

MCP uses `snake_case`, Control API uses `colon:separated:names`:

| Control API | MCP |
|------------|-----|
| `window:minimize` | `window_minimize` |
| `control:mouse:position` | `control_mouse_position` |
| `control:keyboard:copy` | `control_keyboard_copy` |
| `control:screen:capture` | `control_screen_capture` |
| `control:debug:getLogs` | `control_debug_get_logs` |
| `android:devices` | `android_devices` |
| `plugin:list` | `plugin_list` |
| `ssh:execute` | `ssh_execute` |
| `serial:list` | `serial_list` |

---

## Test Coverage

Full integration tests: `tests/integration/feature-coverage.test.cjs`

**Results: 115 passed, 0 failed, 3 skipped**

To run:
```bash
# Start the app first
npm run electron:dev

# In another terminal
node tests/integration/feature-coverage.test.cjs
```
