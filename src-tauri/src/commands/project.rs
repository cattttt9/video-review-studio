use crate::commands::{get_arc, with_project};
use crate::commands::{insert_video_meta, locked, now};
use crate::database;
use crate::error::AppError;
use crate::models::{
    ProjectDto, ProjectInfo, RecentProjectEntry, VideoMetaDto,
};
use crate::services::project as project_service;
use crate::services::project::{create_layout, resolve_video_path};
use crate::state::{AppState, ProjectHandle};
use chrono::Local;
use rusqlite::{params, OptionalExtension};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

pub(crate) fn build_dto(handle: &ProjectHandle) -> Result<ProjectDto, AppError> {
    let conn = handle
        .conn
        .lock()
        .map_err(|_| AppError::Other("项目锁异常".into()))?;

    let (name, description, template_type, source_mode, source_video_path, portable_video_path, sort_mode, sort_direction, created_at, updated_at, last_opened_at) =
        conn.query_row(
            "SELECT name, description, template_type, source_mode, source_video_path,
                    portable_video_path, sort_mode, sort_direction, created_at, updated_at, last_opened_at
             FROM project WHERE id = ?1",
            params![handle.info.id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, String>(7)?,
                    row.get::<_, String>(8)?,
                    row.get::<_, String>(9)?,
                    row.get::<_, Option<String>>(10)?,
                ))
            },
        )
        .map_err(|e| {
            if matches!(e, rusqlite::Error::QueryReturnedNoRows) {
                AppError::Project("项目数据库损坏：project 记录缺失".into())
            } else {
                AppError::Db(e)
            }
        })?;

    let video_meta: Option<VideoMetaDto> = conn
        .query_row(
            "SELECT id, project_id, file_name, file_size, duration_ms, width, height,
                    frame_rate, codec, container_format, rotation, hash_head, hash_tail,
                    created_at, updated_at
             FROM video_meta WHERE project_id = ?1",
            params![handle.info.id],
            |row| {
                Ok(VideoMetaDto {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    file_name: row.get(2)?,
                    file_size: row.get(3)?,
                    duration_ms: row.get(4)?,
                    width: row.get(5)?,
                    height: row.get(6)?,
                    frame_rate: row.get(7)?,
                    codec: row.get(8)?,
                    container_format: row.get(9)?,
                    rotation: row.get(10)?,
                    hash_head: row.get(11)?,
                    hash_tail: row.get(12)?,
                    created_at: row.get(13)?,
                    updated_at: row.get(14)?,
                })
            },
        )
        .optional()?;

    let record_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM review_record WHERE project_id = ?1",
        params![handle.info.id],
        |row| row.get(0),
    )?;

    let resolved = resolve_video_path(&handle.info, &handle.dir);
    let video_exists = if handle.info.source_video_path.is_empty() {
        false
    } else {
        resolved.exists()
    };

    Ok(ProjectDto {
        id: handle.info.id.clone(),
        name,
        description,
        template_type,
        source_mode,
        source_video_path,
        portable_video_path,
        project_dir: handle.dir.to_string_lossy().to_string(),
        sort_mode,
        sort_direction,
        created_at,
        updated_at,
        last_opened_at,
        video_meta,
        video_exists,
        resolved_video_path: if video_exists {
            Some(resolved.to_string_lossy().to_string())
        } else {
            None
        },
        record_count,
    })
}

fn sync_info_from_db(handle: &mut ProjectHandle) -> Result<(), AppError> {
    let conn = handle
        .conn
        .lock()
        .map_err(|_| AppError::Other("项目锁异常".into()))?;
    let row = conn.query_row(
        "SELECT name, description, source_mode, source_video_path, portable_video_path,
                created_at, updated_at, last_opened_at
         FROM project WHERE id = ?1",
        params![handle.info.id],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Option<String>>(7)?,
            ))
        },
    )?;
    drop(conn);
    handle.info.name = row.0;
    handle.info.description = row.1;
    handle.info.source_mode = row.2;
    handle.info.source_video_path = row.3;
    handle.info.portable_video_path = row.4;
    handle.info.created_at = row.5;
    handle.info.updated_at = row.6;
    handle.info.last_opened_at = row.7;
    project_service::save_info(&handle.dir, &handle.info)
}

#[tauri::command]
pub async fn create_project(
    state: State<'_, AppState>,
    app: AppHandle,
    name: String,
    source_video_path: Option<String>,
    parent_dir: Option<String>,
) -> Result<ProjectDto, AppError> {
    let parent = match parent_dir {
        Some(dir) => PathBuf::from(dir),
        None => app
            .path()
            .document_dir()
            .or_else(|_| app.path().desktop_dir())
            .unwrap_or_else(|_| PathBuf::from(".")),
    };
    std::fs::create_dir_all(&parent)?;
    let dir = project_service::unique_project_dir(&parent, &name);
    create_layout(&dir)?;

    let id = Uuid::new_v4().to_string();
    let timestamp = now();
    let info = ProjectInfo {
        schema_version: project_service::SCHEMA_VERSION,
        id: id.clone(),
        name: name.clone(),
        description: None,
        source_mode: "referenced".to_string(),
        source_video_path: source_video_path.clone().unwrap_or_default(),
        portable_video_path: None,
        created_at: timestamp.clone(),
        updated_at: timestamp.clone(),
        last_opened_at: Some(timestamp.clone()),
    };
    project_service::save_info(&dir, &info)?;

    let conn = database::open(&dir)?;
    conn.execute(
        "INSERT INTO project (id, name, description, template_type, source_mode,
                source_video_path, portable_video_path, sort_mode, sort_direction,
                created_at, updated_at, last_opened_at)
         VALUES (?1, ?2, NULL, 'blank', 'referenced', ?3, NULL, 'video_time', 'asc', ?4, ?4, ?4)",
        params![id, name, info.source_video_path, timestamp],
    )?;

    let mut handle = ProjectHandle {
        conn: Mutex::new(conn),
        dir: dir.clone(),
        info,
    };

    if let Some(video_path) = source_video_path {
        if !video_path.is_empty() {
            let meta = crate::services::ffmpeg::probe(&app, &video_path).await?;
            let conn = handle
                .conn
                .lock()
                .map_err(|_| AppError::Other("项目锁异常".into()))?;
            insert_video_meta(&conn, &id, &meta)?;
            drop(conn);
            {
                let conn = handle
                    .conn
                    .lock()
                    .map_err(|_| AppError::Other("项目锁异常".into()))?;
                conn.execute(
                    "UPDATE project SET source_video_path = ?1, updated_at = ?2 WHERE id = ?3",
                    params![video_path, now(), id],
                )?;
            }
            let _ = sync_info_from_db(&mut handle);
        }
    }

    project_service::upsert_recent(&app, &dir, &name)?;
    let arc = std::sync::Arc::new(Mutex::new(handle));
    state
        .projects
        .lock()
        .map_err(|_| AppError::Other("项目状态锁异常".into()))?
        .insert(id.clone(), arc.clone());
    let guard = locked(&arc)?;
    build_dto(&*guard)
}

#[tauri::command]
pub fn open_project(
    state: State<'_, AppState>,
    app: AppHandle,
    project_dir: String,
) -> Result<ProjectDto, AppError> {
    let dir = PathBuf::from(&project_dir);
    if !dir.join("project.json").exists() {
        return Err(AppError::Project(format!(
            "不是有效的项目目录（缺少 project.json）: {}",
            dir.display()
        )));
    }
    if !dir.join("project.db").exists() {
        return Err(AppError::Project(format!(
            "项目数据库缺失（project.db）: {}",
            dir.display()
        )));
    }

    let mut info = project_service::load_info(&dir)?;
    let conn = database::open(&dir)?;
    info.last_opened_at = Some(now());

    conn.execute(
        "UPDATE project SET last_opened_at = ?1, updated_at = ?1 WHERE id = ?2",
        params![now(), info.id],
    )?;
    project_service::save_info(&dir, &info)?;
    project_service::upsert_recent(&app, &dir, &info.name)?;

    let handle = ProjectHandle {
        conn: Mutex::new(conn),
        dir,
        info,
    };
    let arc = std::sync::Arc::new(Mutex::new(handle));
    state
        .projects
        .lock()
        .map_err(|_| AppError::Other("项目状态锁异常".into()))?
        .insert(locked(&arc)?.info.id.clone(), arc.clone());
    let guard = locked(&arc)?;
    build_dto(&*guard)
}

#[tauri::command]
pub fn list_recent_projects(app: AppHandle) -> Result<Vec<RecentProjectEntry>, AppError> {
    let registry = project_service::read_registry(&app)?;
    let mut out = Vec::new();
    for item in registry.projects {
        let dir = PathBuf::from(&item.dir);
        let valid = dir.join("project.json").exists() && dir.join("project.db").exists();
        if !valid {
            out.push(RecentProjectEntry {
                dir: item.dir.clone(),
                name: item.name.clone(),
                last_opened_at: item.last_opened_at.clone(),
                source_mode: "unknown".to_string(),
                video_exists: false,
                record_count: 0,
                video_file_name: None,
                project_valid: false,
            });
            continue;
        }

        let info = match project_service::load_info(&dir) {
            Ok(info) => info,
            Err(_) => continue,
        };
        let resolved = resolve_video_path(&info, &dir);
        let record_count = match database::open(&dir) {
            Ok(conn) => conn
                .query_row(
                    "SELECT COUNT(*) FROM review_record WHERE project_id = ?1",
                    params![info.id],
                    |row| row.get::<_, i64>(0),
                )
                .unwrap_or(0),
            Err(_) => 0,
        };
        out.push(RecentProjectEntry {
            dir: item.dir.clone(),
            name: info.name.clone(),
            last_opened_at: item.last_opened_at,
            source_mode: info.source_mode.clone(),
            video_exists: !info.source_video_path.is_empty() && resolved.exists(),
            record_count,
            video_file_name: Path::new(&info.source_video_path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string()),
            project_valid: true,
        });
    }
    Ok(out)
}

#[tauri::command]
pub fn delete_project(
    state: State<'_, AppState>,
    app: AppHandle,
    project_dir: String,
) -> Result<(), AppError> {
    let dir = PathBuf::from(&project_dir);
    let info = project_service::load_info(&dir)?;
    {
        let mut projects = state
            .projects
            .lock()
            .map_err(|_| AppError::Other("项目状态锁异常".into()))?;
        projects.remove(&info.id);
    }
    let trash = project_service::trash_dir(&app)?;
    let target = trash.join(format!(
        "{}-{}",
        project_service::sanitize_dir_name(&info.name),
        Local::now().format("%Y%m%d-%H%M%S")
    ));
    let mut n = 2;
    let mut final_target = target.clone();
    while final_target.exists() {
        final_target = PathBuf::from(format!("{}-{}", target.to_string_lossy(), n));
        n += 1;
    }
    std::fs::rename(&dir, &final_target)?;
    project_service::remove_from_registry(&app, &dir)?;
    Ok(())
}

#[tauri::command]
pub fn rename_project(
    state: State<'_, AppState>,
    app: AppHandle,
    project_id: String,
    new_name: String,
) -> Result<ProjectDto, AppError> {
    let new_name = new_name.trim().to_string();
    if new_name.is_empty() {
        return Err(AppError::Invalid("项目名称不能为空".into()));
    }
    let (dir, name) = with_project(&state, &project_id, |handle| {
        let conn = handle
            .conn
            .lock()
            .map_err(|_| AppError::Other("项目锁异常".into()))?;
        conn.execute(
            "UPDATE project SET name = ?1, updated_at = ?2 WHERE id = ?3",
            params![new_name, now(), project_id],
        )?;
        handle.info.name = new_name.clone();
        project_service::save_info(&handle.dir, &handle.info)?;
        Ok((handle.dir.clone(), new_name.clone()))
    })?;
    project_service::upsert_recent(&app, &dir, &name)?;
    let arc = get_arc(&state, &project_id)?;
    let guard = locked(&arc)?;
    build_dto(&*guard)
}

#[tauri::command]
pub fn update_project_settings(
    state: State<'_, AppState>,
    app: AppHandle,
    project_id: String,
    sort_mode: String,
    sort_direction: String,
    description: Option<String>,
) -> Result<ProjectDto, AppError> {
    if !["video_time", "created_at"].contains(&sort_mode.as_str()) {
        return Err(AppError::Invalid("无效的排序字段".into()));
    }
    if !["asc", "desc"].contains(&sort_direction.as_str()) {
        return Err(AppError::Invalid("无效的排序方向".into()));
    }
    with_project(&state, &project_id, |handle| {
        let conn = handle
            .conn
            .lock()
            .map_err(|_| AppError::Other("项目锁异常".into()))?;
        conn.execute(
            "UPDATE project SET sort_mode = ?1, sort_direction = ?2, description = ?3, updated_at = ?4 WHERE id = ?5",
            params![sort_mode, sort_direction, description, now(), project_id],
        )?;
        project_service::save_info(&handle.dir, &handle.info)?;
        Ok(())
    })?;
    let arc = get_arc(&state, &project_id)?;
    let guard = locked(&arc)?;
    let dto = build_dto(&*guard)?;
    project_service::upsert_recent(&app, &PathBuf::from(&dto.project_dir), &dto.name)?;
    Ok(dto)
}

#[tauri::command]
pub fn close_project(state: State<'_, AppState>, project_id: String) -> Result<(), AppError> {
    state
        .projects
        .lock()
        .map_err(|_| AppError::Other("项目状态锁异常".into()))?
        .remove(&project_id);
    Ok(())
}
