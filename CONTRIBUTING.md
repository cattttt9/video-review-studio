# 参与贡献

感谢你愿意帮助改进 Video Review Studio。项目当前优先保证 Windows 本地工作流稳定、数据不出本机，并保持项目文件向后兼容。

## 开始之前

- Bug 和功能建议请先搜索现有 Issue，避免重复。
- 较大的功能或数据结构变更，请先开 Discussion 或 Issue 说明使用场景和方案。
- 不要提交测试视频、真实项目目录、数据库、FFmpeg 二进制、构建产物或包含个人路径的日志。
- 安全问题不要公开提交 Issue，请按照 [SECURITY.md](SECURITY.md) 私下报告。

## 本地开发

环境要求：Windows 10/11、Node.js 20 或更高版本、Rust stable（MSVC）以及 FFmpeg/ffprobe。

```powershell
npm ci
.\scripts\prepare-ffmpeg.ps1
npm run tauri dev
```

提交前运行：

```powershell
npm run lint
npm run typecheck
npm test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
```

## 提交与 Pull Request

- 一个 PR 聚焦一个问题，避免混入无关格式化或重构。
- 提交信息建议使用 `feat:`、`fix:`、`docs:`、`test:`、`refactor:` 等前缀。
- UI 修改请附修改前后截图；交互修复请写出复现步骤。
- 数据库、项目格式或导出格式变更必须说明兼容策略，并补充测试和文档。
- PR 表示你同意按本仓库的 MIT 许可证授权你的贡献。

## 设计原则

1. 默认离线、无需账号、无遥测。
2. 不修改用户原始视频，失败时优先保留用户数据。
3. 横版、竖版、高 DPI 和中文路径都属于正常使用场景。
4. 新能力应服务“定位 → 记录 → 标注 → 复盘 → 导出”主流程。
