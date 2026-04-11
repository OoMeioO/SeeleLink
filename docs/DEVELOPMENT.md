# SeeleLink 开发指南

## 环境要求

| 工具 | 版本要求 |
|------|---------|
| Node.js | >= 18.0.0 |
| npm | >= 9.0.0 |
| Python | >= 3.8（node-pty 编译需要） |
| Visual Studio Build Tools | Windows 下 node-pty 需要 |

> Linux/macOS 需要 C++ 编译器用于 node-pty 源码编译。

---

## 快速启动

```bash
# 1. 安装依赖（会自动 patch node-pty）
npm install

# 2. 开发模式（构建 + 启动 Electron）
npm run electron:dev

# 3. 仅构建
npm run build

# 4. 打包为 exe
npm run package

# 5. 运行测试
npm test
```

---

## 构建流程

```
npm run build
  ├── vite build        # 构建 React + TypeScript → dist-electron/assets/
  └── node scripts/copy-assets.js  # 复制静态资源到 dist-electron/
       ├── electron/platform/     → dist-electron/platform/
       ├── @xterm/xterm/lib/     → dist-electron/assets/xterm.js
       ├── @xterm/addon-fit/lib/ → dist-electron/assets/addon-fit.js
       ├── @xterm/xterm/css/     → dist-electron/assets/xterm.css
       ├── electron/terminal.html → dist-electron/terminal.html
       ├── electron/preload.js   → dist-electron/preload.js
       └── electron/controlHandlers.cjs → dist-electron/controlHandlers.cjs

npm run package
  ├── npm run build
  └── electron-builder --win
       └── SeeleLink.exe → E:\SeeleLink\release\
```

---

## 目录规范

```
src/
├── ui/                    # React 渲染进程（所有 UI 代码）
│   ├── App.tsx            # 主组件
│   ├── components/        # 页面级组件
│   ├── terminal/         # 终端模块（Panel/Core/Protocols）
│   └── themes/            # 主题系统
├── core/                  # 核心功能（插件、日志）
├── services/             # 服务层（平台控制）
├── platform/             # 平台抽象（TypeScript）
├── cli/                  # CLI 工具
└── utils/                # 工具函数

electron/                  # Electron 主进程
├── main.cjs              # 主进程入口
├── preload.js            # contextBridge
├── controlHandlers.cjs   # Control API 处理器
├── start.cjs             # 启动脚本
└── platform/            # 平台控制（CJS，供 main 调用）
```

---

## 调试方法

### Renderer 调试

1. 在 Electron 中按 `Ctrl+Shift+I` 打开 DevTools
2. Console 查看日志
3. Elements 查看 DOM
4. Sources 断点调试

### 主进程调试

在 VSCode 中配置 `.vscode/launch.json`：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Electron Main",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "runtimeArgs": ["."],
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

### 日志文件

```bash
# 主进程日志
type %USERPROFILE%\.seelelink\electron.log

# 调试日志
type %USERPROFILE%\.seelelink\debug.log
```

### PowerShell 截图调试脚本

```powershell
# 获取窗口截图
.\scripts\screenshot.ps1

# 检查 CDP 连接
node scripts\check-cdp.ps1

# 检查 React 状态
node scripts\check-react.ps1
```

---

## 测试

```bash
npm test               # 运行所有测试
npm run test:ui       # UI 冒烟测试（Playwright）
npm run test:control  # Control API TCP 测试
npm run test:mcp      # MCP Server HTTP 测试
```

### UI 冒烟测试（Playwright）

```bash
npm run test:ui
# 打开 SeeleLink，检查主界面渲染，截图比对
```

### Control API 测试

```bash
npm run test:control
# TCP 连接 9380，发送 ping/window:capture 等命令，验证响应
```

### MCP Server 测试

```bash
npm run test:mcp
# HTTP 请求 9381/mcp，列出工具，调用工具，验证 JSON-RPC 响应
```

---

## 添加新协议

### 1. 在 `preload.js` 添加 IPC 通道

```javascript
// electron/preload.js
myProtocolConnect: (connId) => ipcRenderer.invoke('myProtocol:connect', { connId }),
myProtocolDisconnect: (connId) => ipcRenderer.invoke('myProtocol:disconnect', connId),
myProtocolSend: (connId, data) => ipcRenderer.invoke('myProtocol:send', { connId, data }),
onMyProtocolData: (connId, callback) => {
  const channel = 'myProtocol:data:' + connId;
  ipcRenderer.removeAllListeners(channel);
  ipcRenderer.on(channel, (_, data) => callback(data));
},
```

### 2. 在 `main.cjs` 添加 IPC handler

```javascript
// electron/main.cjs
ipcMain.handle('myProtocol:connect', async (event, { connId }) => { ... });
ipcMain.handle('myProtocol:send', async (event, { connId, data }) => { ... });
ipcMain.handle('myProtocol:disconnect', async (event, connId) => { ... });
```

### 3. 在 `src/ui/electronAPI.ts` 添加 TypeScript 类型

```typescript
myProtocolConnect: (connId: string) => Promise<void>;
myProtocolDisconnect: (connId: string) => Promise<void>;
myProtocolSend: (connId: string, data: string) => Promise<void>;
onMyProtocolData: (connId: string, cb: (data: string) => void) => void;
```

### 4. 添加 Protocol Adapter

```typescript
// src/ui/terminal/protocols/myProtocol.ts
export function createMyProtocolAdapter(options): ProtocolAdapter {
  return {
    send(data) { electronAPI.myProtocolSend(options.connId, data); },
    disconnect() { electronAPI.myProtocolDisconnect(options.connId); },
  };
}

// src/ui/terminal/protocols/index.ts
case 'myProtocol': return createMyProtocolAdapter(options);
```

### 5. 更新 NewConnectionModal

在 `App.tsx` 的 `NewConnectionModal` 中添加协议类型的表单字段。

---

## 添加新 Control API 命令

```javascript
// electron/controlHandlers.cjs
case 'myCommand':
  result = await controlService.myMethod(args);
  break;
```

---

## 安全注意事项

- 所有 IPC handler 需要校验参数类型和范围
- 坐标值使用 `Number.isSafeInteger` 校验
- ADB 命令参数使用白名单校验（`validateAdbArgs`）
- Shell 命令禁止拼接用户输入
- 密码使用 AES-256-GCM 加密存储
- `contextBridge` 禁止暴露原始 `ipcRenderer`

---

## 常见问题

**node-pty 加载失败？**

```bash
# Windows: 重新编译
npm rebuild node-pty

# 或使用 patch-package
npm run postinstall
```

**端口 9380/9381 被占用？**

```powershell
netstat -ano | findstr "9380"
taskkill /PID <pid> /F
```

**截图黑屏？**

```bash
# 使用 --debug-gpu 禁用硬件加速
npm run electron:dev -- --debug-gpu
```
