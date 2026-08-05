# 排障记录

## Tauri 构建：asset protocol 需要 feature

- 现象：`cargo check` 报 `The tauri dependency features ... does not match the allowlist`。
- 原因：启用了 `app.security.assetProtocol` 但未开启 `protocol-asset` feature。
- 解决：`tauri = { version = "2", features = ["protocol-asset"] }`。

## Tauri sidecar：找不到 CommandError / Child 类型

- 现象：`tauri_plugin_shell::process::CommandError` / `Child` 不存在。
- 原因：plugin-shell 2.x 的错误类型是 `tauri_plugin_shell::Error`，子进程类型是 `CommandChild`，`kill()` 按值消费。
- 解决：改用正确类型；取消时 `child.take()` 再 kill。

## FFmpeg 网络/环境

- `cargo` 解析 crates.io 偶发 DNS 失败：重试即可；长任务编译需较长超时。
- sidecar 找不到：确认 `src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe` 存在（`prepare-ffmpeg.ps1`）。

## SQLite

- 多线程访问：所有数据库访问通过 `Mutex<Connection>` 串行化。
- 锁等待：开启 `busy_timeout=5000`；WAL 模式提升并发。
- 迁移失败：事务回滚，不产生半迁移状态。

## WebView 视频兼容

- WebView2 不能播放 MKV/AVI/部分 HEVC：生成 H.264/AAC 代理（`ensure_proxy`）。
- 截图黑屏/空白：确认 FFmpeg 输出非空，错误会明确提示；代理与截图均基于原视频。

## Windows 打包

- 安装包体积大：内置 Gyan 全功能 FFmpeg（约 400MB）；后续可改用 essentials/lgpl 构建。
- NSIS 语言：`bundle.windows.nsis.languages` 配置简体中文与英文。

## 前端

- `eslint no-control-regex`：文件名清洗改为按字符码过滤控制字符。
- Konva 类型：v9 使用默认导出的命名空间类型（`import type Konva from 'konva'`）。

