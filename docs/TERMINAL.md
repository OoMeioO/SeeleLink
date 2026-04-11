# 终端系统设计文档

## 设计目标

终端模块需要同时满足两个目标：
1. **多 Tab 支持** — 多个连接可以同时打开，Tab 切换无延迟
2. **主题感知** — 终端背景跟随浅色/深色主题变化

## 核心设计：Mount-All 架构

### 为什么不用条件渲染？

传统方案：每个 Tab 对应一个 TerminalCore，切换 Tab 时卸载/重建。这样会导致：
- Tab 切换时有明显闪烁
- xterm 实例重复创建/销毁，开销大
- 连接状态在重建时丢失

### Mount-All 方案

```
TerminalPanel (始终挂载)
  └── TerminalCore × N (同时挂载，CSS display:none 控制可见性)
```

切换 Tab 时只需改变一个 `visible` 属性（布尔值），xterm 实例始终保持活动状态。

## 关键文件

```
src/ui/terminal/
├── panel/TerminalPanel.tsx     # Tab 容器，唯一出口
├── core/
│   ├── TerminalCore.tsx         # xterm 封装
│   ├── useTerminalTheme.ts      # 主题 → xterm 颜色映射
│   └── types.ts                 # TerminalHandle / ProtocolAdapter
└── protocols/
    ├── index.ts                # createProtocolAdapter 工厂
    ├── ssh.ts
    ├── powershell.ts
    ├── cmd.ts
    ├── serial.ts
    └── websocket.ts
```

## TerminalCore 职责

```typescript
// TerminalCore.tsx
export const TerminalCore = forwardRef<TerminalHandle, TerminalCoreProps>(
  ({ tabId, visible = true, onReady }, ref) => {
    // 1. 初始化 xterm + fitAddon
    const term = new XTerminal({ theme: xtermTheme, fontSize: 14, ... })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)

    // 2. forwardRef + useImperativeHandle 暴露 handle
    useImperativeHandle(ref, () => ({
      write, clear, focus, resize, getAllText, ...
    }))

    // 3. ResizeObserver 自动 fit
    useEffect(() => { fit.fit() }, [visible])

    // 4. 键盘输入路由
    term.onData(data => {
      // 过滤 ConPTY 焦点序列，避免显示异常
      // 通过 window.__terminalPanelInput(tabId, data) 发送给 Panel
    })

    // 5. 渲染
    return <div style={{ display: visible ? 'block' : 'none', height: '100%' }}>
      <div ref={containerRef} style={{ height: '100%' }} />
    </div>
  }
)
```

## TerminalHandle 接口

由 TerminalCore 通过 `forwardRef + useImperativeHandle` 暴露，供 TerminalPanel 调用：

```typescript
interface TerminalHandle {
  write(data: string): void;       // 写入数据到终端
  clear(): void;                  // 清屏
  focus(): void;                  // 聚焦终端
  resize(cols: number, rows: number): void;  // 调整大小
  getAllText(): string;           // 获取全部文本
  getVisibleText(): string;       // 获取可见文本
  hasSelection(): boolean;        // 是否有选区
  getSelection(): string;        // 获取选中文本
  copySelection(): void;          // 复制选区
  paste(text: string): void;     // 粘贴
  selectAll(): void;              // 全选
  clearSelection(): void;         // 清除选区
  getSize(): { cols: number; rows: number };
  scrollToBottom(): void;        // 滚动到底部
}
```

## TerminalPanel 数据流

```
TerminalPanel 挂载时：
  │
  ├── connTabs.map(tab => <TerminalCore key={tab.id} visible={tab.id === activeConnTabId} />)
  │
  └── useEffect: 遍历 connTabs，为每个 connId 注册 typed IPC 监听器
        │
        ├── onSshData(connId, cb)    → ssh2 stream.on('data')
        ├── onPsData(connId, cb)     → node-pty onData
        ├── onCmdData(connId, cb)    → node-pty onData (Bash connection, uses cmd:* IPC)
        ├── onSerialData(connId, cb) → serialport onData
        └── onWsData(connId, cb)    → ws onMessage

TerminalCore onReady(tabId, handle) 时：
  │
  ├── handleMapRef.current.set(tabId, handle)
  │
  └── handleOnReady(tabId, handle):
        │
        ├── 从 connTabsRef 查找 tab 配置
        │
        └── 调用 electronAPI.*Connect 建立连接
              (sshConnect / psConnect / cmdConnect (Bash) / serialConnect / wsConnect)

用户键盘输入时：
  │
  ├── TerminalCore: term.onData(data)
  │
  ├── window.__terminalPanelInput(tabId, data)  (全局函数)
  │
  ├── TerminalPanel: sendInput(tabId, data)
  │
  ├── adapterMapRef.current.get(tabId).send(data)
  │
  └── electronAPI.*Execute(connId, data) → ipcMain.handle → 协议库

收到服务器数据时：
  │
  ├── ipcMain → webContents.send(channel, data)
  │
  ├── preload: ipcRenderer.on(channel, cb)
  │
  ├── TerminalPanel: writeToHandle(data)  (根据 connId 找到对应 handle)
  │
  └── handle.write(data) → TerminalCore → term.write(data) → xterm 渲染
```

## Protocol Adapter 模式

每个协议对应一个纯 JS 对象，不依赖 React：

```typescript
// protocols/ssh.ts
export function createSshAdapter({ tabId, connId }: ProtocolAdapterOptions): ProtocolAdapter {
  return {
    send(data: string) {
      electronAPI.sshExecute(connId, data);
    },
    disconnect() {
      electronAPI.sshDisconnect(connId);
    },
  };
}

// protocols/index.ts — 工厂函数
export function createProtocolAdapter(connType: string, options): ProtocolAdapter | null {
  switch (connType) {
    case 'ssh':         return createSshAdapter(options);
    case 'powershell': return createPowershellAdapter(options);
    case 'cmd':        return createCmdAdapter(options);  // Bash connection
    case 'serial':    return createSerialAdapter(options);
    case 'websocket': return createWebSocketAdapter(options);
    default:           return null;
  }
}
```

## 主题感知

```typescript
// useTerminalTheme.ts
export function useTerminalTheme() {
  const { theme, themeName } = useTheme();

  return useMemo(() => ({
    background:   theme.bg,           // 跟随 flat theme
    foreground:   theme.text,
    cursor:       theme.text,
    cursorAccent: theme.bg,
    black:   '#000000',
    red:     theme.error || '#F44336',
    green:   theme.success || '#4CAF50',
    yellow:  theme.warning || '#FF9800',
    blue:    theme.primary || '#0D7DD9',
    // ...
    selectionBackground: isDark
      ? 'rgba(13,125,217,0.3)'
      : 'rgba(0,102,204,0.3)',
  }), [theme, themeName]);
}
```

浅色模式下 `theme.bg = '#FFFFFF'`，深色模式下 `theme.bg = '#1C1C1E'`，xterm 背景自动跟随。

## ConPTY 焦点序列过滤

Windows ConPTY 在焦点切换时会发送特殊转义序列，导致终端显示异常。TerminalCore 中过滤：

```typescript
// 过滤 ConPTY 焦点序列（\x1b[?1h / \x1b[?1l）
if (data.startsWith('\x1b[?1h') || data.startsWith('\x1b[?1l')) {
  return;
}
```

## 常见问题

**Q: Tab 切换时终端内容丢失？**
A: Mount-All 架构保证 TerminalCore 实例不会重建，内容不会丢失。如果丢失，检查是否触发了重新挂载。

**Q: 终端主题不跟随浅色模式？**
A: 检查 `useTerminalTheme` 的依赖数组，确保 `theme` 和 `themeName` 变化时重新计算。

**Q: 多个 Tab 数据串了？**
A: 确保 `connId` 在每个 Tab 中唯一。IPC 通道使用 `connId` 作为 key，注册时 `removeAllListeners` 防止重复监听。
