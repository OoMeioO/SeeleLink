# Control API 参考

> **更新时间：** 2026-04-11
> **端口：** `9380`（TCP JSON，换行分隔）

## 概述

Control API 是一个 TCP JSON 服务器，允许外部程序完全控制 SeeleLink。默认监听 `127.0.0.1:9380`（可通过设置配置）。

**协议：** TCP JSON，每行一个 JSON 对象（换行终止）

**请求格式：**
```json
{"cmd":"command:name","args":[arg1,arg2]}
```

**响应格式：**
```json
{"ok":true,"result":<value>}   // 成功
{"ok":false,"error":"message"} // 错误
```

---

## 命令参考

### 会话

| 命令 | 参数 | 说明 |
|---------|------|-------------|
| `ping` | — | 测试连接，返回 `"pong"` |
| `status` | — | 获取所有连接状态 `{ssh:[...],ps:[...],cmd:[...]}` |
| `health` | — | 健康检查，返回 `{timestamp}` |
| `list` | — | 列出活动连接 `[{type,id},...]` |

### 平台控制

| 命令 | 参数 | 说明 |
|---------|------|-------------|
| `control:platform:info` | — | 平台信息 `{type:"windows\|linux\|darwin",...}` |

### 鼠标控制（绝对屏幕坐标）

| 命令 | 参数 | 说明 |
|---------|------|-------------|
| `control:mouse:position` | — | 获取光标位置 `{x,y}` |
| `control:mouse:move` | `[x, y]` | 移动光标到绝对坐标 |
| `control:mouse:click` | `[x, y, button?]` | 在坐标处点击（button: `left`\|`right`，默认 `left`）|
| `control:mouse:doubleClick` | `[x, y]` | 在坐标处双击 |
| `control:mouse:drag` | `[fromX, fromY, toX, toY]` | 从一个位置拖拽到另一个位置 |

### 键盘控制（绝对屏幕坐标）

| 命令 | 参数 | 说明 |
|---------|------|-------------|
| `control:keyboard:type` | `[text]` | 输入文本字符串（最多 1000 字符）|
| `control:keyboard:press` | `[key]` | 按下单个键（`Enter`、`Escape`、`Tab`、`Backspace`、`Delete`、`ArrowUp`、`ArrowDown`、`ArrowLeft`、`ArrowRight`、`Home`、`End`、`PageUp`、`PageDown`）|
| `control:keyboard:pressKeys` | `[[key1,key2,...]]` | 按下组合键（如 `["Control","A"]`）|
| `control:keyboard:copy` | — | 发送 Ctrl+C |
| `control:keyboard:paste` | — | 发送 Ctrl+V |
| `control:keyboard:cut` | — | 发送 Ctrl+X |
| `control:keyboard:selectAll` | — | 发送 Ctrl+A |

### 屏幕截图（完整系统屏幕）

| 命令 | 参数 | 说明 |
|---------|------|-------------|
| `control:screen:capture` | — | 全屏截图，返回 `{base64,width,height,format:"png",timestamp,screen:"primary"}` |
| `control:screen:captureRegion` | `[x, y, width, height]` | 截取屏幕区域 |
| `control:screen:captureWindow` | `[{x,y,width,height}]` | 截取特定窗口区域 |
| `control:screen:captureAndSave` | `[path, format?]` | 保存截图到文件（`format`：`png`\|`jpg`，默认 `png`）|
| `control:screen:list` | — | 列出所有屏幕/显示器 |
| `control:screen:bringToForeground` | — | 将 SeeleLink 窗口置于前台 |

### 调试日志

| 命令 | 参数 | 说明 |
|---------|------|-------------|
| `control:debug:getLogs` | `[{level?}]` | 获取最近日志（可选按 `level` 过滤）|
| `control:debug:getStats` | — | 获取日志统计 `{total,counts:{debug,info,warn,error}}` |
| `control:debug:clear` | — | 清除所有日志 |
| `control:debug:setLevel` | `[level]` | 设置日志级别（`debug`\|`info`\|`warn`\|`error`）|
| `control:debug:export` | `[format?]` | 导出日志（`json`\|`text`，默认 `json`）|

### 窗口控制（SeeleLink 应用窗口）

| 命令 | 参数 | 说明 |
|---------|------|-------------|
| `window:capture` | — | 截取 SeeleLink 窗口为 PNG `{png:"<base64>"}` |
| `window:bounds` | — | 获取窗口边界 `{window:{x,y,width,height},content:{x,y,width,height},titleBarOffset}` |
| `window:click` | `[x, y]` | 在窗口相对坐标处点击 |
| `window:moveMouse` | `[x, y]` | 移动光标到窗口相对坐标 |
| `window:sendKeys` | `[[key1,key2,...]]` | 向窗口发送按键 |
| `window:switchTab` | `[tabId]` | 切换到标签页（`ssh`\|`serial`\|`ps`\|`cmd`\|`ws`\|`android`\|`ir`\|`settings`）|
| `window:minimize` | — | 最小化窗口 |
| `window:maximize` | — | 最大化或恢复窗口 |
| `window:isMaximized` | — | 检查窗口是否最大化 `{result:true\|false}` |
| `window:startDebug` | — | 启动调试鼠标/键盘模式 |
| `window:stopDebug` | — | 停止调试模式 |
| `window:getBounds` | — | 获取窗口和内容边界（与 `window:bounds` 相同）|

### 应用状态（渲染进程）

| 命令 | 参数 | 说明 |
|---------|------|-------------|
| `app:getState` | — | 获取应用状态 `{tabCount,tabs,[connection info]}` |
| `app:sendText` | `[text]` | 向焦点终端发送文本 |
| `app:focusTab` | `[tabId]` | 聚焦特定标签页 |
| `app:getFocus` | — | 获取焦点元素信息 |
| `app:getConnections` | — | 获取所有已保存连接 |
| `app:getInfo` | — | 获取应用信息 `{version,platform,electron,...}` |

### Control API 配置

| 命令 | 参数 | 说明 |
|---------|------|-------------|
| `controlApi:getConfig` | — | 获取 Control API 服务器配置 `{enabled,host,port}` |
| `controlApi:setConfig` | `[{enabled,host,port}]` | 设置 Control API 服务器配置 |
| `controlApi:findAvailablePort` | `[host]` | 在主机上查找可用端口 |

### MCP 配置

| 命令 | 参数 | 说明 |
|---------|------|-------------|
| `mcpApi:getConfig` | — | 获取 MCP 服务器配置 |
| `mcpApi:setConfig` | `[{enabled,host,port}]` | 设置 MCP 服务器配置 |
| `mcpApi:findAvailablePort` | `[host]` | 查找可用端口 |

### 会话日志

| 命令 | 参数 | 说明 |
|---------|------|-------------|
| `log:getConfig` | — | 获取会话日志配置 |
| `log:setConfig` | `[{enabled}]` | 设置会话日志配置 |
| `log:getDir` | — | 获取日志目录路径 |
| `log:openFolder` | — | 在文件资源管理器中打开日志文件夹 |

### 窗口截图配置

| 命令 | 参数 | 说明 |
|---------|------|-------------|
| `windowCapture:getConfig` | — | 获取窗口截图配置 `{mode:"auto"\|"foreground"\|"gdi"}` |
| `windowCapture:setConfig` | `[mode]` | 设置窗口截图模式 |

### Serial

| 命令 | 参数 | 说明 |
|---------|------|-------------|
| `serial:list` | — | 列出可用 COM 端口 |
| `serial:execute` | `[{connId,data}]` | 向串口连接发送数据 |

### PowerShell

| 命令 | 参数 | 说明 |
|---------|------|-------------|
| `ps:execute` | `[{connId,cmd}]` | 在活动会话上执行 PowerShell 命令 |

### CMD/Bash

| 命令 | 参数 | 说明 |
|---------|------|-------------|
| `cmd:execute` | `[{connId,cmd}]` | 在活动会话上执行 CMD/Bash 命令 |
| `cmd:ready` | `[{connId}]` | 检查 CMD 会话是否就绪 |

### SSH

| 命令 | 参数 | 说明 |
|---------|------|-------------|
| `ssh:execute` | `[{connId,cmd}]` | 在活动会话上执行 SSH 命令 |

### Android

| 命令 | 参数 | 说明 |
|---------|------|-------------|
| `android:devices` | — | 列出 ADB 设备 |
| `android:getLocalIp` | — | 获取本机 IP 地址 |
| `android:scanNetwork` | `[{timeout}]` | 扫描网络上的 Android 设备 |
| `android:getLocalIpForTarget` | `[targetIp]` | 获取特定目标的本机 IP |

### ADB 执行

| 命令 | 参数 | 说明 |
|---------|------|-------------|
| `exec:adb` | `[[args...]]` | 执行 ADB 命令（如 `["devices"]`）|
| `exec:adb:screenshot` | `[deviceId]` | 通过 ADB 截图 |

### 插件

| 命令 | 参数 | 说明 |
|---------|------|-------------|
| `plugin:list` | — | 列出所有插件 `[{id,name,version,type,description,enabled}]` |
| `plugin:get` | `[pluginId]` | 通过 ID 获取插件信息 |
| `plugin:getDir` | — | 获取插件目录路径 |
| `plugin:openFolder` | — | 在文件资源管理器中打开插件文件夹 |

### IR（红外）

| 命令 | 参数 | 说明 |
|---------|------|-------------|
| `ir:load` | — | 加载 IR 配置 |
| `ir:save` | `[data]` | 保存 IR 配置 |

### 对话框

| 命令 | 参数 | 说明 |
|---------|------|-------------|
| `dialog:openDirectory` | — | 打开本机目录选择器（UI 交互）|

---

## 使用示例

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

// 示例：
const r1 = await sendCommand('ping');              // {ok:true, result:"pong"}
const r2 = await sendCommand('control:mouse:position'); // {ok:true, result:{x,y}}
const r3 = await sendCommand('control:screen:capture'); // {ok:true, result:{base64,...}}
const r4 = await sendCommand('plugin:list');       // {ok:true, result:[...]}
```

### PowerShell

```powershell
node -e "const net=require('net');const c=new net.Socket();c.connect(9380,'127.0.0.1',()=>{c.write(JSON.stringify({cmd:'window:bounds'})+'\n');});c.on('data',d=>{console.log(d.toString());c.end();});"
```
