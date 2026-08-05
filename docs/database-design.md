# 数据库设计

每个项目一个 SQLite 数据库文件（`project.db`），版本迁移通过 `schema_migrations` 表管理。

## 表结构

### project

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | TEXT PK | UUID |
| name | TEXT | 项目名称 |
| description | TEXT | 描述 |
| template_type | TEXT | 模板类型，默认 `blank` |
| source_mode | TEXT | `referenced`（引用）或 `portable`（便携） |
| source_video_path | TEXT | 原视频路径（便携时为相对路径） |
| portable_video_path | TEXT | 便携模式下的相对路径 |
| sort_mode | TEXT | 记录排序字段：`video_time` / `created_at` |
| sort_direction | TEXT | `asc` / `desc` |
| created_at / updated_at / last_opened_at | TEXT | ISO-8601 |

### video_meta

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | TEXT PK | UUID |
| project_id | TEXT FK | 项目 |
| file_name / file_size / duration_ms | - | 文件信息 |
| width / height / frame_rate | - | 画面信息 |
| codec / container_format | TEXT | 编码与容器 |
| rotation | INTEGER | 旋转角度 |
| hash_head / hash_tail | TEXT | 文件头/尾 SHA-256，用于重新定位比对 |

### review_record

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | TEXT PK | UUID |
| project_id | TEXT FK | 项目 |
| title / description / category / importance | TEXT | 元信息 |
| time_mode | TEXT | `point` / `interval` |
| start_time_ms / end_time_ms / representative_time_ms | INTEGER | 时间（毫秒） |
| has_screenshot | INTEGER | 是否保存截图 |
| source_image_path | TEXT | 原始代表截图（PNG）绝对路径 |
| thumbnail_path / thumbnail_version | TEXT/INT | 缩略图缓存与版本 |

### annotation

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | TEXT PK | UUID |
| record_id | TEXT FK | 所属记录（级联删除） |
| type | TEXT | pen / line / arrow / rect / ellipse / text |
| z_index | INTEGER | 层级 |
| style_json | TEXT | 样式（JSON） |
| geometry_json | TEXT | 归一化几何（JSON） |
| content | TEXT | 文本内容 |

## 关系

```text
project 1 ─── * video_meta   （实际每项目一行，外键约束）
project 1 ─── * review_record
review_record 1 ─── * annotation
```

## 索引

- `idx_video_meta_project(project_id)`
- `idx_review_record_project(project_id)`
- `idx_review_record_time(project_id, start_time_ms)`
- `idx_annotation_record(record_id)`

## 迁移机制

- `MIGRATIONS` 数组按版本顺序执行，`schema_migrations(version, applied_at)` 记录已应用版本。
- 迁移在事务内执行，失败不落半成品；重复执行幂等。
- 新增字段只允许向后兼容（可空/默认值）。

## 删除策略

- 删除记录：级联删除标注；同时删除截图与缩略图文件。
- 删除项目：整个项目目录移动到应用数据 `trash/`（可恢复），并移除最近项目索引。
- 便携视频：未经确认不删除外部原视频。

## 数据兼容策略

- `project.json` 为快速索引（schema_version=1），`project.db` 为主要数据源。
- 打开项目时二者必须同时存在；数据库缺失视为项目无效。
- 缩略图属于可重建缓存，缺失时自动重建。

