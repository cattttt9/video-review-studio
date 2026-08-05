# ADR 0005：FFmpeg 以 sidecar 内置

## 背景

需要截图、代理生成、元数据读取，且最终用户不应安装 FFmpeg。

## 决策

- ffmpeg / ffprobe 作为 Tauri externalBin sidecar 打包。
- 源码仓库不提交二进制，构建机通过 `scripts/prepare-ffmpeg.ps1` 准备。

## 后果

- 安装包体积增大（约 400MB，取决于 FFmpeg 构建）。
- 进程调用统一经 `tauri-plugin-shell`，能力白名单限制可执行名与参数。

