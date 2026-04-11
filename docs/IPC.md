# IPC 通道注册表

本文档是 `electron/preload.js` 中所有 `contextBridge` 暴露 API 的完整索引。

## 传输层

| 层 | 协议 | 文件 |
|----|------|------|
| preload.js | `contextBridge` → `window.electronAPI` | `electron/preload.js` |
| main.cjs | `ipcMain.handle` / `ipcMain.on` / `ipcMain.send` | `electron/main.cjs` |

---

## 全部 API 索引

### 连接管理

| preload API | main handler | 方向 | 说明 |
|------------|-------------|------|------|
| `saveConnection(conn)` | `ipcMain.handle('saveConnection')` | invoke | 保存连接配置 |
| `loadConnections()` | `ipcMain.handle('loadConnections')` | invoke | 加载连接列表 |
| `deleteConnection(id)` | `ipcMain.handle('deleteConnection')` | invoke | 删除连接 |
| `saveCommands(connId, cmds)` | `ipcMain.handle('saveCommands')` | invoke | 保存快捷命令 |
| `loadCommands(connId)` | `ipcMain.handle('loadCommands')` | invoke | 加载快捷命令 |

---

### SSH

| preload API | main handler | 方向 | 说明 |
|------------|-------------|------|------|
| `sshConnect(config)` | `ipcMain.handle('ssh:connect')` | invoke | 建立 SSH 连接 |
| `sshExecute(connId, cmd)` | `ipcMain.handle('ssh:execute')` | invoke | 发送命令 |
| `sshDisconnect(connId)` | `ipcMain.handle('ssh:disconnect')` | invoke | 断开连接 |
| `onSshData(connId, cb)` | `webContents.send('ssh:data:' + connId)` | on | 接收数据 |

---

### PowerShell

| preload API | main handler | 方向 | 说明 |
|------------|-------------|------|------|
| `psConnect(connId)` | `ipcMain.handle('ps:connect')` | invoke | 启动 PowerShell 进程 |
| `psExecute(connId, cmd)` | `ipcMain.handle('ps:execute')` | invoke | 发送命令 |
| `psDisconnect(connId)` | `ipcMain.handle('ps:disconnect')` | invoke | 终止进程 |
| `onPsData(connId, cb)` | `webContents.send('ps:data:' + connId)` | on | 接收 stdout |
| `onPsError(connId, cb)` | `webContents.send('ps:error:' + connId)` | on | 接收 stderr |

---

### Bash

| preload API | main handler | 方向 | 说明 |
|------------|-------------|------|------|
| `cmdConnect(connId)` | `ipcMain.handle('cmd:connect')` | invoke | 启动 Bash 进程（Git Bash/MSYS2） |
| `cmdExecute(connId, cmd)` | `ipcMain.handle('cmd:execute')` | invoke | 发送命令 |
| `cmdDisconnect(connId)` | `ipcMain.handle('cmd:disconnect')` | invoke | 终止进程 |
| `cmdReady(connId)` | `ipcMain.handle('cmd:ready')` | invoke | Bash 准备就绪（no-op） |
| `onCmdData(connId, cb)` | `webContents.send('cmd:data:' + connId)` | on | 接收数据 |

---

### Serial

| preload API | main handler | 方向 | 说明 |
|------------|-------------|------|------|
| `serialList()` | `ipcMain.handle('serial:list')` | invoke | 列出 COM 口 |
| `serialConnect(config)` | `ipcMain.handle('serial:connect')` | invoke | 连接串口 |
| `serialExecute(connId, data)` | `ipcMain.handle('serial:execute')` | invoke | 发送数据 |
| `serialDisconnect(connId)` | `ipcMain.handle('serial:disconnect')` | invoke | 断开串口 |
| `onSerialData(connId, cb)` | `webContents.send('serial:data:' + connId)` | on | 接收数据 |

---

### WebSocket

| preload API | main handler | 方向 | 说明 |
|------------|-------------|------|------|
| `wsConnect(connId, url)` | `ipcMain.handle('ws:connect')` | invoke | 连接 WS 服务器 |
| `wsSend(connId, data)` | `ipcMain.handle('ws:send')` | invoke | 发送消息 |
| `wsDisconnect(connId)` | `ipcMain.handle('ws:disconnect')` | invoke | 断开连接 |
| `onWsData(connId, cb)` | `webContents.send('ws:data:' + connId)` | on | 接收消息 |

---

### Android

| preload API | main handler | 方向 | 说明 |
|------------|-------------|------|------|
| `androidDevices()` | `ipcMain.handle('android:devices')` | invoke | 列出 ADB 设备 |
| `androidConnect(connId, deviceId)` | `ipcMain.handle('android:connect')` | invoke | 连接设备 |
| `androidDisconnect(connId)` | `ipcMain.handle('android:disconnect')` | invoke | 断开设备 |
| `androidScreenshot(connId)` | `ipcMain.handle('android:screenshot')` | invoke | 获取截图 |
| `androidHierarchy(connId)` | `ipcMain.handle('android:hierarchy')` | invoke | 获取 UI 树 |
| `androidPageInfo(connId)` | `ipcMain.handle('android:pageinfo')` | invoke | 获取 Activity |
| `androidTap(connId, x, y)` | `ipcMain.handle('android:tap')` | invoke | 点击坐标 |
| `androidSwipe(connId, sx, sy, ex, ey, dur)` | `ipcMain.handle('android:swipe')` | invoke | 滑动 |
| `androidText(connId, text)` | `ipcMain.handle('android:text')` | invoke | 输入文本 |
| `androidKey(connId, keycode)` | `ipcMain.handle('android:key')` | invoke | 按键 |
| `androidGetLocalIp()` | `ipcMain.handle('android:getLocalIp')` | invoke | 获取本机 IP |
| `androidScanNetwork(options)` | `ipcMain.handle('android:scanNetwork')` | invoke | 扫描局域网 ADB |
| `onAndroidData(connId, cb)` | `webContents.send('android:data:' + connId)` | on | 接收数据 |
| `execAdb(args)` | `ipcMain.handle('exec:adb')` | invoke | 执行 ADB 命令 |
| `execAdbScreenshot(deviceId)` | `ipcMain.handle('exec:adb:screenshot')` | invoke | ADB 截图 |

---

### 窗口自动化（Fire-and-Forget）

| preload API | main handler | 方向 | 说明 |
|------------|-------------|------|------|
| `windowClick(x, y, button)` | `ipcMain.send('window:click')` | send | 鼠标点击 |
| `windowMoveMouse(x, y)` | `ipcMain.send('window:moveMouse')` | send | 鼠标移动 |
| `windowSendKeys(keys)` | `ipcMain.send('window:sendKeys')` | send | 发送键盘 |
| `windowSwitchTab(tab)` | `ipcMain.send('window:switchTab')` | send | 切换 Tab |
| `windowMinimize()` | `ipcMain.send('window:minimize')` | send | 最小化 |
| `windowMaximize()` | `ipcMain.send('window:maximize')` | send | 最大化 |
| `windowClose()` | `ipcMain.send('window:close')` | send | 关闭 |
| `windowStartDebug()` | `ipcMain.send('window:startDebug')` | send | 开启调试 |
| `windowStopDebug()` | `ipcMain.send('window:stopDebug')` | send | 关闭调试 |

---

### 窗口事件监听

| preload API | main channel | 说明 |
|------------|-------------|------|
| `onWindowSwitchTab(cb)` | `window:switchTab` | Tab 切换事件 |
| `onDebugMouseClick(cb)` | `debug:mouseClick` | 调试鼠标点击 |
| `onDebugMouseMove(cb)` | `debug:mouseMove` | 调试鼠标移动 |
| `onDebugKeyDown(cb)` | `debug:keyDown` | 调试按键 |

---

### 窗口自动化（Promise 返回）

| preload API | main handler | 返回 |
|------------|-------------|------|
| `windowCapture()` | `ipcMain.handle('window:capture')` | `{ png: base64 }` |
| `windowGetBounds()` | `ipcMain.handle('window:getBounds')` | `{ x, y, width, height }` |
| `windowIsMaximized()` | `ipcMain.handle('window:isMaximized')` | `boolean` |

---

### Control Service

#### Mouse

| preload API | main handler |
|------------|-------------|
| `controlMousePosition()` | `ipcMain.handle('control:mouse:position')` |
| `controlMouseMove(x, y)` | `ipcMain.handle('control:mouse:move')` |
| `controlMouseClick(x, y, button?)` | `ipcMain.handle('control:mouse:click')` |
| `controlMouseDoubleClick(x, y)` | `ipcMain.handle('control:mouse:doubleClick')` |
| `controlMouseDrag(fx, fy, tx, ty)` | `ipcMain.handle('control:mouse:drag')` |

#### Keyboard

| preload API | main handler |
|------------|-------------|
| `controlKeyboardType(text)` | `ipcMain.handle('control:keyboard:type')` |
| `controlKeyboardPress(key)` | `ipcMain.handle('control:keyboard:press')` |
| `controlKeyboardPressKeys(keys)` | `ipcMain.handle('control:keyboard:pressKeys')` |
| `controlKeyboardCopy()` | `ipcMain.handle('control:keyboard:copy')` |
| `controlKeyboardPaste()` | `ipcMain.handle('control:keyboard:paste')` |
| `controlKeyboardCut()` | `ipcMain.handle('control:keyboard:cut')` |
| `controlKeyboardSelectAll()` | `ipcMain.handle('control:keyboard:selectAll')` |

#### Screen

| preload API | main handler |
|------------|-------------|
| `controlScreenCapture()` | `ipcMain.handle('control:screen:capture')` |
| `controlScreenCaptureRegion(x, y, w, h)` | `ipcMain.handle('control:screen:captureRegion')` |
| `controlScreenCaptureWindow(bounds)` | `ipcMain.handle('control:screen:captureWindow')` |
| `controlScreenCaptureAndSave(path, format)` | `ipcMain.handle('control:screen:captureAndSave')` |
| `controlScreenBringToForeground(hwnd?)` | `ipcMain.handle('control:screen:bringToForeground')` |
| `controlScreenList()` | `ipcMain.handle('control:screen:list')` |

#### Debug

| preload API | main handler |
|------------|-------------|
| `controlDebugGetLogs(filter?)` | `ipcMain.handle('control:debug:getLogs')` |
| `controlDebugGetStats()` | `ipcMain.handle('control:debug:getStats')` |
| `controlDebugClear()` | `ipcMain.handle('control:debug:clear')` |
| `controlDebugSetLevel(level)` | `ipcMain.handle('control:debug:setLevel')` |
| `controlDebugExport(format?)` | `ipcMain.handle('control:debug:export')` |

#### Platform

| preload API | main handler |
|------------|-------------|
| `controlPlatformInfo()` | `ipcMain.handle('control:platform:info')` |

---

### 配置

| preload API | main handler |
|------------|-------------|
| `controlApiGetConfig()` | `ipcMain.handle('controlApi:getConfig')` |
| `controlApiSetConfig(cfg)` | `ipcMain.handle('controlApi:setConfig')` |
| `controlApiFindAvailablePort(host)` | `ipcMain.handle('controlApi:findAvailablePort')` |
| `mcpApiGetConfig()` | `ipcMain.handle('mcpApi:getConfig')` |
| `mcpApiSetConfig(cfg)` | `ipcMain.handle('mcpApi:setConfig')` |
| `mcpApiFindAvailablePort(host)` | `ipcMain.handle('mcpApi:findAvailablePort')` |
| `windowCaptureGetConfig()` | `ipcMain.handle('windowCapture:getConfig')` |
| `windowCaptureSetConfig(mode)` | `ipcMain.handle('windowCapture:setConfig')` |

---

### 会话日志

| preload API | main handler |
|------------|-------------|
| `logGetConfig()` | `ipcMain.handle('log:getConfig')` |
| `logSetConfig(cfg)` | `ipcMain.handle('log:setConfig')` |
| `logGetDir()` | `ipcMain.handle('log:getDir')` |
| `logOpenFolder(logId?)` | `ipcMain.handle('log:openFolder')` |

---

### 其他

| preload API | main handler | 说明 |
|------------|-------------|------|
| `appGetInfo()` | `ipcMain.handle('app:getInfo')` | 应用信息 |
| `irLoad()` | `ipcMain.handle('ir:load')` | 加载 IR 数据 |
| `irSave(data)` | `ipcMain.handle('ir:save')` | 保存 IR 数据 |
| `dialogOpenDirectory()` | `ipcMain.handle('dialog:openDirectory')` | 选择目录 |
| `consoleLog(...args)` | `ipcMain.send('log')` | 前端日志转发 |

---

## IPC 方向说明

| 方向 | preload 方法 | 说明 |
|------|------------|------|
| `invoke` | `ipcRenderer.invoke()` | renderer → main，等待 Promise 返回 |
| `send` | `ipcRenderer.send()` | renderer → main，fire-and-forget |
| `on` | `ipcRenderer.on()` | main → renderer，事件订阅（带 removeAllListeners 防重复） |
