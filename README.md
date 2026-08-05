# Video Review Studio · 视频复盘工作台

本地视频拉片与游戏复盘工具。用于快速定位视频关键时刻、自动截取代表画面、在静态截图上绘制标注，并通过右侧缩略图记录流完成复盘、检索与报告导出。

所有数据保存在本地：不上传视频、截图或标注；不需要登录；不接入统计 SDK。

## 功能状态

已实现：

- 项目模型：一个项目绑定一个视频，支持引用模式与便携模式（视频复制进项目目录）
- 视频能力：播放 / 暂停 / 定位 / 逐帧 / 倍速 / 音量 / 全屏；MKV、AVI 等不兼容格式通过 FFmpeg 生成 H.264/AAC 代理视频
- 记录：时间点与时间区间记录、代表时间、自动截图、无截图记录、重新截取、保留或清空标注
- 标注编辑器：画笔 / 直线 / 箭头 / 矩形 / 椭圆 / 文本，归一化坐标，缩放窗口不漂移；撤销 / 重做 / 删除 / 复制 / 样式调整 / 文本预设
- 右侧复盘记录栏：合成标注缩略图（WebP 缓存）、大图小字卡片、单击选中跳转、双击/按钮放大预览（滚轮缩放、拖动平移、前后条切换）、排序（视频时间/创建时间 × 正序/倒序）、编辑 / 复制 / 删除
- 时间轴：时间点与区间标记、播放头、缩放、点击跳转
- 快捷键：Space / ←→ / Shift+←→ / N / Delete / Ctrl+Z / Ctrl+Y / Ctrl+S / T / A / R / P / Esc
- 导出：单条原图、标注图（原分辨率重渲染）、批量图片、HTML 图文报告（相对路径，整目录可移动；浏览器打开后可打印为 PDF）
- 视频丢失检测与重新定位（比较大小、时长、分辨率、编码、头尾哈希，不匹配时提示风险）
- 自动保存：标注修改后防抖自动落盘；数据库写入失败有明确提示
- 数据库版本迁移（`schema_migrations`）

未实现（第一版非目标，见 `docs/requirements.md`）：

- 视频剪辑、拼接、音轨编辑、带标注视频导出
- 云同步、登录、多人协作、遥测
- AI 自动识别、语音转文字

## 技术栈

- 桌面框架：Tauri 2（Rust）
- 前端：React 19 + TypeScript (strict) + Vite 7
- 状态管理：Zustand
- UI：Ant Design 5
- 标注画布：Konva + react-konva
- 数据库：SQLite（rusqlite bundled）
- 视频处理：FFmpeg / ffprobe（sidecar 内置）
- 测试：Vitest + Testing Library；Rust 单元测试

## 环境要求

- Windows 10/11（WebView2 运行时，系统通常已自带）
- 开发：Node.js ≥ 20、Rust stable（MSVC toolchain）、FFmpeg（仅开发时需要，运行安装包不需要）

## 本地开发命令

```bash
npm install
npm run tauri dev
```

首次开发前需准备 FFmpeg sidecar：

```powershell
.\scripts\prepare-ffmpeg.ps1          # 从 PATH 复制 ffmpeg/ffprobe 到 src-tauri/binaries
```

## 测试命令

```bash
npm run lint
npm run typecheck
npm run test
cd src-tauri && cargo test
```

## 构建与打包命令

```bash
npm run build                          # 前端生产构建
npm run tauri build                    # 生成 NSIS 安装包
```

安装包输出到 `src-tauri/target/release/bundle/nsis/`，便携版可执行程序在 `src-tauri/target/release/`。

## FFmpeg 说明

- 应用内置 ffmpeg / ffprobe sidecar，最终用户无需安装 FFmpeg。
- 二进制体积较大，未纳入 Git 仓库；通过 `scripts/prepare-ffmpeg.ps1` 在构建机准备。
- 原视频永不被修改；代理视频写入项目 `cache/proxy/`，截图从原视频提取。

## 项目目录

```text
src/            前端（页面、模块、服务、状态）
src-tauri/src/  Rust 后端（commands / database / services）
docs/           需求、架构、数据库、交互、测试、构建、排障、开发日志、ADR
scripts/        测试视频生成与 FFmpeg 准备脚本
```

用户项目为独立目录：`project.db` + `project.json` + `screenshots/` + `cache/` + `media/`（便携时）+ `exports/` + `backups/`。

## 常见问题

- **打开项目提示视频丢失**：视频被移动或改名，点击“重新定位视频”并选择新路径；系统会比较元数据并提示风险。
- **MKV/AVI 无法播放**：点击“生成兼容代理视频”，应用会用内置 FFmpeg 生成 H.264/AAC 代理。
- **标注保存失败**：检查项目目录是否可写、磁盘空间是否充足；错误信息会说明原因。

## 当前限制

- 第一版为单窗口桌面应用，仅支持 Windows。
- 放大预览与导出在浏览器画布中按原分辨率重渲染，超大 4K 长图导出较慢。
- PDF 导出依赖系统打印（浏览器打开报告后打印）。

## 开发文档

见 `docs/` 目录：需求、架构、数据库设计、交互设计、开发计划、测试说明、构建发布、排障记录、开发日志与架构决策记录（ADR）。

