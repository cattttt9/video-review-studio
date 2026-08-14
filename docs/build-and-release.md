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
- 本地脚本复制你指定的二进制，不替你判断许可证。发布前必须执行 `ffmpeg -version` 检查配置，并更新 `THIRD_PARTY_NOTICES.md`。
- GitHub Release 工作流固定下载 Gyan.dev FFmpeg 8.1 essentials ZIP，验证 SHA-256，并附对应 FFmpeg 源码提交 `9047fa1b084f76b1b4d065af2d743df1b40dfb56`、构建 README 和 GPLv3 许可证。

## Windows 构建

```bash
npm install
npm run lint && npm run typecheck && npm run test
cd src-tauri && cargo test
cd ..
npm run tauri build
```

## 安装包

- NSIS 安装包：`src-tauri/target/release/bundle/nsis/Video Review Studio_0.1.3_x64-setup.exe`
- 便携可执行：`src-tauri/target/release/video-review-studio.exe`
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
6. FFmpeg 版本、SHA-256、构建配置、许可证和对应源码已随 Release 提供
7. 安装包 SHA-256 与构建来源证明已生成
8. 未签名版本的 SmartScreen 风险已在 Release 中明确说明

## GitHub 自动化

- `.github/workflows/ci.yml`：push/PR 时在 Windows 运行 lint、类型检查、前端测试/构建、Rust 格式检查与测试。
- `.github/workflows/release.yml`：推送与应用版本一致的 `v*` 标签后生成 Windows x64 **草稿** Release。
- 草稿包含 NSIS 安装包、`SHA256SUMS.txt`、第三方 notices、FFmpeg 构建 README、许可证和对应源码归档。
- 正式公开草稿前，仍需在干净的 Windows 10/11 环境完成安装、启动、导入、标注、PDF 导出与卸载测试。

示例：

```powershell
git tag v0.1.3
git push origin v0.1.3
```

## 构建产物位置

| 产物 | 路径 |
| --- | --- |
| 前端构建 | `dist/` |
| 调试可执行 | `src-tauri/target/debug/` |
| 发布可执行 | `src-tauri/target/release/` |
| NSIS 安装包 | `src-tauri/target/release/bundle/nsis/` |
