# 安全政策

## 支持范围

安全修复优先应用于最新发布版本。0.x 阶段不承诺长期维护旧版本，建议复现问题前先升级到最新版本。

## 报告漏洞

请使用 GitHub 的 **Private vulnerability reporting**（仓库 `Security` → `Report a vulnerability`）提交，不要公开创建 Issue。仓库公开后，维护者需在 `Settings` → `Code security` 中启用此功能。

报告中请包含：

- 受影响版本和 Windows 版本；
- 可复现的最小步骤；
- 预期影响及可能访问到的数据；
- 如有必要，提供已脱敏的日志或示例项目。

请勿上传真实视频、用户项目、访问令牌或其他敏感数据。维护者会尽力在 7 天内确认收到报告，并在确认影响后同步修复计划。

## 安全边界

- 应用是本地桌面工具，不提供网络服务、账号或云同步。
- 用户主动选择的视频和项目目录会被授权给应用读取；导出目录会被授权写入。
- Release 安装包包含独立 FFmpeg/ffprobe 程序，其许可证和来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
