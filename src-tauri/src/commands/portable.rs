use crate::commands::{get_arc, locked, now, with_project};
use crate::error::AppError;
use crate::models::{PortableProgressPayload, PortableResult};
use crate::services::fs_util::sanitize_file_name;
use crate::services::hash::head_tail_sha256;
use crate::services::project::{save_info, ProjectLayout};
use crate::state::{AppState, CancelHandle};
use rusqlite::{params, OptionalExtension};
use std::io::{Read, Write};
use std::sync::atomic::Ordering;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

#[tauri::command]
pub async fn convert_to_portable(
    state: State<'_, AppState>,
    app: AppHandle,
    project_id: String,
) -> Result<PortableResult, AppError> {
    let (src, dir, stored_head, stored_tail) = with_project(&state, &project_id, |handle| {
        let src = crate::services::project::resolve_video_path(&handle.info, &handle.dir);
        if !src.exists() {
            return Err(AppError::Video(
                "原视频不存在，无法转换为便携项目".into(),
            ));
        }
        let conn = handle
            .conn
            .lock()
            .map_err(|_| AppError::Other("项目锁异常".into()))?;
        let (head, tail) = conn
            .query_row(
                "SELECT hash_head, hash_tail FROM video_meta WHERE project_id = ?1",
                params![project_id],
                |row| Ok((row.get::<_, Option<String>>(0)?, row.get::<_, Option<String>>(1)?)),
            )
            .optional()?
            .unwrap_or((None, None));
        Ok((src, handle.dir.clone(), head, tail))
    })?;

    let file_name = src
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "source.mp4".to_string());
    let media_dir = ProjectLayout::media(&dir);
    std::fs::create_dir_all(&media_dir)?;
    let final_path = media_dir.join(sanitize_file_name(&file_name));
    if final_path.exists() {
        return Err(AppError::Project(
            "便携视频文件已存在，请先移除 media 目录中的同名文件".into(),
        ));
    }
    let temp_path = media_dir.join(format!(
        ".{}.{}.tmp",
        sanitize_file_name(&file_name),
        Uuid::new_v4().simple()
    ));

    let cancel = CancelHandle::new();
    state
        .cancels
        .lock()
        .map_err(|_| AppError::Other("任务状态锁异常".into()))?
        .insert(project_id.clone(), cancel.clone());

    let total = std::fs::metadata(&src)?.len();
    let copy_result = (|| -> Result<(), AppError> {
        let mut reader = std::fs::File::open(&src)?;
        let mut writer = std::fs::File::create(&temp_path)?;
        let mut buffer = vec![0u8; 8 * 1024 * 1024];
        let mut copied: u64 = 0;
        let mut last_emit = Instant::now();
        loop {
            if cancel.flag.load(Ordering::SeqCst) {
                drop(writer);
                let _ = std::fs::remove_file(&temp_path);
                return Err(AppError::Cancelled);
            }
            let n = reader.read(&mut buffer)?;
            if n == 0 {
                break;
            }
            writer.write_all(&buffer[..n])?;
            copied += n as u64;
            if last_emit.elapsed() >= Duration::from_millis(250) {
                let _ = app.emit(
                    "portable-progress",
                    PortableProgressPayload {
                        project_id: project_id.clone(),
                        copied_bytes: copied as i64,
                        total_bytes: total as i64,
                        percent: if total > 0 {
                            copied as f64 / total as f64 * 100.0
                        } else {
                            100.0
                        },
                    },
                );
                last_emit = Instant::now();
            }
        }
        writer.sync_all()?;
        Ok(())
    })();

    if let Err(err) = copy_result {
        state
            .cancels
            .lock()
            .map_err(|_| AppError::Other("任务状态锁异常".into()))?
            .remove(&project_id);
        let _ = std::fs::remove_file(&temp_path);
        return Err(err);
    }

    // 校验
    let tmp_size = std::fs::metadata(&temp_path)?.len();
    if tmp_size != total {
        let _ = std::fs::remove_file(&temp_path);
        state
            .cancels
            .lock()
            .map_err(|_| AppError::Other("任务状态锁异常".into()))?
            .remove(&project_id);
        return Err(AppError::Project(format!(
            "复制校验失败：源 {total} 字节，目标 {tmp_size} 字节"
        )));
    }
    let (head, tail) = head_tail_sha256(&temp_path)?;
    if let Some(expected) = stored_head.as_deref() {
        if !expected.is_empty() && head != expected {
            let _ = std::fs::remove_file(&temp_path);
            state
                .cancels
                .lock()
                .map_err(|_| AppError::Other("任务状态锁异常".into()))?
                .remove(&project_id);
            return Err(AppError::Project("复制校验失败：文件哈希不一致".into()));
        }
    }
    if let Some(expected) = stored_tail.as_deref() {
        if !expected.is_empty() && tail != expected {
            let _ = std::fs::remove_file(&temp_path);
            state
                .cancels
                .lock()
                .map_err(|_| AppError::Other("任务状态锁异常".into()))?
                .remove(&project_id);
            return Err(AppError::Project("复制校验失败：文件哈希不一致".into()));
        }
    }

    std::fs::rename(&temp_path, &final_path)?;
    let rel = format!("media/{}", final_path.file_name().unwrap().to_string_lossy());

    with_project(&state, &project_id, |handle| {
        let conn = handle
            .conn
            .lock()
            .map_err(|_| AppError::Other("项目锁异常".into()))?;
        conn.execute(
            "UPDATE project SET source_mode = 'portable', source_video_path = ?1,
                    portable_video_path = ?1, updated_at = ?2 WHERE id = ?3",
            params![rel, now(), project_id],
        )?;
        handle.info.source_mode = "portable".to_string();
        handle.info.source_video_path = rel.clone();
        handle.info.portable_video_path = Some(rel.clone());
        handle.info.updated_at = now();
        save_info(&handle.dir, &handle.info)?;
        Ok(())
    })?;

    state
        .cancels
        .lock()
        .map_err(|_| AppError::Other("任务状态锁异常".into()))?
        .remove(&project_id);

    let _ = app.emit(
        "portable-progress",
        PortableProgressPayload {
            project_id: project_id.clone(),
            copied_bytes: total as i64,
            total_bytes: total as i64,
            percent: 100.0,
        },
    );

    let arc = get_arc(&state, &project_id)?;
    let handle = locked(&arc)?;
    Ok(PortableResult {
        project_dir: handle.dir.to_string_lossy().to_string(),
        media_path: final_path.to_string_lossy().to_string(),
    })
}
