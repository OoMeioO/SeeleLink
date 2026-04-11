# MCP Server 参考

> **更新时间：** 2026-04-11
> **端口：** `9381`（HTTP + SSE）
> **协议：** JSON-RPC 2.0 over HTTP POST

## 概述

SeeleLink 作为 MCP（Model Context Protocol）服务器运行，允许 OpenClaw 和 Claude Desktop 等 AI 工具通过 MCP 调用其工具。

**端点：** `http://127.0.0.1:9381/`（POST）、`http://127.0.0.1:9381/mcp`（SSE）
**健康检查：** `http://127.0.0.1:9381/health`

## 配置

### 启用 MCP Server

1. 打开 SeeleLink → Settings 标签页
2. 找到 **MCP Server (HTTP+SSE)**
3. 勾选 **Enabled**，配置 host/port（默认：`127.0.0.1:9381`）
4. 点击 **Save Changes**

### OpenClaw 配置

添加到 `~/.openclaw/config.json`：

```json
{
  "mcpServers": {
    "SeeleLink": {
      "url": "http://127.0.0.1:9381/"
    }
  }
}
```

或使用 **Settings → OpenClaw → Copy Config** 按钮。

---

## MCP 工具（89 个）

工具使用 `snake_case` 命名法。参数作为对象传递。

### 会话 / 连接管理

| 工具 | 参数 | 返回 | 说明 |
|------|-----------|--------|------------|
| `list_connections` | — | `[{type,id},...]` | 列出活动连接 |
| `ps_connect` | `{id:string}` | — | 连接 PowerShell 会话 |
| `ps_execute` | `{id,command}` | string | 执行 PowerShell 命令 |
| `ps_disconnect` | `{id}` | — | 断开 PowerShell |
| `cmd_connect` | `{id}` | — | 连接 CMD/Bash 会话 |
| `cmd_execute` | `{id,command}` | string | 执行 CMD/Bash 命令 |
| `cmd_disconnect` | `{id}` | — | 断开 CMD/Bash |
| `ssh_connect` | `{id,host,username,password}` | — | 连接 SSH |
| `ssh_execute` | `{id,command}` | string | 执行 SSH 命令 |
| `ssh_disconnect` | `{id}` | — | 断开 SSH |
| `serial_connect` | `{id,port,baudRate?}` | — | 连接串口 |
| `serial_execute` | `{id,data,newline?}` | string | 向串口发送数据 |
| `serial_disconnect` | `{id}` | — | 断开串口 |
| `serial_list` | — | `string[]` | 列出 COM 端口 |
| `ws_connect` | `{id,url}` | — | 连接 WebSocket |
| `ws_send` | `{id,data}` | — | 向 WebSocket 发送 |
| `ws_disconnect` | `{id}` | — | 断开 WebSocket |

### 窗口控制（SeeleLink 应用）

| 工具 | 参数 | 返回 | 说明 |
|------|-----------|--------|------------|
| `window_minimize` | — | — | 最小化窗口 |
| `window_maximize` | — | — | 最大化/恢复窗口 |
| `window_close` | — | — | 关闭窗口（关闭应用）|
| `window_is_maximized` | — | `boolean` | 检查是否最大化 |
| `window_start_debug` | — | — | 启动调试模式 |
| `window_stop_debug` | — | — | 停止调试模式 |
| `window_get_debug_state` | — | object | 获取调试状态 |
| `window_capture` | — | `{png}` | 截取窗口为 PNG |
| `window_click` | `{x,y,button?}` | `{absX,absY}` | 在窗口相对坐标处点击 |
| `window_move_mouse` | `{x,y}` | `{absX,absY}` | 移动光标到窗口相对坐标 |
| `window_send_keys` | `{keys:string[]}` | — | 发送按键（如 `["Ctrl","a"]`）|
| `window_capture_get_config` | — | `{mode}` | 获取截图配置 |
| `window_capture_set_config` | `{mode}` | — | 设置截图模式 |

### 鼠标控制（绝对屏幕坐标）

| 工具 | 参数 | 返回 | 说明 |
|------|-----------|--------|------------|
| `control_mouse_position` | — | `{x,y}` | 获取光标位置 |
| `control_mouse_move` | `{x,y}` | — | 移动光标到绝对坐标 |
| `control_mouse_click` | `{x,y,button?}` | — | 在绝对坐标处点击 |
| `control_mouse_doubleclick` | `{x,y}` | — | 双击 |
| `control_mouse_drag` | `{fromX,fromY,toX,toY}` | — | 拖拽操作 |

### 键盘控制（绝对屏幕坐标）

| 工具 | 参数 | 返回 | 说明 |
|------|-----------|--------|------------|
| `control_keyboard_type` | `{text}` | — | 输入文本 |
| `control_keyboard_press` | `{key}` | — | 按下单个键 |
| `control_keyboard_press_keys` | `{keys}` | — | 按下组合键 |
| `control_keyboard_copy` | — | — | 发送 Ctrl+C |
| `control_keyboard_paste` | — | — | 发送 Ctrl+V |
| `control_keyboard_cut` | — | — | 发送 Ctrl+X |
| `control_keyboard_select_all` | — | — | 发送 Ctrl+A |

### 屏幕截图（完整系统屏幕）

| 工具 | 参数 | 返回 | 说明 |
|------|-----------|--------|------------|
| `control_screen_capture` | — | `{base64,width,height,...}` | 全屏截图 |
| `control_screen_capture_region` | `{x,y,width,height}` | `{base64,...}` | 截取区域 |
| `control_screen_capture_window` | `{bounds:{x,y,w,h}}` | `{base64,...}` | 截取窗口区域 |
| `control_screen_capture_and_save` | `{path,format?}` | — | 保存到文件 |
| `control_screen_list` | — | `Screen[]` | 列出所有屏幕 |
| `control_screen_bring_to_foreground` | — | — | 将窗口置于前台 |

### 调试日志

| 工具 | 参数 | 返回 | 说明 |
|------|-----------|--------|------------|
| `control_debug_get_logs` | `{filter?}` | `Log[]` | 获取最近日志 |
| `control_debug_get_stats` | — | `{total,counts}` | 获取日志统计 |
| `control_debug_clear` | — | — | 清除日志 |
| `control_debug_set_level` | `{level}` | — | 设置日志级别 |
| `control_debug_export` | `{format?}` | string | 导出日志 |

### Android

| 工具 | 参数 | 返回 | 说明 |
|------|-----------|--------|------------|
| `android_devices` | — | `{devices:[],error?}` | 列出 ADB 设备 |
| `android_scan_network` | `{timeout?}` | `Device[]` | 扫描 Android 设备 |
| `android_get_local_ip` | — | string | 获取本机 IP |
| `android_get_local_ip_for_target` | `{targetIp}` | string | 获取目标的本机 IP |
| `android_execute_adb` | `{args}` | string | 执行 ADB 命令 |
| `android_adb_screenshot` | `{deviceId?}` | `{base64}` | ADB 截图 |

### 应用状态

| 工具 | 参数 | 返回 | 说明 |
|------|-----------|--------|------------|
| `app_get_state` | — | object | 获取应用状态 |
| `app_get_info` | — | object | 获取应用元数据 |
| `app_get_connections` | — | `SavedConn[]` | 获取已保存连接 |
| `app_send_text` | `{text}` | — | 向焦点终端发送文本 |
| `app_focus_tab` | `{tabId}` | — | 聚焦标签页 |
| `app_get_focus` | — | object | 获取焦点信息 |
| `app_get_theme` | — | string | 获取当前主题 |
| `app_set_theme` | `{theme}` | — | 设置主题（`dark`\|`light`）|
| `app_get_zoom` | — | number | 获取缩放级别 |
| `app_set_zoom` | `{zoom}` | — | 设置缩放（百分比）|
| `app_get_color_scheme` | — | string | 获取配色方案 |
| `app_set_color_scheme` | `{scheme}` | — | 设置配色方案 |
| `app_save_connection` | `{connection}` | — | 保存连接 |
| `app_delete_connection` | `{id}` | — | 删除连接 |

### 配置

| 工具 | 参数 | 返回 | 说明 |
|------|-----------|--------|------------|
| `control_api_get_config` | — | object | 获取 Control API 配置 |
| `control_api_set_config` | `{config}` | — | 设置 Control API 配置 |
| `control_api_find_available_port` | `{host}` | `{port}` | 查找可用端口 |
| `mcp_api_get_config` | — | object | 获取 MCP 配置 |
| `mcp_api_set_config` | `{config}` | — | 设置 MCP 配置 |
| `mcp_api_find_available_port` | `{host}` | `{port}` | 查找可用端口 |

### 会话日志

| 工具 | 参数 | 返回 | 说明 |
|------|-----------|--------|------------|
| `log_get_config` | — | object | 获取日志配置 |
| `log_set_config` | `{enabled?,path?}` | — | 设置日志配置 |
| `log_get_dir` | — | string | 获取日志目录 |
| `log_open_folder` | — | — | 打开日志文件夹 |

### 插件

| 工具 | 参数 | 返回 | 说明 |
|------|-----------|--------|------------|
| `plugin_list` | — | `Plugin[]` | 列出所有插件 |
| `plugin_get` | `{pluginId}` | `Plugin\|null` | 获取插件信息 |
| `plugin_enable` | `{pluginId}` | — | 启用插件 |
| `plugin_disable` | `{pluginId}` | — | 禁用插件 |
| `plugin_uninstall` | `{pluginId}` | — | 卸载插件 |
| `plugin_open_folder` | — | — | 打开插件文件夹 |

### 对话框

| 工具 | 参数 | 返回 | 说明 |
|------|-----------|--------|------------|
| `dialog_open_directory` | — | `string\|null` | 打开目录选择器 |

---

## JSON-RPC 2.0 格式

### 请求（POST）

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

### 响应

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{ "type": "text", "text": "..." }]
  }
}
```

### 错误

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": { "code": -32600, "message": "Invalid request" }
}
```

---

## 健康检查

```bash
curl http://127.0.0.1:9381/health
# -> {"status":"ok"}
```

---

## cURL 示例

```bash
# 健康检查
curl http://127.0.0.1:9381/health

# 列出工具
curl -X POST http://127.0.0.1:9381/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# 调用工具
curl -X POST http://127.0.0.1:9381/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"window_is_maximized","arguments":{}}}'
```

---

## OpenClaw 使用

```javascript
// 窗口控制
const bounds = await mcpSeeleLink.window_get_bounds();
await mcpSeeleLink.window_click({ x: 80, y: 50 });

// 鼠标自动化
await mcpSeeleLink.control_mouse_click({ x: 100, y: 100 });

// SSH
await mcpSeeleLink.ssh_connect({ id: 'prod', host: '10.0.0.1', username: 'admin', password: 'secret' });
const result = await mcpSeeleLink.ssh_execute({ id: 'prod', command: 'ls -la' });
```
