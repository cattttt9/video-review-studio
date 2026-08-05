use crate::error::AppError;
use crate::models::{ProjectInfo, ProjectRegistry, RegistryItem};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

pub const SCHEMA_VERSION: i64 = 1;

pub struct ProjectLayout;

impl ProjectLayout {
    pub fn screenshots(dir: &Path) -> PathBuf {
        dir.join("screenshots")
    }
    pub fn thumbnails(dir: &Path) -> PathBuf {
        dir.join("cache").join("thumbnails")
    }
    pub fn proxy(dir: &Path) -> PathBuf {
        dir.join("cache").join("proxy")
    }
    pub fn temp(dir: &Path) -> PathBuf {
        dir.join("cache").join("temp")
    }
    pub fn media(dir: &Path) -> PathBuf {
        dir.join("media")
    }
    pub fn exports(dir: &Path) -> PathBuf {
        dir.join("exports")
    }
    pub fn backups(dir: &Path) -> PathBuf {
        dir.join("backups")
    }
}

pub fn create_layout(dir: &Path) -> Result<(), AppError> {
    fs::create_dir_all(ProjectLayout::screenshots(dir))?;
    fs::create_dir_all(ProjectLayout::thumbnails(dir))?;
    fs::create_dir_all(ProjectLayout::proxy(dir))?;
    fs::create_dir_all(ProjectLayout::temp(dir))?;
    fs::create_dir_all(ProjectLayout::media(dir))?;
    fs::create_dir_all(ProjectLayout::exports(dir))?;
    fs::create_dir_all(ProjectLayout::backups(dir))?;
    Ok(())
}

pub fn sanitize_dir_name(name: &str) -> String {
    let invalid = regex::Regex::new(r#"[<>:"/\\|?*\x00-\x1F]"#).unwrap();
    let mut out = invalid.replace_all(name.trim(), "_").to_string();
    out = out.trim_end_matches(['.', ' ']).to_string();
    if out.is_empty() {
        out = "untitled-project".to_string();
    }
    out
}

pub fn unique_project_dir(parent: &Path, name: &str) -> PathBuf {
    let base = sanitize_dir_name(name);
    let mut candidate = parent.join(&base);
    let mut n = 2;
    while candidate.exists() {
        candidate = parent.join(format!("{base}-{n}"));
        n += 1;
    }
    candidate
}

pub fn info_path(dir: &Path) -> PathBuf {
    dir.join("project.json")
}

pub fn load_info(dir: &Path) -> Result<ProjectInfo, AppError> {
    let path = info_path(dir);
    if !path.exists() {
        return Err(AppError::Project(format!(
            "项目目录缺少 project.json: {}",
            dir.display()
        )));
    }
    let raw = fs::read_to_string(&path)?;
    let info: ProjectInfo = serde_json::from_str(&raw)?;
    Ok(info)
}

pub fn save_info(dir: &Path, info: &ProjectInfo) -> Result<(), AppError> {
    let path = info_path(dir);
    let raw = serde_json::to_string_pretty(info)?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, raw)?;
    fs::rename(&tmp, &path)?;
    Ok(())
}

pub fn registry_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app.path().app_data_dir()?;
    fs::create_dir_all(&dir)?;
    Ok(dir.join("projects.json"))
}

pub fn read_registry(app: &AppHandle) -> Result<ProjectRegistry, AppError> {
    let path = registry_path(app)?;
    if !path.exists() {
        return Ok(ProjectRegistry {
            version: 1,
            projects: Vec::new(),
        });
    }
    let raw = fs::read_to_string(&path)?;
    Ok(serde_json::from_str(&raw)?)
}

pub fn write_registry(app: &AppHandle, registry: &ProjectRegistry) -> Result<(), AppError> {
    let path = registry_path(app)?;
    let raw = serde_json::to_string_pretty(registry)?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, raw)?;
    fs::rename(&tmp, &path)?;
    Ok(())
}

pub fn upsert_recent(app: &AppHandle, dir: &Path, name: &str) -> Result<(), AppError> {
    let mut registry = read_registry(app)?;
    let dir_str = dir.to_string_lossy().to_string();
    let now = crate::database::now_iso();
    if let Some(item) = registry
        .projects
        .iter_mut()
        .find(|item| item.dir == dir_str)
    {
        item.name = name.to_string();
        item.last_opened_at = Some(now);
    } else {
        registry.projects.push(RegistryItem {
            dir: dir_str,
            name: name.to_string(),
            last_opened_at: Some(now),
        });
    }
    registry.projects.sort_by(|a, b| {
        b.last_opened_at
            .as_deref()
            .cmp(&a.last_opened_at.as_deref())
    });
    registry.projects.truncate(50);
    write_registry(app, &registry)
}

pub fn remove_from_registry(app: &AppHandle, dir: &Path) -> Result<(), AppError> {
    let mut registry = read_registry(app)?;
    let dir_str = dir.to_string_lossy().to_string();
    registry.projects.retain(|item| item.dir != dir_str);
    write_registry(app, &registry)
}

pub fn resolve_video_path(info: &ProjectInfo, project_dir: &Path) -> PathBuf {
    if info.source_mode == "portable" {
        let rel = info
            .portable_video_path
            .as_deref()
            .unwrap_or(&info.source_video_path);
        let p = PathBuf::from(rel);
        if p.is_absolute() {
            p
        } else {
            project_dir.join(p)
        }
    } else {
        PathBuf::from(&info.source_video_path)
    }
}

pub fn trash_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app.path().app_data_dir()?.join("trash");
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

