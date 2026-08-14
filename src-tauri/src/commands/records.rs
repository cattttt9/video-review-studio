use crate::commands::project::build_dto;
use crate::commands::{get_arc, locked, now, with_project};
use crate::error::AppError;
use crate::models::{AnnotationDto, AnnotationInput, NewRecordInput, ProjectDto, ReviewRecordDto};
use crate::services::project::ProjectLayout;
use crate::state::AppState;
use base64::Engine;
use rusqlite::{params, OptionalExtension, Row};
use std::fs;
use std::path::PathBuf;
use tauri::State;
use uuid::Uuid;

fn record_from_row(row: &Row<'_>) -> rusqlite::Result<ReviewRecordDto> {
    Ok(ReviewRecordDto {
        id: row.get(0)?,
        project_id: row.get(1)?,
        title: row.get(2)?,
        description: row.get(3)?,
        category: row.get(4)?,
        importance: row.get(5)?,
        time_mode: row.get(6)?,
        start_time_ms: row.get(7)?,
        end_time_ms: row.get(8)?,
        representative_time_ms: row.get(9)?,
        has_screenshot: row.get::<_, i64>(10)? != 0,
        source_image_path: row.get(11)?,
        thumbnail_path: row.get(12)?,
        thumbnail_version: row.get(13)?,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
    })
}

const RECORD_SELECT: &str = "SELECT id, project_id, title, description, category, importance,
        time_mode, start_time_ms, end_time_ms, representative_time_ms, has_screenshot,
        source_image_path, thumbnail_path, thumbnail_version, created_at, updated_at
        FROM review_record";

fn query_record(conn: &rusqlite::Connection, record_id: &str) -> Result<ReviewRecordDto, AppError> {
    conn.query_row(
        &format!("{RECORD_SELECT} WHERE id = ?1"),
        params![record_id],
        |row| record_from_row(row),
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => {
            AppError::NotFound(format!("记录不存在: {record_id}"))
        }
        other => AppError::Db(other),
    })
}

fn validate_record(input: &NewRecordInput) -> Result<(), AppError> {
    if !matches!(input.time_mode.as_str(), "point" | "interval") {
        return Err(AppError::Invalid(format!(
            "无效的时间模式: {}",
            input.time_mode
        )));
    }
    if input.start_time_ms < 0 || input.end_time_ms < 0 || input.representative_time_ms < 0 {
        return Err(AppError::Invalid("时间不能为负数".into()));
    }
    if input.time_mode == "point" {
        if input.end_time_ms != input.start_time_ms
            || input.representative_time_ms != input.start_time_ms
        {
            return Err(AppError::Invalid(
                "时间点记录的开始、结束与代表时间必须一致".into(),
            ));
        }
    } else if input.start_time_ms > input.representative_time_ms
        || input.representative_time_ms > input.end_time_ms
    {
        return Err(AppError::Invalid(
            "区间记录要求 开始时间 ≤ 代表时间 ≤ 结束时间".into(),
        ));
    }
    Ok(())
}

#[tauri::command]
pub fn create_record(
    state: State<'_, AppState>,
    project_id: String,
    input: NewRecordInput,
) -> Result<ReviewRecordDto, AppError> {
    validate_record(&input)?;
    with_project(&state, &project_id, |handle| {
        let conn = handle
            .conn
            .lock()
            .map_err(|_| AppError::Other("项目锁异常".into()))?;
        let id = Uuid::new_v4().to_string();
        let timestamp = now();
        conn.execute(
            "INSERT INTO review_record (id, project_id, title, description, category, importance,
                    time_mode, start_time_ms, end_time_ms, representative_time_ms,
                    has_screenshot, source_image_path, thumbnail_path, thumbnail_version,
                    created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, NULL, 1, ?13, ?13)",
            params![
                id,
                project_id,
                input.title,
                input.description,
                input.category,
                input.importance,
                input.time_mode,
                input.start_time_ms,
                input.end_time_ms,
                input.representative_time_ms,
                if input.has_screenshot { 1 } else { 0 },
                input.source_image_path,
                timestamp
            ],
        )?;
        query_record(&conn, &id)
    })
}

#[tauri::command]
pub fn update_record(
    state: State<'_, AppState>,
    project_id: String,
    record_id: String,
    input: NewRecordInput,
) -> Result<ReviewRecordDto, AppError> {
    validate_record(&input)?;
    with_project(&state, &project_id, |handle| {
        let conn = handle
            .conn
            .lock()
            .map_err(|_| AppError::Other("项目锁异常".into()))?;
        let (old_image, old_thumbnail): (Option<String>, Option<String>) = conn
            .query_row(
                "SELECT source_image_path, thumbnail_path FROM review_record WHERE id = ?1 AND project_id = ?2",
                params![record_id, project_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => {
                    AppError::NotFound(format!("记录不存在: {record_id}"))
                }
                other => AppError::Db(other),
            })?;

        let keep_image = input.has_screenshot && input.source_image_path.is_some();
        let new_image = if keep_image {
            input.source_image_path.clone()
        } else {
            None
        };
        conn.execute(
            "UPDATE review_record SET title = ?1, description = ?2, category = ?3, importance = ?4,
                    time_mode = ?5, start_time_ms = ?6, end_time_ms = ?7, representative_time_ms = ?8,
                    has_screenshot = ?9, source_image_path = ?10, updated_at = ?11
             WHERE id = ?12 AND project_id = ?13",
            params![
                input.title,
                input.description,
                input.category,
                input.importance,
                input.time_mode,
                input.start_time_ms,
                input.end_time_ms,
                input.representative_time_ms,
                if input.has_screenshot { 1 } else { 0 },
                new_image,
                now(),
                record_id,
                project_id
            ],
        )?;
        if !keep_image {
            if let Some(image) = old_image {
                let _ = fs::remove_file(&image);
            }
            if let Some(thumb) = old_thumbnail {
                let _ = fs::remove_file(&thumb);
            }
        }
        query_record(&conn, &record_id)
    })
}

#[tauri::command]
pub fn delete_record(
    state: State<'_, AppState>,
    project_id: String,
    record_id: String,
) -> Result<(), AppError> {
    with_project(&state, &project_id, |handle| {
        let conn = handle
            .conn
            .lock()
            .map_err(|_| AppError::Other("项目锁异常".into()))?;
        let (image, thumb): (Option<String>, Option<String>) = conn
            .query_row(
                "SELECT source_image_path, thumbnail_path FROM review_record WHERE id = ?1 AND project_id = ?2",
                params![record_id, project_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?
            .unwrap_or((None, None));
        conn.execute(
            "DELETE FROM annotation WHERE record_id = ?1",
            params![record_id],
        )?;
        conn.execute(
            "DELETE FROM review_record WHERE id = ?1 AND project_id = ?2",
            params![record_id, project_id],
        )?;
        if let Some(image) = image {
            let _ = fs::remove_file(&image);
        }
        if let Some(thumb) = thumb {
            let _ = fs::remove_file(&thumb);
        }
        Ok(())
    })
}

#[tauri::command]
pub fn copy_record(
    state: State<'_, AppState>,
    project_id: String,
    record_id: String,
) -> Result<ReviewRecordDto, AppError> {
    with_project(&state, &project_id, |handle| {
        let conn = handle
            .conn
            .lock()
            .map_err(|_| AppError::Other("项目锁异常".into()))?;
        let source = query_record(&conn, &record_id)?;
        let new_id = Uuid::new_v4().to_string();
        let timestamp = now();

        let new_image: Option<String> = if let Some(image) = &source.source_image_path {
            let ext = std::path::Path::new(image)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("png");
            let new_path = ProjectLayout::screenshots(&handle.dir)
                .join(format!("record-{new_id}-source.{ext}"));
            fs::copy(image, &new_path).ok();
            Some(new_path.to_string_lossy().to_string())
        } else {
            None
        };

        conn.execute(
            "INSERT INTO review_record (id, project_id, title, description, category, importance,
                    time_mode, start_time_ms, end_time_ms, representative_time_ms,
                    has_screenshot, source_image_path, thumbnail_path, thumbnail_version,
                    created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, NULL, 1, ?13, ?13)",
            params![
                new_id,
                project_id,
                source.title,
                source.description,
                source.category,
                source.importance,
                source.time_mode,
                source.start_time_ms,
                source.end_time_ms,
                source.representative_time_ms,
                if source.has_screenshot { 1 } else { 0 },
                new_image,
                timestamp
            ],
        )?;

        let annotations: Vec<AnnotationDto> = {
            let mut stmt = conn.prepare(
                "SELECT id, record_id, type, z_index, style_json, geometry_json, content, created_at, updated_at
                 FROM annotation WHERE record_id = ?1 ORDER BY z_index",
            )?;
            let rows = stmt.query_map(params![record_id], |row| {
                Ok(AnnotationDto {
                    id: row.get(0)?,
                    record_id: row.get(1)?,
                    annotation_type: row.get(2)?,
                    z_index: row.get(3)?,
                    style_json: row.get(4)?,
                    geometry_json: row.get(5)?,
                    content: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })?;
            rows.collect::<Result<Vec<_>, _>>()?
        };

        for annotation in annotations {
            conn.execute(
                "INSERT INTO annotation (id, record_id, type, z_index, style_json, geometry_json,
                        content, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
                params![
                    Uuid::new_v4().to_string(),
                    new_id,
                    annotation.annotation_type,
                    annotation.z_index,
                    annotation.style_json,
                    annotation.geometry_json,
                    annotation.content,
                    timestamp
                ],
            )?;
        }

        query_record(&conn, &new_id)
    })
}

#[tauri::command]
pub fn list_records(
    state: State<'_, AppState>,
    project_id: String,
    sort_mode: Option<String>,
    sort_direction: Option<String>,
) -> Result<Vec<ReviewRecordDto>, AppError> {
    with_project(&state, &project_id, |handle| {
        let conn = handle
            .conn
            .lock()
            .map_err(|_| AppError::Other("项目锁异常".into()))?;
        let (mode, direction) = conn
            .query_row(
                "SELECT sort_mode, sort_direction FROM project WHERE id = ?1",
                params![project_id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
            )
            .optional()?
            .unwrap_or(("video_time".to_string(), "asc".to_string()));
        let mode = sort_mode.unwrap_or(mode);
        let direction = sort_direction.unwrap_or(direction);
        if !matches!(mode.as_str(), "video_time" | "created_at") {
            return Err(AppError::Invalid("无效的排序字段".into()));
        }
        if !matches!(direction.as_str(), "asc" | "desc") {
            return Err(AppError::Invalid("无效的排序方向".into()));
        }
        let order_col = if mode == "video_time" {
            "start_time_ms"
        } else {
            "created_at"
        };
        let sql = format!(
            "{RECORD_SELECT} WHERE project_id = ?1 ORDER BY {order_col} {}",
            direction
        );
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map(params![project_id], |row| record_from_row(row))?;
        let records = rows.collect::<Result<Vec<_>, _>>()?;
        Ok(records)
    })
}

fn annotation_from_row(row: &Row<'_>) -> rusqlite::Result<AnnotationDto> {
    Ok(AnnotationDto {
        id: row.get(0)?,
        record_id: row.get(1)?,
        annotation_type: row.get(2)?,
        z_index: row.get(3)?,
        style_json: row.get(4)?,
        geometry_json: row.get(5)?,
        content: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

#[tauri::command]
pub fn get_annotations(
    state: State<'_, AppState>,
    project_id: String,
    record_id: String,
) -> Result<Vec<AnnotationDto>, AppError> {
    with_project(&state, &project_id, |handle| {
        let conn = handle
            .conn
            .lock()
            .map_err(|_| AppError::Other("项目锁异常".into()))?;
        let mut stmt = conn.prepare(
            "SELECT id, record_id, type, z_index, style_json, geometry_json, content, created_at, updated_at
             FROM annotation WHERE record_id = ?1 ORDER BY z_index, created_at",
        )?;
        let rows = stmt.query_map(params![record_id], |row| annotation_from_row(row))?;
        let annotations = rows.collect::<Result<Vec<_>, _>>()?;
        Ok(annotations)
    })
}

#[tauri::command]
pub fn replace_annotations(
    state: State<'_, AppState>,
    project_id: String,
    record_id: String,
    annotations: Vec<AnnotationInput>,
) -> Result<Vec<AnnotationDto>, AppError> {
    with_project(&state, &project_id, |handle| {
        let conn = handle
            .conn
            .lock()
            .map_err(|_| AppError::Other("项目锁异常".into()))?;
        let exists: i64 = conn.query_row(
            "SELECT COUNT(*) FROM review_record WHERE id = ?1 AND project_id = ?2",
            params![record_id, project_id],
            |row| row.get(0),
        )?;
        if exists == 0 {
            return Err(AppError::NotFound(format!("记录不存在: {record_id}")));
        }
        conn.execute(
            "DELETE FROM annotation WHERE record_id = ?1",
            params![record_id],
        )?;
        let timestamp = now();
        for annotation in annotations {
            let id = if annotation.id.trim().is_empty() {
                Uuid::new_v4().to_string()
            } else {
                annotation.id.clone()
            };
            conn.execute(
                "INSERT INTO annotation (id, record_id, type, z_index, style_json, geometry_json,
                        content, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
                params![
                    id,
                    record_id,
                    annotation.annotation_type,
                    annotation.z_index,
                    annotation.style_json,
                    annotation.geometry_json,
                    annotation.content,
                    timestamp
                ],
            )?;
        }
        let mut stmt = conn.prepare(
            "SELECT id, record_id, type, z_index, style_json, geometry_json, content, created_at, updated_at
             FROM annotation WHERE record_id = ?1 ORDER BY z_index, created_at",
        )?;
        let rows = stmt.query_map(params![record_id], |row| annotation_from_row(row))?;
        let result = rows.collect::<Result<Vec<_>, _>>()?;
        Ok(result)
    })
}

#[tauri::command]
pub fn save_thumbnail(
    state: State<'_, AppState>,
    project_id: String,
    record_id: String,
    version: i64,
    data_base64: String,
) -> Result<String, AppError> {
    with_project(&state, &project_id, |handle| {
        let data = data_base64.split(',').next_back().unwrap_or(&data_base64);
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(data)
            .map_err(|e| AppError::Invalid(format!("缩略图数据解码失败: {e}")))?;
        let dir = ProjectLayout::thumbnails(&handle.dir);
        fs::create_dir_all(&dir)?;
        let path = dir.join(format!("record-{record_id}-v{version}.webp"));
        fs::write(&path, &bytes)?;

        let conn = handle
            .conn
            .lock()
            .map_err(|_| AppError::Other("项目锁异常".into()))?;
        let old_thumb: Option<String> = conn
            .query_row(
                "SELECT thumbnail_path FROM review_record WHERE id = ?1 AND project_id = ?2",
                params![record_id, project_id],
                |row| row.get(0),
            )
            .optional()?
            .flatten();
        conn.execute(
            "UPDATE review_record SET thumbnail_path = ?1, thumbnail_version = ?2, updated_at = ?3
             WHERE id = ?4 AND project_id = ?5",
            params![
                path.to_string_lossy().to_string(),
                version,
                now(),
                record_id,
                project_id
            ],
        )?;
        if let Some(old) = old_thumb {
            let old_path = PathBuf::from(&old);
            if old_path != path {
                let _ = fs::remove_file(&old_path);
            }
        }
        Ok(path.to_string_lossy().to_string())
    })
}

#[tauri::command]
pub fn refresh_project_dto(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<ProjectDto, AppError> {
    let arc = get_arc(&state, &project_id)?;
    let guard = locked(&arc)?;
    build_dto(&*guard)
}
