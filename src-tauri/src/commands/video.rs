use crate::commands::project::build_dto;
use crate::commands::{get_arc, insert_video_meta, locked, now, with_project};
use crate::error::AppError;
use crate::models::{
    PlayableVideo, ProjectDto, ProxyResult, RelocateComparison, VideoMetaDto, VideoStatus,
};
use crate::services::ffmpeg;
use crate::services::fs_util::{file_size, sanitize_file_name};
use crate::services::project::{resolve_video_path, save_info, ProjectLayout};
use crate::state::{AppState, CancelHandle};
use rusqlite::{params, OptionalExtension};
use std::path::Path;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Manager, State};

fn mime_for(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .as_deref()
    {
        Some("mp4") | Some("m4v") => "video/mp4",
        Some("webm") => "video/webm",
        Some("mov") => "video/quicktime",
        Some("mkv") => "video/x-matroska",
        Some("avi") => "video/x-msvideo",
        Some("ts") | Some("mts") | Some("m2ts") => "video/mp2t",
        Some("wmv") => "video/x-ms-wmv",
        Some("flv") => "video/x-flv",
        Some("mpg") | Some("mpeg") => "video/mpeg",
        _ => "video/mp4",
    }
}

#[tauri::command]
pub async fn bind_video(
    state: State<'_, AppState>,
    app: AppHandle,
    project_id: String,
    path: String,
) -> Result<ProjectDto, AppError> {
    if !Path::new(&path).exists() {
        return Err(AppError::Video(format!("视频文件不存在: {path}")));
    }
    app.asset_protocol_scope().allow_file(&path)?;
    let meta = ffmpeg::probe(&app, &path).await?;
    with_project(&state, &project_id, |handle| {
        let conn = handle
            .conn
            .lock()
            .map_err(|_| AppError::Other("项目锁异常".into()))?;
        insert_video_meta(&conn, &project_id, &meta)?;
        conn.execute(
            "UPDATE project SET source_video_path = ?1, source_mode = 'referenced',
                    portable_video_path = NULL, updated_at = ?2 WHERE id = ?3",
            params![path, now(), project_id],
        )?;
        handle.info.source_video_path = path.clone();
        handle.info.source_mode = "referenced".to_string();
        handle.info.portable_video_path = None;
        handle.info.updated_at = now();
        save_info(&handle.dir, &handle.info)?;
        Ok(())
    })?;
    let arc = get_arc(&state, &project_id)?;
    let guard = locked(&arc)?;
    build_dto(&*guard)
}

#[tauri::command]
pub fn check_video(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<VideoStatus, AppError> {
    with_project(&state, &project_id, |handle| {
        let resolved = resolve_video_path(&handle.info, &handle.dir);
        if resolved.exists() {
            Ok(VideoStatus {
                exists: true,
                path: Some(resolved.to_string_lossy().to_string()),
                size: file_size(&resolved),
            })
        } else {
            Ok(VideoStatus {
                exists: false,
                path: None,
                size: None,
            })
        }
    })
}

#[tauri::command]
pub async fn compare_video(
    state: State<'_, AppState>,
    app: AppHandle,
    project_id: String,
    new_path: String,
) -> Result<RelocateComparison, AppError> {
    let stored = with_project(&state, &project_id, |handle| {
        let conn = handle
            .conn
            .lock()
            .map_err(|_| AppError::Other("项目锁异常".into()))?;
        conn.query_row(
            "SELECT file_size, duration_ms, width, height, codec, hash_head, hash_tail
             FROM video_meta WHERE project_id = ?1",
            params![project_id],
            |row| {
                Ok((
                    row.get::<_, Option<i64>>(0)?,
                    row.get::<_, Option<i64>>(1)?,
                    row.get::<_, Option<i64>>(2)?,
                    row.get::<_, Option<i64>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, Option<String>>(6)?,
                ))
            },
        )
        .optional()?
        .ok_or_else(|| AppError::Video("项目还没有绑定视频元数据".into()))
    })?;

    let probed = ffmpeg::probe(&app, &new_path).await?;
    let mut differences = Vec::new();
    if stored.0.is_some() && stored.0 != probed.file_size {
        differences.push("文件大小不一致".to_string());
    }
    if stored.1.is_some() && stored.1 != probed.duration_ms {
        differences.push("视频时长不一致".to_string());
    }
    if stored.2.is_some() && stored.2 != probed.width {
        differences.push("画面宽度不一致".to_string());
    }
    if stored.3.is_some() && stored.3 != probed.height {
        differences.push("画面高度不一致".to_string());
    }
    if stored.4.is_some() && stored.4 != probed.codec {
        differences.push("视频编码不一致".to_string());
    }
    if stored.5.is_some() && stored.5 != probed.hash_head {
        differences.push("文件头部哈希不一致".to_string());
    }
    if stored.6.is_some() && stored.6 != probed.hash_tail {
        differences.push("文件尾部哈希不一致".to_string());
    }
    Ok(RelocateComparison {
        matches: differences.is_empty(),
        differences,
        probed,
    })
}

#[tauri::command]
pub async fn force_bind_video(
    state: State<'_, AppState>,
    app: AppHandle,
    project_id: String,
    new_path: String,
) -> Result<ProjectDto, AppError> {
    if !Path::new(&new_path).exists() {
        return Err(AppError::Video(format!("视频文件不存在: {new_path}")));
    }
    app.asset_protocol_scope().allow_file(&new_path)?;
    let meta = ffmpeg::probe(&app, &new_path).await?;
    with_project(&state, &project_id, |handle| {
        let conn = handle
            .conn
            .lock()
            .map_err(|_| AppError::Other("项目锁异常".into()))?;
        insert_video_meta(&conn, &project_id, &meta)?;
        conn.execute(
            "UPDATE project SET source_video_path = ?1, source_mode = 'referenced',
                    portable_video_path = NULL, updated_at = ?2 WHERE id = ?3",
            params![new_path, now(), project_id],
        )?;
        handle.info.source_video_path = new_path.clone();
        handle.info.source_mode = "referenced".to_string();
        handle.info.portable_video_path = None;
        handle.info.updated_at = now();
        save_info(&handle.dir, &handle.info)?;
        Ok(())
    })?;
    let arc = get_arc(&state, &project_id)?;
    let guard = locked(&arc)?;
    build_dto(&*guard)
}

#[tauri::command]
pub async fn ensure_proxy(
    state: State<'_, AppState>,
    app: AppHandle,
    project_id: String,
) -> Result<ProxyResult, AppError> {
    let (src, total_ms, out) = with_project(&state, &project_id, |handle| {
        let src = resolve_video_path(&handle.info, &handle.dir);
        if !src.exists() {
            return Err(AppError::Video("原视频不存在，无法生成代理视频".into()));
        }
        let out = ProjectLayout::proxy(&handle.dir).join("proxy.mp4");
        let total_ms = handle
            .conn
            .lock()
            .map_err(|_| AppError::Other("项目锁异常".into()))?
            .query_row(
                "SELECT duration_ms FROM video_meta WHERE project_id = ?1",
                params![project_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()?
            .unwrap_or(0);
        Ok((src, total_ms, out))
    })?;

    if out.exists() && file_size(&out).unwrap_or(0) > 0 {
        return Ok(ProxyResult {
            path: out.to_string_lossy().to_string(),
            created: false,
        });
    }

    let cancel = CancelHandle::new();
    state
        .cancels
        .lock()
        .map_err(|_| AppError::Other("任务状态锁异常".into()))?
        .insert(project_id.clone(), cancel.clone());

    let result = ffmpeg::ensure_proxy(
        &app,
        &project_id,
        &src,
        &out,
        total_ms,
        cancel.flag.clone(),
        cancel.child.clone(),
    )
    .await;

    state
        .cancels
        .lock()
        .map_err(|_| AppError::Other("任务状态锁异常".into()))?
        .remove(&project_id);

    result.map(|created| ProxyResult {
        path: out.to_string_lossy().to_string(),
        created,
    })
}

#[tauri::command]
pub fn cancel_operation(state: State<'_, AppState>, project_id: String) -> Result<(), AppError> {
    if let Some(cancel) = state
        .cancels
        .lock()
        .map_err(|_| AppError::Other("任务状态锁异常".into()))?
        .get(&project_id)
        .cloned()
    {
        cancel.flag.store(true, Ordering::SeqCst);
        if let Ok(mut child) = cancel.child.lock() {
            if let Some(child) = child.take() {
                let _ = child.kill();
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn capture_screenshot(
    state: State<'_, AppState>,
    app: AppHandle,
    project_id: String,
    time_ms: i64,
    file_stem: String,
) -> Result<String, AppError> {
    let (src, out) = with_project(&state, &project_id, |handle| {
        let src = resolve_video_path(&handle.info, &handle.dir);
        if !src.exists() {
            return Err(AppError::Video("原视频不存在，无法截图".into()));
        }
        let out = ProjectLayout::screenshots(&handle.dir)
            .join(format!("{}.png", sanitize_file_name(&file_stem)));
        Ok((src, out))
    })?;
    let src = src.to_string_lossy().to_string();
    ffmpeg::capture_frame(&app, &src, time_ms, &out).await?;
    Ok(out.to_string_lossy().to_string())
}

#[tauri::command]
pub fn resolve_playable_video(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<PlayableVideo, AppError> {
    with_project(&state, &project_id, |handle| {
        let proxy = ProjectLayout::proxy(&handle.dir).join("proxy.mp4");
        if proxy.exists() {
            return Ok(PlayableVideo {
                path: proxy.to_string_lossy().to_string(),
                kind: "proxy".to_string(),
                mime: "video/mp4".to_string(),
                uses_proxy: true,
            });
        }
        let src = resolve_video_path(&handle.info, &handle.dir);
        if src.exists() {
            return Ok(PlayableVideo {
                path: src.to_string_lossy().to_string(),
                kind: "source".to_string(),
                mime: mime_for(&src).to_string(),
                uses_proxy: false,
            });
        }
        Err(AppError::Video(
            "视频文件不存在，请重新定位原视频".to_string(),
        ))
    })
}

#[tauri::command]
pub async fn probe_external_file(app: AppHandle, path: String) -> Result<VideoMetaDto, AppError> {
    if !Path::new(&path).exists() {
        return Err(AppError::Video(format!("视频文件不存在: {path}")));
    }
    ffmpeg::probe(&app, &path).await
}
