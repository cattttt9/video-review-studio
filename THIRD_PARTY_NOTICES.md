# 第三方组件与许可证说明

Video Review Studio 的原创源代码采用 [MIT License](LICENSE)。依赖组件仍分别受其自身许可证约束。

## FFmpeg / ffprobe

Windows 安装包会把 `ffmpeg.exe` 和 `ffprobe.exe` 作为独立 sidecar 程序分发，应用通过命令行调用它们，不链接 FFmpeg 库。

当前本地构建使用的二进制信息：

- 本地历史构建为 FFmpeg 8.1 Gyan.dev Windows static full build；GitHub Release 工作流固定使用体积更小、功能足够的 8.1 essentials build；
- 构建配置含 `--enable-gpl --enable-version3`，因此该二进制按 GPLv3 分发；
- FFmpeg 项目：https://ffmpeg.org/
- 构建提供方及构建说明：https://www.gyan.dev/ffmpeg/builds/
- FFmpeg 源码：https://github.com/FFmpeg/FFmpeg
- GPLv3 文本：https://www.gnu.org/licenses/gpl-3.0.html
- 固定源码提交：https://github.com/FFmpeg/FFmpeg/commit/9047fa1b084f76b1b4d065af2d743df1b40dfb56

发布安装包时，Release 必须同时注明实际 FFmpeg 版本、构建来源、配置和 SHA-256，并提供与所分发二进制对应的源码归档或有效书面源码提供方式。更换 FFmpeg 构建后必须同步更新本文件和 Release 说明。

## JavaScript 与 Rust 依赖

完整依赖版本记录在 `package-lock.json` 与 `src-tauri/Cargo.lock`。各依赖的版权与许可证归其作者所有；构建发布前应运行依赖许可证检查，并保留其要求的 notices。

本文件仅记录项目的分发做法，不构成法律意见。
