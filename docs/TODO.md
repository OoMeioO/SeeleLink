# SeeleLink 待办事项

## 高优先级

- [ ] Serial 口热插拔检测
- [ ] 连接超时自动重连
- [ ] macOS / Linux 版本适配测试
- [ ] **Bash 终端切换清空** — Bash 开启后，切换到 Android/IR 再切换回 Bash，终端显示内容被清空
- [ ] **接口功能验证** — MCP、Control API 各协议功能完整性验证

## 中优先级

- [ ] 终端内搜索功能（Ctrl+F）
- [ ] 连接导入/导出（JSON 格式）
- [ ] 连接分组管理
- [ ] XU 控制

## 低优先级 / 规划中

- [ ] 多语言支持（i18n）
- [ ] 主题自定义
- [ ] 快捷键自定义
- [ ] 插件系统完善

---

## 已完成

### UI/UX

- [x] 多标签页界面
- [x] 深色/浅色主题
- [x] WebSocket 空页面图标居中
- [x] 浅色模式终端黑色边框修复
- [x] Android/IR 按钮文字对比度（白色文字 on 彩色按钮）
- [x] 会话 Tab Bar 高度和 hover 效果优化
- [x] 状态栏（时间、主题、缩放、连接数）
- [x] 窗口截图多模式（auto / foreground / gdi）
- [x] PowerShell/Bash 中文支持（GBK→UTF8 / ConPTY UTF-8）
- [x] 窗口自动化 UI（截图、点击、坐标发现）
- [x] 设计主题系统（Airbnb/Linear/Stripe/Claude 深浅色主题）
- [x] 主题颜色修复（MenuButton/SessionLogSettings/NewConnectionModal/SimpleInput/SimpleSelect/useTerminalTheme）

### 架构

- [x] TerminalPanel mount-all 架构（Tab 切换无闪烁）
- [x] Protocol Adapter 模式（IPC 调用与 React 解耦）
- [x] 主题感知 xterm（CSS `--terminal-bg` 跟随亮/暗主题）
- [x] ControlService 跨平台架构（Windows/Linux/macOS）
- [x] MCP Server（@modelcontextprotocol/sdk）
- [x] node-pty 懒加载优化
- [x] SSH/WebSocket 自动重连
- [x] 连接健康检查和 API 限流
- [x] 会话日志自动保存（ANSI 脱色，缓冲写入）

### 安全

- [x] Control API 模板注入漏洞修复
- [x] ADB 命令注入（validateAdbArgs 白名单校验）
- [x] Android keycode 范围校验（0-255）
- [x] Shell 环境变量最小化（createMinimalEnv）
- [x] 密码 AES-256-GCM 加密存储
- [x] IPC handler 空值校验
- [x] `ELECTRON_RUN_AS_NODE` 启动脚本修复
- [x] IPC 监听器防重复注册（removeAllListeners）

### 核心功能

- [x] SSH 连接
- [x] Serial 串口连接
- [x] PowerShell 连接
- [x] Bash 连接
- [x] WebSocket 连接
- [x] Android ADB 控制（WiFi ADB / USB）
- [x] 红外控制框架（设备/指令/序列）
