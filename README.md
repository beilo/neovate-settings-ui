# Neovate Settings UI

Neovate 配置管理的图形界面工具，基于 Tauri + React + TypeScript 构建。

## 技术栈

- **前端**: React 19 + TypeScript + Ant Design 6 + Zustand
- **后端**: Tauri 2 (Rust)
- **编辑器**: CodeMirror 6

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 启动 Tauri 开发模式
npm run tauri dev

# 构建生产版本
npm run tauri build
```

## 功能

- 可视化编辑 Neovate 配置
- 实时 JSON 预览
- MCP Servers 管理
- Skills 配置与冲突检测
- 插件管理
