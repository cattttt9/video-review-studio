# 构建与发布

## 开发环境

- Windows 10/11 x64
- Node.js ≥ 20（当前开发使用 22.x）
- Rust stable（MSVC target，当前 1.97.x）
- FFmpeg/ffprobe（仅构建机需要）

## Rust 与 Node 版本

- `package.json`：React 19、Vite 7、TypeScript 5.8、Ant Design 5、Konva 9。
- `Cargo.toml`：Tauri 2.11、rusqlite 0.32（bundled）、tauri-plugin-dialog/fs/shell/opener。

## FFmpeg sidecar

```powershell
.\scripts\prepare-ffmpeg.ps1
```

- 脚本将 PATH 中的 ffmpeg.exe / ffprobe.exe 复制到 `src-tauri/binaries/` 并追加 target triple 后缀。
- 该目录已 Git 忽略；安装包构建时由 `tauri.conf.json > bundle.externalBin` 自动打包。

## Windows 构建

```bash
npm install
npm run lint && npm run typecheck && npm run test
cd src-tauri && cargo test
cd ..
npm run tauri build
```

## 安装包

- NSIS 安装包：`src-tauri/target/release/bundle/nsis/Video Review Studio_0.1.1_x64-setup.exe`
- 便携可执行：`src-tauri/target/release/Video Review Studio.exe`
- 语言：简体中文 + English

## 版本号

- 版本号集中在 `package.json`、`Cargo.toml`、`tauri.conf.json`，发布前同步更新。
- 语义化版本，未发布阶段为 0.x。

## 发布检查

1. `git status` 干净
2. 全部阶段有本地提交
3. lint / typecheck / test / cargo test 全绿
4. 安装包在无 Node/Rust/FFmpeg 环境可运行
5. 无密钥、无本地绝对路径泄漏、无用户项目数据提交

## 构建产物位置

| 产物 | 路径 |
| --- | --- |
| 前端构建 | `dist/` |
| 调试可执行 | `src-tauri/target/debug/` |
| 发布可执行 | `src-tauri/target/release/` |
| NSIS 安装包 | `src-tauri/target/release/bundle/nsis/` |
