use crate::commands::with_project;
use crate::error::AppError;
use crate::services::fs_util::safe_join_under;
use crate::services::project::ProjectLayout;
use crate::state::AppState;
use base64::Engine;
use std::fs;
use std::path::Path;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn write_project_file(
    state: State<'_, AppState>,
    project_id: String,
    rel_path: String,
    data_base64: String,
) -> Result<String, AppError> {
    with_project(&state, &project_id, |handle| {
        let root = ProjectLayout::exports(&handle.dir);
        fs::create_dir_all(&root)?;
        let target = safe_join_under(&root, &rel_path)
            .ok_or_else(|| AppError::Invalid("导出路径不合法".into()))?;
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        let data = data_base64
            .split(',')
            .next_back()
            .unwrap_or(&data_base64);
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(data)
            .map_err(|e| AppError::Invalid(format!("导出数据解码失败: {e}")))?;
        fs::write(&target, &bytes)?;
        Ok(target.to_string_lossy().to_string())
    })
}

#[tauri::command]
pub fn write_project_text(
    state: State<'_, AppState>,
    project_id: String,
    rel_path: String,
    content: String,
) -> Result<String, AppError> {
    with_project(&state, &project_id, |handle| {
        let root = ProjectLayout::exports(&handle.dir);
        fs::create_dir_all(&root)?;
        let target = safe_join_under(&root, &rel_path)
            .ok_or_else(|| AppError::Invalid("导出路径不合法".into()))?;
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&target, content)?;
        Ok(target.to_string_lossy().to_string())
    })
}

#[tauri::command]
pub fn reveal_in_folder(app: AppHandle, path: String) -> Result<(), AppError> {
    let path = Path::new(&path);
    if !path.exists() {
        return Err(AppError::NotFound(format!(
            "文件不存在: {}",
            path.display()
        )));
    }
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .reveal_item_in_dir(path)
        .map_err(|e| AppError::Other(format!("无法在资源管理器中显示: {e}")))?;
    Ok(())
}

#[tauri::command]
pub fn open_path(app: AppHandle, path: String) -> Result<(), AppError> {
    let path = Path::new(&path);
    if !path.exists() {
        return Err(AppError::NotFound(format!(
            "文件不存在: {}",
            path.display()
        )));
    }
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_path(path.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| AppError::Other(format!("无法打开文件: {e}")))?;
    Ok(())
}
