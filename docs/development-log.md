# 开发日志

## 2026-08-05

### 阶段 P0-P1：初始化、技术验证、项目与数据库

- 完成 Tauri 2 + React 19 + TS strict + Vite 骨架；Ant Design / Zustand / Konva 接入。
- Rust 后端：SQLite（rusqlite bundled）四张核心表 + `schema_migrations`；项目/记录/标注 CRUD；注册表（最近项目）。
- FFmpeg sidecar：ffprobe 元数据、截图、代理生成（进度事件 + 取消）。
- 测试：Vitest 13 项、Rust 5 项；`cargo test` 全绿。
- 提交：`e83ccdb`（scaffold）、`97fcadd`（backend）、`1c92710`（前端基础）。

### 阶段 P2-P3：标注工作流与缩略图记录栏

- Konva 标注编辑器（画笔/直线/箭头/矩形/椭圆/文本、归一化坐标、撤销重做、样式面板与预设）。
- Canvas 合成渲染（缩略图 WebP 缓存、高分辨率预览、原分辨率导出）。
- 右侧卡片栏：排序、单击跳转、双击/按钮放大、编辑/复制/删除。
- 提交：`7ea003f`。

### 阶段 P4-P5：时间轴、效率功能与导出

- 时间轴（标记/区间/播放头/缩放）、快捷键、播放控制（倍速/逐帧/±5s/全屏）。
- 视频丢失检测与重新定位（元数据 + 头尾哈希比对）。
- 导出：单图/批量图片/HTML 报告（相对路径，浏览器打印转 PDF）。
- 提交：`aec6bff`。

### 阶段 P6（进行中）

- 便携项目转换已实现（复制、校验、进度、取消）。
- 定制图标（脚本绘制 → `tauri icon` 全套生成）。
- NSIS 安装包构建完成：`src-tauri/target/release/bundle/nsis/Video Review Studio_0.1.0_x64-setup.exe`（约 114MB）。
- 静默安装/卸载验证通过：安装退出码 0，应用可启动，卸载后目录清理。
- 排障记录：GitHub 下载 NSIS/插件不稳定，通过镜像源获取并核对 SHA1（NSIS `EF7FF767...`、nsis_tauri_utils `75197FEE...`）。
