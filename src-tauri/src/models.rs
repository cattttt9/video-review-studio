use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDto {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub template_type: String,
    pub source_mode: String,
    pub source_video_path: String,
    pub portable_video_path: Option<String>,
    pub project_dir: String,
    pub sort_mode: String,
    pub sort_direction: String,
    pub created_at: String,
    pub updated_at: String,
    pub last_opened_at: Option<String>,
    pub video_meta: Option<VideoMetaDto>,
    pub video_exists: bool,
    pub resolved_video_path: Option<String>,
    pub record_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoMetaDto {
    pub id: String,
    pub project_id: String,
    pub file_name: String,
    pub file_size: Option<i64>,
    pub duration_ms: Option<i64>,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub frame_rate: Option<f64>,
    pub codec: Option<String>,
    pub container_format: Option<String>,
    pub rotation: i64,
    pub hash_head: Option<String>,
    pub hash_tail: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewRecordDto {
    pub id: String,
    pub project_id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub importance: Option<String>,
    pub time_mode: String,
    pub start_time_ms: i64,
    pub end_time_ms: i64,
    pub representative_time_ms: i64,
    pub has_screenshot: bool,
    pub source_image_path: Option<String>,
    pub thumbnail_path: Option<String>,
    pub thumbnail_version: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnnotationDto {
    pub id: String,
    pub record_id: String,
    #[serde(rename = "type")]
    pub annotation_type: String,
    pub z_index: i64,
    pub style_json: String,
    pub geometry_json: String,
    pub content: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewRecordInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub importance: Option<String>,
    pub time_mode: String,
    pub start_time_ms: i64,
    pub end_time_ms: i64,
    pub representative_time_ms: i64,
    pub has_screenshot: bool,
    pub source_image_path: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnnotationInput {
    pub id: String,
    #[serde(rename = "type")]
    pub annotation_type: String,
    pub z_index: i64,
    pub style_json: String,
    pub geometry_json: String,
    pub content: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentProjectEntry {
    pub dir: String,
    pub name: String,
    pub last_opened_at: Option<String>,
    pub source_mode: String,
    pub video_exists: bool,
    pub record_count: i64,
    pub video_file_name: Option<String>,
    pub project_valid: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoStatus {
    pub exists: bool,
    pub path: Option<String>,
    pub size: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RelocateComparison {
    pub matches: bool,
    pub differences: Vec<String>,
    pub probed: VideoMetaDto,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayableVideo {
    pub path: String,
    pub kind: String,
    pub mime: String,
    pub uses_proxy: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyResult {
    pub path: String,
    pub created: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressPayload {
    pub project_id: String,
    pub done_ms: i64,
    pub total_ms: i64,
    pub percent: f64,
    pub stage: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortableProgressPayload {
    pub project_id: String,
    pub copied_bytes: i64,
    pub total_bytes: i64,
    pub percent: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortableResult {
    pub project_dir: String,
    pub media_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRegistry {
    pub version: i64,
    pub projects: Vec<RegistryItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryItem {
    pub dir: String,
    pub name: String,
    pub last_opened_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub schema_version: i64,
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub source_mode: String,
    pub source_video_path: String,
    pub portable_video_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub last_opened_at: Option<String>,
}
