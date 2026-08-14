use crate::commands::with_project;
use crate::error::AppError;
use crate::services::fs_util::safe_join_under;
use crate::services::project::ProjectLayout;
use crate::state::AppState;
use base64::Engine;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, State};
use url::Url;

#[tauri::command]
pub fn write_project_file(
    state: State<'_, AppState>,
    project_id: String,
    rel_path: String,
    data_base64: String,
    export_dir: Option<String>,
) -> Result<String, AppError> {
    with_project(&state, &project_id, |handle| {
        let root = match export_dir {
            Some(dir) => Path::new(&dir).to_path_buf(),
            None => ProjectLayout::exports(&handle.dir),
        };
        fs::create_dir_all(&root)?;
        let target = safe_join_under(&root, &rel_path)
            .ok_or_else(|| AppError::Invalid("导出路径不合法".into()))?;
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        let data = data_base64.split(',').next_back().unwrap_or(&data_base64);
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
    export_dir: Option<String>,
) -> Result<String, AppError> {
    with_project(&state, &project_id, |handle| {
        let root = match export_dir {
            Some(dir) => Path::new(&dir).to_path_buf(),
            None => ProjectLayout::exports(&handle.dir),
        };
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
pub fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
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

fn find_edge() -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(path) = std::env::var_os("PROGRAMFILES(X86)") {
        candidates.push(PathBuf::from(path).join("Microsoft/Edge/Application/msedge.exe"));
    }
    if let Some(path) = std::env::var_os("PROGRAMFILES") {
        candidates.push(PathBuf::from(path).join("Microsoft/Edge/Application/msedge.exe"));
    }
    if let Some(path) = std::env::var_os("LOCALAPPDATA") {
        candidates.push(PathBuf::from(path).join("Microsoft/Edge/Application/msedge.exe"));
    }
    candidates.into_iter().find(|path| path.is_file())
}

fn cleanup_pdf_profiles(temp_root: &Path) {
    if let Ok(entries) = fs::read_dir(temp_root) {
        for entry in entries.flatten() {
            if entry.file_name().to_string_lossy().starts_with("vrs-pdf-") && entry.path().is_dir()
            {
                let _ = fs::remove_dir_all(entry.path());
            }
        }
    }
}

fn cleanup_pdf_profile_with_retry(profile: &Path) {
    for _ in 0..20 {
        if !profile.exists() || fs::remove_dir_all(profile).is_ok() {
            return;
        }
        thread::sleep(Duration::from_millis(250));
    }
}

#[tauri::command]
pub fn create_pdf_from_html(html_path: String, pdf_path: String) -> Result<String, AppError> {
    let html = fs::canonicalize(&html_path)
        .map_err(|_| AppError::NotFound(format!("HTML 报告不存在: {html_path}")))?;
    if html.extension().and_then(|value| value.to_str()) != Some("html") {
        return Err(AppError::Invalid("PDF 来源必须是 HTML 报告".into()));
    }
    let pdf = PathBuf::from(&pdf_path);
    if pdf.extension().and_then(|value| value.to_str()) != Some("pdf") {
        return Err(AppError::Invalid("PDF 输出路径必须以 .pdf 结尾".into()));
    }
    if let Some(parent) = pdf.parent() {
        fs::create_dir_all(parent)?;
    }
    let html_parent = html
        .parent()
        .ok_or_else(|| AppError::Invalid("HTML 路径无效".into()))?;
    let html_contains_images = fs::read_to_string(&html)
        .map(|content| content.contains("<img"))
        .unwrap_or(false);
    let pdf_parent = fs::canonicalize(
        pdf.parent()
            .ok_or_else(|| AppError::Invalid("PDF 路径无效".into()))?,
    )?;
    if html_parent != pdf_parent {
        return Err(AppError::Invalid(
            "PDF 必须与 HTML 报告保存在同一目录".into(),
        ));
    }

    let edge = find_edge().ok_or_else(|| {
        AppError::NotFound("未找到 Microsoft Edge，已保留 HTML 报告，可在浏览器中打印为 PDF".into())
    })?;
    let temp_root = std::env::temp_dir();
    cleanup_pdf_profiles(&temp_root);
    let profile = temp_root.join(format!("vrs-pdf-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&profile)?;
    let html_url = Url::from_file_path(&html)
        .map_err(|_| AppError::Invalid("无法将 HTML 报告路径转换为文件 URL".into()))?
        .to_string();
    let status = Command::new(edge)
        .arg("--headless=new")
        .arg("--disable-gpu")
        .arg("--disable-background-networking")
        .arg("--disable-component-update")
        .arg("--disable-extensions")
        .arg("--disable-sync")
        .arg("--allow-file-access-from-files")
        .arg("--run-all-compositor-stages-before-draw")
        .arg("--virtual-time-budget=10000")
        .arg("--no-first-run")
        .arg("--no-default-browser-check")
        .arg("--no-pdf-header-footer")
        .arg(format!("--user-data-dir={}", profile.to_string_lossy()))
        .arg(format!("--print-to-pdf={}", pdf.to_string_lossy()))
        .arg(&html_url)
        .status();
    let status =
        status.map_err(|error| AppError::Other(format!("无法启动 Edge 生成 PDF: {error}")))?;
    if !status.success() {
        return Err(AppError::Other(
            "Edge 未能生成 PDF，已保留 HTML 报告".into(),
        ));
    }
    // Windows 上 Edge 的启动进程可能先退出，PDF 由后继进程稍后落盘。
    let deadline = Instant::now() + Duration::from_secs(15);
    let minimum_size = if html_contains_images {
        50 * 1024
    } else {
        4 * 1024
    };
    while Instant::now() < deadline {
        if pdf
            .metadata()
            .map(|meta| meta.len() >= minimum_size)
            .unwrap_or(false)
        {
            break;
        }
        thread::sleep(Duration::from_millis(100));
    }
    let valid_header = fs::read(&pdf)
        .map(|bytes| bytes.starts_with(b"%PDF-"))
        .unwrap_or(false);
    let valid_size = pdf
        .metadata()
        .map(|meta| meta.len() >= minimum_size)
        .unwrap_or(false);
    if !valid_header || !valid_size {
        cleanup_pdf_profile_with_retry(&profile);
        return Err(AppError::Other(
            "Edge 生成了无效或不完整的 PDF，已保留 HTML 报告".into(),
        ));
    }
    cleanup_pdf_profile_with_retry(&profile);
    Ok(pdf.to_string_lossy().to_string())
}
