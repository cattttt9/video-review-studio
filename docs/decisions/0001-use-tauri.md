# ADR 0001：使用 Tauri 2 作为桌面框架

## 背景

需要 Windows 本地桌面应用，原生能力（SQLite、FFmpeg、文件系统）+ Web 技术栈 UI。

## 决策

采用 Tauri 2 + React + TypeScript + Vite。

## 理由

- 体积与内存优于 Electron；Rust 后端适合 FFmpeg 与数据库逻辑。
- 官方 SQLite/文件/对话框/Shell 插件生态成熟。
- 支持 sidecar 内置 FFmpeg，最终用户无需安装依赖。

## 后果

- 依赖 WebView2（Windows 10/11 自带）。
- Rust 编译链是唯一较重的前置条件。

