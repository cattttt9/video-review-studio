use serde::ser::SerializeMap;
use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("数据库错误: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("文件读写错误: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON 解析错误: {0}")]
    Json(#[from] serde_json::Error),
    #[error("FFmpeg 错误: {0}")]
    Ffmpeg(String),
    #[error("项目错误: {0}")]
    Project(String),
    #[error("视频错误: {0}")]
    Video(String),
    #[error("未找到: {0}")]
    NotFound(String),
    #[error("参数错误: {0}")]
    Invalid(String),
    #[error("操作已取消")]
    Cancelled,
    #[error("{0}")]
    Other(String),
}

impl AppError {
    pub fn category(&self) -> &'static str {
        match self {
            AppError::Db(_) => "database",
            AppError::Io(_) => "filesystem",
            AppError::Json(_) => "parse",
            AppError::Ffmpeg(_) => "ffmpeg",
            AppError::Project(_) => "project",
            AppError::Video(_) => "video",
            AppError::NotFound(_) => "not_found",
            AppError::Invalid(_) => "invalid",
            AppError::Cancelled => "cancelled",
            AppError::Other(_) => "unknown",
        }
    }

    pub fn recoverable(&self) -> bool {
        !matches!(self, AppError::Db(_))
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut map = serializer.serialize_map(Some(3))?;
        map.serialize_entry("category", self.category())?;
        map.serialize_entry("message", &self.to_string())?;
        map.serialize_entry("recoverable", &self.recoverable())?;
        map.end()
    }
}

impl From<tauri_plugin_shell::Error> for AppError {
    fn from(err: tauri_plugin_shell::Error) -> Self {
        AppError::Ffmpeg(format!("启动 FFmpeg 失败: {err}"))
    }
}

impl From<tauri::Error> for AppError {
    fn from(err: tauri::Error) -> Self {
        AppError::Project(format!("Tauri 运行时错误: {err}"))
    }
}
