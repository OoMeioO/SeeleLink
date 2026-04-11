# SeeleLink 架构文档

## 1. 系统架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                          用户空间                                     │
│                    Electron Renderer Process                          │
│                  (React 18 + TypeScript + Vite)                     │
│                                                                     │
│  ┌──────────────┐  ┌─────────────────────────┐  ┌─────────────────┐  │
│  │   App.tsx    │  │  TerminalPanel + Core  │  │ AndroidPage    │  │
│  │  (主组件)    │  │  + xterm.js            │  │ IRPage         │  │
│  └──────┬───────┘  └──────────┬────────────┘  └───────┬────────┘  │
│         │                       │                        │            │
│         └─────────── window.electronAPI ─────────────────┘            │
│                            │ contextBridge (preload.js)              │
└────────────────────────────┼──────────────────────────────────────────┘
                             │ IPC (invoke / send / on)
┌────────────────────────────┼──────────────────────────────────────────┐
│                            │ Electron Main Process                    │
│  ┌─────────────────────────┴─────────────────────────────────────┐  │
│  │              main.cjs — IPC Router + 连接池                     │  │
│  │  sshConnections / psConnections / cmdConnections /            │  │
│  │  serialConnections / wsConnections / androidConnections        │  │
│  └────────────────────────┬────────────────────────────────────────┘  │
│                           │                                          │
│  ┌────────────────────────┴─────────────────────────────────────┐  │
│  │              Protocol Adapters (main process)                    │  │
│  │  ssh2 / node-pty / serialport / ws / adb (spawn)              │  │
│  └────────────────────────┬─────────────────────────────────────┘  │
│                           │                                          │
│  ┌────────────────────────┴──────────────────────────────┐         │
│  │  electron/platform/ — 平台控制层                        │         │
│  │  WindowsControl.cjs (Win32 GDI/user32)                │         │
│  │  LinuxControl.cjs (X11/uinput)                        │         │
│  │  DarwinControl.cjs (CGEvent/HID)                      │         │
│  └────────────────────────────────────────────────────────┘         │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Control API Server (TCP JSON)  ← 端口 9380               │    │
│  │  MCP Server (HTTP+SSE)          ← 端口 9381               │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. IPC 通信模型

```
用户键盘输入
      │
      ▼
TerminalCore (xterm.js)
      │ __terminalPanelInput(tabId, data)
      ▼
TerminalPanel ──► adapter.send(data)
      │                   │
      ▼                   ▼
window.electronAPI ◄── ipcRenderer.invoke
      │
      ▼
preload.js ────────────► ipcMain.handle
      │
      ▼
main.cjs ──────────────► ssh2 stream.write / node-pty write / serialport write / ws.send
      │
      │  stream.on('data')
      │  webContents.send(channel, data)
      │
      ▼
preload.js ────────────► onSshData callback
      │
      ▼
TerminalPanel ──► handle.write(data)
      │
      ▼
TerminalCore ──► xterm.js 渲染
```

## 3. 终端 Tab 渲染架构（Mount-All）

```
TerminalPanel (始终挂载，display:none 切换可见性)
│
├── handleMapRef    Map<tabId, TerminalHandle>
├── adapterMapRef  Map<tabId, ProtocolAdapter>
└── ipcReadyRef    Set<connId>

TerminalCore (tab-1) ── visible: true  ← 当前活跃 Tab
TerminalCore (tab-2) ── visible: false (display:none)
TerminalCore (tab-3) ── visible: false (display:none)
```

> **设计原则：** 所有 TerminalCore 实例同时挂载，通过 CSS `display:none` 切换可见性，避免重复创建/销毁 xterm 实例导致的闪烁和性能开销。

## 4. Protocol Adapter 模式

```
protocols/index.ts — createProtocolAdapter 工厂

interface ProtocolAdapter {
  send(data: string): void;
  disconnect(): void;
}

ssh.ts      ──► ipcRenderer.invoke('ssh:execute', { connId, cmd })
powershell.ts ──► ipcRenderer.invoke('ps:execute', { connId, cmd })
cmd.ts      ──► ipcRenderer.invoke('cmd:execute', { connId, cmd })  # Bash
serial.ts   ──► ipcRenderer.invoke('serial:execute', { connId, data })
websocket.ts ──► ipcRenderer.invoke('ws:send', { connId, data })
```

> **设计原则：** Protocol Adapter 是纯 JS 对象，不依赖 React，通过 IPC 与主进程通信。数据路由由 TerminalPanel 统一管理。

## 5. 主题系统

```
theme.ts — flat theme
  │
  ├── lightTheme: colors object
  │     bg: #FFFFFF, bgSecondary: #F5F5F5, primary: #4A9EFF ...
  │
  └── darkTheme: colors object
        bg: #1C1C1E, bgSecondary: #252526, primary: #4A9EFF ...

ThemeProvider ──► useTheme() ──► { theme, styles, toggleTheme, themeName }
                                        │
                                        ▼
                                  createStyles(colors)
                                        │
                                        ▼
                                  styles object
                                        │
                                        ▼
                                  CSS Variables (index.css)
                                        │
                                        ▼
                                  --terminal-bg ──► xterm.js theme
```

## 6. ControlService 跨平台架构

```
ControlService (src/services/control/ControlService.ts)
  │
  ├── MouseControl (move / click / drag / doubleClick)
  ├── KeyboardControl (type / press / pressKeys / copy / paste)
  ├── ScreenCapture (capture / captureRegion / captureWindow)
  └── DebugService (logs / stats / clear / export)

electron/platform/
  │
  ├── WindowsControl.cjs ──► Win32 API (user32.dll, gdi32.dll)
  ├── LinuxControl.cjs ──► X11 / uinput
  └── DarwinControl.cjs ──► CGEvent / IOKit

IPC 层: main.cjs initControlIPC() ──► ipcMain.handle('control:*')
```

## 7. 插件系统架构

```
~/.seelelink/plugins/<id>/
  ├── plugin.json   (manifest: id, name, version, type, entry)
  └── index.js      (插件入口)

PluginManager (src/core/PluginManager.ts)
  │
  ├── 插件发现 (scan ~/.seelelink/plugins/)
  ├── 插件加载 (fork child_process)
  ├── 插件启用/禁用 (enabled.json)
  └── 通信 (IPC via PLUGIN_CHANNELS)

PluginProcess (src/plugins/PluginProcess.ts) ──► 隔离子进程，最小化 env
```

## 8. 数据存储架构

```
~/.seelelink/
  │
  ├── config.json          应用设置 (Control API / MCP / 截图模式 / 日志)
  ├── connections.json     连接配置 (AES-256-GCM 加密密码)
  ├── commands.json        快捷命令按钮
  ├── ir-data.json        IR 红外数据
  │
  ├── plugins/<id>/       插件目录
  │     └── plugin-config/
  │
  └── logs/<Type>/
        └── <connId>_<timestamp>.log   ANSI 脱色，会话缓冲写入

内存 (main.cjs)
  │
  ├── sshConnections      Map<connId, ssh2 Client>
  ├── psConnections       Map<connId, node-pty pty>
  ├── cmdConnections      Map<connId, node-pty pty>
  ├── serialConnections   Map<connId, SerialPort>
  └── wsConnections       Map<connId, ws WebSocket>
```

## 9. MCP Server + Control API 外部访问

```
外部客户端 (OpenClaw / Claude Desktop / 脚本)
        │
        ├── TCP ────────────► Control API Server (9380)
        │                        └── JSON 命令路由 (controlHandlers.cjs)
        │
        └── HTTP POST/SSE ──► MCP Server (9381)
                                 └── @modelcontextprotocol/sdk
                                       │
                                       ▼
                                 60+ 工具
                                   │
                                   ├── 连接: ssh/ps/cmd/serial/ws/android
                                   ├── 窗口: capture/click/move/sendKeys
                                   └── 控制: mouse/keyboard/screen
```
