# SeeleLink API 参考

> **更新时间：** 2026-04-11
> **三层架构：** MCP (HTTP+SSE/9381) | Control API (TCP JSON/9380) | IPC (Electron/内部)

---

## 传输层概述

| 层 | 协议 | 默认端口 | 实现 |
|-------|----------|-------------|----------------|
| **MCP** | HTTP + SSE + POST (JSON-RPC 2.0) | 9381 | `electron/main.cjs` |
| **Control API** | TCP JSON（换行分隔）| 9380 | `electron/main.cjs` |
| **IPC** | Electron `ipcMain`/`ipcRenderer` | 内部 | `electron/main.cjs` + `controlHandlers.cjs` |

**功能列表：**
- **Control API：** 72 个命令（见 [control-api-zh.md](control-api-zh.md)）
- **MCP：** 89 个工具（见 [mcp-zh.md](mcp-zh.md)）

---

## 功能覆盖矩阵

### 状态说明

- ✅ **完整** — 在此层已实现
- ❌ **不可用** — 此层不可用

---

### 1. 会话 / 连接管理

| 功能 | MCP | Control API | IPC |
|---------|-----|-------------|-----|
| `list_connections` / `list` | ✅ | ✅ | ❌ |
| `ps_connect` | ✅ | ❌ | ✅ |
| `ps_execute` | ✅ | ✅（`ps:execute`）| ✅ |
| `ps_disconnect` | ✅ | ❌ | ✅ |
| `cmd_connect` | ✅ | ❌ | ✅ |
| `cmd_execute` | ✅ | ✅（`cmd:execute`）| ✅ |
| `cmd_disconnect` | ✅ | ❌ | ✅ |
| `cmd:ready` | ❌ | ✅ | ✅ |
| `ssh_connect` | ✅ | ❌ | ✅ |
| `ssh_execute` | ✅ | ✅（`ssh:execute`）| ✅ |
| `ssh_disconnect` | ✅ | ❌ | ✅ |
| `serial_list` | ✅ | ✅（`serial:list`）| ✅ |
| `serial_connect` | ✅ | ❌ | ✅ |
| `serial_execute` | ✅ | ✅（`serial:execute`）| ✅ |
| `serial_disconnect` | ✅ | ❌ | ✅ |
| `ws_connect` | ✅ | ❌ | ✅ |
| `ws_send` | ✅ | ❌ | ✅ |
| `ws_disconnect` | ✅ | ❌ | ✅ |

---

### 2. 鼠标控制（绝对屏幕坐标）

| 功能 | MCP | Control API | IPC |
|---------|-----|-------------|-----|
| `control_mouse_position` / `control:mouse:position` | ✅ | ✅ | ✅ |
| `control_mouse_move` / `control:mouse:move` | ✅ | ✅ | ✅ |
| `control_mouse_click` / `control:mouse:click` | ✅ | ✅ | ✅ |
| `control_mouse_doubleclick` / `control:mouse:doubleClick` | ✅ | ✅ | ✅ |
| `control_mouse_drag` / `control:mouse:drag` | ✅ | ✅ | ✅ |

---

### 3. 键盘控制（绝对屏幕坐标）

| 功能 | MCP | Control API | IPC |
|---------|-----|-------------|-----|
| `control_keyboard_type` / `control:keyboard:type` | ✅ | ✅ | ✅ |
| `control_keyboard_press` / `control:keyboard:press` | ✅ | ✅ | ✅ |
| `control_keyboard_press_keys` / `control:keyboard:pressKeys` | ✅ | ✅ | ✅ |
| `control_keyboard_copy` / `control:keyboard:copy` | ✅ | ✅ | ✅ |
| `control_keyboard_paste` / `control:keyboard:paste` | ✅ | ✅ | ✅ |
| `control_keyboard_cut` / `control:keyboard:cut` | ✅ | ✅ | ✅ |
| `control_keyboard_select_all` / `control:keyboard:selectAll` | ✅ | ✅ | ✅ |

---

### 4. 屏幕截图（完整系统屏幕）

| 功能 | MCP | Control API | IPC |
|---------|-----|-------------|-----|
| `control_screen_capture` / `control:screen:capture` | ✅ | ✅ | ✅ |
| `control_screen_capture_region` / `control:screen:captureRegion` | ✅ | ✅ | ✅ |
| `control_screen_capture_window` / `control:screen:captureWindow` | ✅ | ✅ | ✅ |
| `control_screen_capture_and_save` / `control:screen:captureAndSave` | ✅ | ✅ | ✅ |
| `control_screen_list` / `control:screen:list` | ✅ | ✅ | ✅ |
| `control_screen_bring_to_foreground` / `control:screen:bringToForeground` | ✅ | ✅ | ✅ |

---

### 5. 调试日志

| 功能 | MCP | Control API | IPC |
|---------|-----|-------------|-----|
| `control_debug_get_logs` / `control:debug:getLogs` | ✅ | ✅ | ✅ |
| `control_debug_get_stats` / `control:debug:getStats` | ✅ | ✅ | ✅ |
| `control_debug_clear` / `control:debug:clear` | ✅ | ✅ | ✅ |
| `control_debug_set_level` / `control:debug:setLevel` | ✅ | ✅ | ✅ |
| `control_debug_export` / `control:debug:export` | ✅ | ✅ | ✅ |

---

### 6. 窗口控制（SeeleLink 应用）

| 功能 | MCP | Control API | IPC |
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

### 7. 应用状态（渲染进程）

| 功能 | MCP | Control API | IPC |
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

| 功能 | MCP | Control API | IPC |
|---------|-----|-------------|-----|
| `android_devices` / `android:devices` | ✅ | ✅ | ✅ |
| `android_scan_network` / `android:scanNetwork` | ✅ | ✅ | ✅ |
| `android_get_local_ip` / `android:getLocalIp` | ✅ | ✅ | ✅ |
| `android_get_local_ip_for_target` / `android:getLocalIpForTarget` | ✅ | ✅ | ✅ |
| `android_execute_adb` / `exec:adb` | ✅ | ✅ | ✅ |
| `android_adb_screenshot` / `exec:adb:screenshot` | ✅ | ✅ | ✅ |

---

### 9. 插件

| 功能 | MCP | Control API | IPC |
|---------|-----|-------------|-----|
| `plugin_list` / `plugin:list` | ✅ | ✅ | ✅ |
| `plugin_get` / `plugin:get` | ✅ | ✅ | ✅ |
| `plugin_enable` / `plugin:enable` | ✅ | ✅ | ✅ |
| `plugin_disable` / `plugin:disable` | ✅ | ✅ | ✅ |
| `plugin_uninstall` / `plugin:uninstall` | ✅ | ✅ | ✅ |
| `plugin_getDir` / `plugin:getDir` | ❌ | ✅ | ✅ |
| `plugin_open_folder` / `plugin:openFolder` | ✅ | ✅ | ✅ |

---

### 10. 配置 / 设置

| 功能 | MCP | Control API | IPC |
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

### 11. IR（红外）

| 功能 | MCP | Control API | IPC |
|---------|-----|-------------|-----|
| `ir:load` | ✅ | ✅ | ✅ |
| `ir:save` | ✅ | ✅ | ✅ |

---

### 12. 会话 / 系统

| 功能 | MCP | Control API | IPC |
|---------|-----|-------------|-----|
| `ping` | ❌ | ✅ | ❌ |
| `health` | ❌ | ✅ | ❌ |
| `status` | ❌ | ✅ | ❌ |
| `quit` | ❌ | ✅ | ❌ |
| `control:platform:info` | ❌ | ✅ | ✅ |
| `dialog_open_directory` / `dialog:openDirectory` | ✅ | ✅ | ❌ |

---

## 命名约定

MCP 使用 `snake_case`，Control API 使用 `冒号:分隔:名称`：

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

## 测试覆盖

完整集成测试：`tests/integration/feature-coverage.test.cjs`

**结果：115 passed，0 failed，3 skipped**

运行方式：
```bash
# 先启动应用
npm run electron:dev

# 在另一个终端
node tests/integration/feature-coverage.test.cjs
```
