# 架构设计

## 总体架构

```text
┌──────────────────────────────────────────────┐
│ React WebView (前端)                          │
│ 页面 / 组件 / Zustand / Konva / Canvas 渲染    │
└───────────────┬──────────────────────────────┘
                │ Tauri IPC (invoke) / Event
┌───────────────┴──────────────────────────────┐
│ Rust 后端 (Tauri commands)                    │
│ project / records / annotations / video /    │
│ files / portable                              │
└───────┬──────────────┬──────────────┬────────┘
        │              │              │
   SQLite(rusqlite)  FFmpeg/ffprobe  Filesystem
        │           (sidecar)        (项目目录)
        └──────────────┴──────────────┘
```

## 职责划分

### 前端（React + TS）

- 页面：`HomePage`（新建/打开/最近项目）、`WorkspacePage`（主工作台）。
- 标注编辑：Konva Stage + 归一化坐标；画布导出用原生 Canvas 2D 渲染（缩略图、导出图、预览）。
- 状态：`projectStore`（当前项目）、`videoStore`（播放状态）、`useAnnotationHistory`（撤销/重做）。
- 所有 Tauri 调用集中在 `src/services/*`，错误统一转换为 `CommandError`。

### 后端（Rust）

- `commands/project.rs`：项目创建/打开/列表/删除/重命名/设置。
- `commands/video.rs`：元数据探测、截图、代理生成、播放源解析、重新定位。
- `commands/records.rs`：记录与标注 CRUD、缩略图落盘。
- `commands/files.rs`：导出文件写入、打开/定位。
- `commands/portable.rs`：便携项目转换（复制 + 校验 + 进度）。
- `database/`：SQLite 连接与迁移。
- `services/ffmpeg.rs`：ffprobe/ffmpeg sidecar 封装与进度解析。

## 关键命令接口

| 命令 | 说明 |
| --- | --- |
| `create_project` / `open_project` / `list_recent_projects` | 项目生命周期 |
| `bind_video` / `probe_external_file` | 绑定与探测视频 |
| `capture_screenshot` | FFmpeg 按代表时间截图（PNG 原分辨率） |
| `ensure_proxy` / `cancel_operation` | 代理视频生成与取消（进度事件 `proxy-progress`） |
| `create_record` / `update_record` / `delete_record` / `copy_record` / `list_records` | 记录 CRUD |
| `replace_annotations` / `get_annotations` | 标注持久化（JSON 字符串列） |
| `save_thumbnail` | 缩略图缓存写入（WebP） |
| `write_project_file` / `write_project_text` | 导出文件写入（防目录穿越） |
| `convert_to_portable` | 便携转换（进度事件 `portable-progress`） |

## 自动保存

- 标注变更后前端 1 秒防抖调用 `replace_annotations` + 重新生成缩略图。
- 数据库写入即时完成；保存状态显示在顶栏（已保存/保存中/失败）。
- 记录字段修改（编辑表单）即时写库。

## 缓存策略

- 缩略图：`cache/thumbnails/record-{id}-v{n}.webp`，版本号递增，标注或截图变更后刷新，删除记录时清理。
- 代理视频：`cache/proxy/proxy.mp4`，可删除重建。
- 临时文件：`cache/temp/`，任务取消/失败时清理。
- 重要数据：`project.db`、`screenshots/` 绝不随缓存清理删除。

## 异步任务

- 代理生成、便携复制通过 Rust 异步命令 + 事件（`proxy-progress` / `portable-progress`）回报进度，支持取消。
- 导出在浏览器 Canvas 中按记录逐个渲染并写盘，UI 展示进度，不阻塞主线程。

## 错误处理

- Rust 统一 `AppError`（category / message / recoverable）序列化给前端。
- 前端 `describeError` 展示用户可读信息；数据库失败、截图失败、导出失败均有明确提示。

## 技术取舍

- 缩略图/导出合成放在前端 Canvas（WebView 自带字体渲染），避免 Rust 端字体与矢量绘制复杂度。
- SQLite 使用 `rusqlite` bundled，避免额外安装依赖。
- FFmpeg 使用 sidecar 内置，最终用户无需安装；源码仓库不提交二进制，构建机通过脚本准备。

## 相关 ADR

- [0001-use-tauri](decisions/0001-use-tauri.md)
- [0002-use-normalized-annotation-coordinates](decisions/0002-use-normalized-annotation-coordinates.md)
- [0003-store-source-screenshot-and-vector-annotations](decisions/0003-store-source-screenshot-and-vector-annotations.md)
- [0004-cache-annotated-thumbnails](decisions/0004-cache-annotated-thumbnails.md)
- [0005-use-ffmpeg-sidecar](decisions/0005-use-ffmpeg-sidecar.md)

