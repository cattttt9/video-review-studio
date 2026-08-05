pub mod files;
pub mod portable;
pub mod project;
pub mod records;
pub mod video;

use crate::error::AppError;
use crate::models::VideoMetaDto;
use crate::state::{AppState, ProjectHandle};
use chrono::Local;
use rusqlite::{params, Connection};
use std::sync::{Arc, Mutex, MutexGuard};
use uuid::Uuid;

pub(crate) fn now() -> String {
    Local::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, false)
}

pub(crate) fn insert_video_meta(
    conn: &Connection,
    project_id: &str,
    meta: &VideoMetaDto,
) -> Result<(), AppError> {
    let timestamp = now();
    let meta_id = Uuid::new_v4().to_string();
    conn.execute(
        "DELETE FROM video_meta WHERE project_id = ?1",
        params![project_id],
    )?;
    conn.execute(
        "INSERT INTO video_meta (id, project_id, file_name, file_size, duration_ms, width, height,
                frame_rate, codec, container_format, rotation, hash_head, hash_tail, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?14)",
        params![
            meta_id,
            project_id,
            meta.file_name,
            meta.file_size,
            meta.duration_ms,
            meta.width,
            meta.height,
            meta.frame_rate,
            meta.codec,
            meta.container_format,
            meta.rotation,
            meta.hash_head,
            meta.hash_tail,
            timestamp
        ],
    )?;
    Ok(())
}

pub(crate) fn get_arc(
    state: &AppState,
    project_id: &str,
) -> Result<Arc<Mutex<ProjectHandle>>, AppError> {
    state
        .projects
        .lock()
        .map_err(|_| AppError::Other("项目状态锁异常".into()))?
        .get(project_id)
        .cloned()
        .ok_or_else(|| AppError::NotFound(format!("项目未打开: {project_id}")))
}

pub(crate) fn with_project<T>(
    state: &AppState,
    project_id: &str,
    f: impl FnOnce(&mut ProjectHandle) -> Result<T, AppError>,
) -> Result<T, AppError> {
    let arc = get_arc(state, project_id)?;
    let mut guard = arc
        .lock()
        .map_err(|_| AppError::Other("项目锁异常".into()))?;
    f(&mut guard)
}

pub(crate) fn locked(
    arc: &Arc<Mutex<ProjectHandle>>,
) -> Result<MutexGuard<'_, ProjectHandle>, AppError> {
    arc.lock().map_err(|_| AppError::Other("项目锁异常".into()))
}
