# SeeleLink 模块详解

## 1. Electron 主进程 (`electron/main.cjs`)

**职责：** 应用生命周期、窗口管理、所有 IPC handler、连接池、Control API、MCP Server、会话日志

### 关键模块

| 模块 | 行号 | 职责 |
|------|------|------|
| 密码加密 | ~29-75 | AES-256-GCM 加密连接密码（密钥派生：机器信息） |
| 配置管理 | ~78-114 | `config.json` 读写（Control API、MCP、截图模式、日志） |
| node-pty 懒加载 | ~133-151 | `ensureNodePty()` 首次使用时加载，避免启动开销 |
| ControlService | ~153-165 | 平台控制服务初始化（Mouse/Keyboard/Screen） |
| IPC handler | ~168-401 | 全部 40+ 个 ipcMain.handle 注册 |
| 连接管理 | ~403+ | 7 种协议的连接池（ssh/ps/cmd/serial/ws/android） |
| 会话日志 | ~404-450 | ANSI 脱色，4KB/100ms 缓冲写入 |
| Control API | ~startControlApi() | TCP JSON 服务器（端口 9380） |
| MCP Server | ~startMcpServer() | HTTP+SSE 服务器（端口 9381） |

### 连接池 Map

```javascript
sshConnections:     Map<connId, ssh2 Client>
psConnections:     Map<connId, node-pty pty>
cmdConnections:    Map<connId, node-pty pty>
serialConnections: Map<connId, SerialPort>
wsConnections:    Map<connId, ws WebSocket>
androidConnections: Map<connId, ADBProcess>
```

### 窗口创建

```javascript
createWindow()
  ├── 无边框 (frame: false, titleBarStyle: 'hidden')
  ├── 自定义标题栏（通过 div 实现）
  ├── 菜单栏（File/Edit/View/Help）
  └── 拖拽区域（titleBar 上半部分可拖拽）
```

---

## 2. Preload 桥接 (`electron/preload.js`)

**职责：** 通过 `contextBridge.exposeInMainWorld` 安全暴露 `window.electronAPI`，renderer 禁止直接访问 `ipcRenderer`。

### 所有暴露的 API（按类别分组）

```typescript
// 连接管理
saveConnection / loadConnections / deleteConnection
saveCommands / loadCommands

// 协议 (invoke)
sshConnect / sshDisconnect / sshExecute
psConnect / psDisconnect / psExecute
cmdConnect / cmdDisconnect / cmdExecute
serialList / serialConnect / serialDisconnect / serialExecute
wsConnect / wsDisconnect / wsSend

// 协议 (on — 单次注册)
onSshData / onPsData / onPsError / onCmdData / onSerialData / onWsData / onAndroidData

// Android ADB
androidConnect / androidDisconnect / androidDevices
androidScreenshot / androidHierarchy / androidPageInfo
androidTap / androidSwipe / androidText / androidKey
androidGetLocalIp / androidScanNetwork
execAdb / execAdbScreenshot

// 窗口自动化 (send — fire-and-forget)
windowCapture / windowClick / windowMoveMouse / windowSendKeys
windowSwitchTab / windowMinimize / windowMaximize / windowClose
windowStartDebug / windowStopDebug

// 窗口事件监听
onDebugMouseClick / onDebugMouseMove / onDebugKeyDown / onWindowSwitchTab

// Control Service (handle 返回 Promise)
controlMousePosition / controlMouseMove / controlMouseClick / controlMouseDoubleClick / controlMouseDrag
controlKeyboardType / controlKeyboardPress / controlKeyboardPressKeys
controlKeyboardCopy / controlKeyboardPaste / controlKeyboardCut / controlKeyboardSelectAll
controlScreenList / controlScreenCapture / controlScreenCaptureRegion / controlScreenCaptureAndSave
controlScreenCaptureWindow / controlScreenBringToForeground
controlDebugGetLogs / controlDebugGetStats / controlDebugClear / controlDebugSetLevel / controlDebugExport
controlPlatformInfo

// 配置
controlApiGetConfig / controlApiSetConfig / controlApiFindAvailablePort
mcpApiGetConfig / mcpApiSetConfig / mcpApiFindAvailablePort
windowCaptureGetConfig / windowCaptureSetConfig
logGetConfig / logSetConfig / logGetDir / logOpenFolder

// 其他
dialogOpenDirectory / appGetInfo / irLoad / irSave / consoleLog
```

---

## 3. ControlHandlers (`electron/controlHandlers.cjs`)

**职责：** Control API 命令处理，封装 `ControlService` 的鼠标/键盘/截图能力。

| 命令 | 功能 |
|------|------|
| `window:capture` | PNG 截图（base64） |
| `window:bounds` | 窗口位置/尺寸 |
| `window:click` | 鼠标点击（窗口相对坐标） |
| `window:moveMouse` | 鼠标移动 |
| `window:sendKeys` | 发送键盘输入 |
| `window:eval` | 执行 JS 脚本 |
| `window:startDebug` | 开启调试模式 |

---

## 4. 平台控制层 (`electron/platform/`)

跨平台适配，统一接口：

```
electron/platform/
├── index.cjs          平台检测 + createControl()
├── WindowsControl.cjs Win32 GDI + user32
├── LinuxControl.cjs   X11 + uinput
└── DarwinControl.cjs  CGEvent + HID

接口:
  mouse.getPosition() / setPosition(x, y) / click(x, y, button)
  mouse.doubleClick(x, y) / drag(fromX, fromY, toX, toY)

  keyboard.typeText(text) / pressKey(key) / pressKeys(keys)
  keyboard.copy() / paste() / cut() / selectAll()

  screen.capture() / captureRegion(x, y, w, h)
  screen.captureWindow(bounds) / bringToForeground(hwnd) / list()
```

---

## 5. 终端模块 (`src/ui/terminal/`)

```
terminal/
├── panel/
│   └── TerminalPanel.tsx     Tab 容器，mount-all 架构
├── core/
│   ├── TerminalCore.tsx       xterm.js 封装，forwardRef handle
│   ├── useTerminalTheme.ts    flat theme → xterm ANSI 16 色
│   ├── types.ts              TerminalHandle / ProtocolAdapter 类型
│   └── index.ts
├── protocols/
│   ├── index.ts              createProtocolAdapter 工厂
│   ├── ssh.ts
│   ├── powershell.ts
│   ├── cmd.ts
│   ├── serial.ts
│   └── websocket.ts
└── hooks/
    └── useSessionRegistry.ts   全局 Map<tabId, TerminalSession>
```

### TerminalCore (`core/TerminalCore.tsx`)

- `new XTerminal({ theme: xtermTheme })` + FitAddon
- ResizeObserver 自动 fit（窗口大小变化时重新计算）
- `forwardRef` + `useImperativeHandle` 暴露完整 `TerminalHandle`
- ConPTY 焦点转义序列过滤（避免 Alt+Tab 切换后光标显示异常）
- 键盘输入通过 `window.__terminalPanelInput` 路由到 Panel

### TerminalPanel (`panel/TerminalPanel.tsx`)

- 所有 TerminalCore 同时挂载，CSS `display:none` 切换可见性
- 为每个 tab 注册 typed IPC 监听器（`onSshData`、`onSerialData` 等）
- 维护 `handleMapRef`（tabId → handle）、`adapterMapRef`（tabId → send/disconnect）
- `handleOnReady` 中调用 `electronAPI.*Connect` 建立连接
- `connTabsRef` 避免 stale closure

### TerminalHandle 接口

```typescript
interface TerminalHandle {
  write(data: string): void;
  clear(): void; focus(): void;
  resize(cols: number, rows: number): void;
  getAllText(): string; getVisibleText(): string;
  hasSelection(): boolean; getSelection(): string;
  copySelection(): void; paste(text: string): void;
  selectAll(): void; clearSelection(): void;
  getSize(): { cols: number; rows: number };
  scrollToBottom(): void;
}
```

---

## 6. React UI (`src/ui/App.tsx`)

### 状态管理

```typescript
activeTab: TabType         // ssh | serial | powershell | bash | websocket | android | ir | settings
connTabs: TerminalPanelTab[] // 打开的连接 Tab 列表
activeConnTabId: string | null // 当前活跃连接 Tab
savedConns: SavedConn[]    // 持久化连接配置
showModal: boolean         // 新建连接弹窗
themeName: 'dark' | 'light' // 当前主题
currentTime: string         // 状态栏时间（30s 刷新）
```

### 布局结构

```
Container (flex column, height: 100vh)
├── TitleBar (36px) — Logo + 菜单栏 + 窗口控制按钮
├── TabBar (35px) — 协议切换
├── Content (flex: 1)
│   ├── Sidebar (220px, conditional) — 连接列表 + 搜索
│   └── MainArea (flex: 1)
│       ├── TabBar (40px) — 连接 Tab
│       ├── TerminalPanel (始终挂载)
│       └── AndroidPage / IRPage / Settings (条件显示)
└── StatusBar (22px)
```

### 主题颜色 token

```typescript
// light
bg: '#FFFFFF', bgSecondary: '#F5F5F5', bgTertiary: '#F0F0F0'
primary: '#4A9EFF', success: '#4CAF50', error: '#E53935'
text: '#1C1C1E', textSecondary: '#666666'
border: '#D0D0D0', borderLight: '#E0E0E0'

// dark
bg: '#1C1C1E', bgSecondary: '#252526', bgTertiary: '#333333'
primary: '#4A9EFF', success: '#4CAF50', error: '#E53935'
text: '#E5E5E5', textSecondary: '#ABABAB'
border: '#3C3C3C', borderLight: '#2D2D2D'
```

---

## 7. Android 页面 (`components/AndroidPage.tsx`)

**职责：** ADB 设备发现、连接、截图、控制

| 功能 | 说明 |
|------|------|
| USB 设备扫描 | `adb devices` |
| LAN 设备发现 | 扫描 5555 端口 |
| 设备截图 | 自动刷新 |
| 触摸控制 | 点击、滑动、文本输入、按键 |
| Activity/包名 | 页面信息获取 |
| D-pad 控制 | 上/下/左/右/确认 |

### 设备状态

```typescript
type AndroidDeviceStatus = 'connected' | 'disconnected' | 'connecting' | 'discovering' | 'unauthorized' | 'offline' | 'discovered'
```

---

## 8. IR 页面 (`components/IRPage.tsx`)

**职责：** 红外设备管理、指令库、序列下发

```typescript
IRData = {
  deviceTypes: IRDeviceType[]   // 设备类型（空调/电视/风扇）
  commands: IRCommandDef[]      // 指令定义
  devices: IRDevice[]           // 已配置设备（USB/网络/ADB）
  sequences: IRSequence[]        // 序列（多指令+延时组合）
}
```

---

## 9. 插件系统 (`src/core/PluginManager.ts`)

**职责：** 插件发现、加载、启用/禁用、隔离子进程管理

```
~/.seelelink/plugins/<id>/
├── plugin.json   // id, name, version, type, entry
└── index.js     // 插件入口

PluginManager {
  plugins: Map<id, LoadedPlugin>
  processes: Map<id, PluginProcess>
  enabledPlugins: Set<id>
  discover()      // 扫描插件目录
  load(id)        // fork 子进程
  enable(id)      // 加入 enabled.json
  disable(id)     // 从 enabled.json 移除
}
```

---

## 10. CLI (`src/cli/`)

```bash
uc connect -t ssh -h 10.0.0.1 -u admin -P secret
uc list
uc status
```

基于 `commander`，通过 `connectionManager`（非 Electron 模式）连接。

---

## 11. 配置文件路径

| 键 | 路径 |
|----|------|
| 配置目录 | `~/.seelelink/` |
| config.json | `~/.seelelink/config.json` |
| connections.json | `~/.seelelink/connections.json` |
| commands.json | `~/.seelelink/commands.json` |
| ir-data.json | `~/.seelelink/ir-data.json` |
| electron.log | `~/.seelelink/electron.log` |
| debug.log | `~/.seelelink/debug.log` |
| 会话日志 | `~/.seelelink/logs/<Type>/` |
| 插件目录 | `~/.seelelink/plugins/<id>/` |
