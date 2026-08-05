use crate::error::AppError;
use crate::models::VideoMetaDto;
use serde::Deserialize;
use std::collections::HashMap;
use std::path::Path;
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

use super::hash::head_tail_sha256;
use super::fs_util::file_size;
use crate::database::now_iso;
use crate::models::ProgressPayload;

#[derive(Debug, Deserialize)]
struct FfprobeOutput {
    streams: Vec<FfprobeStream>,
    format: FfprobeFormat,
}

#[derive(Debug, Deserialize, Default)]
struct FfprobeStream {
    codec_type: Option<String>,
    codec_name: Option<String>,
    width: Option<i64>,
    height: Option<i64>,
    avg_frame_rate: Option<String>,
    r_frame_rate: Option<String>,
    #[serde(default)]
    tags: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Deserialize, Default)]
struct FfprobeFormat {
    duration: Option<String>,
    format_name: Option<String>,
}

fn parse_frame_rate(raw: Option<&str>) -> Option<f64> {
    let raw = raw?;
    if let Some((num, den)) = raw.split_once('/') {
        let n: f64 = num.trim().parse().ok()?;
        let d: f64 = den.trim().parse().ok()?;
        if d > 0.0 {
            return Some(n / d);
        }
    }
    raw.parse().ok()
}

fn parse_ms(raw: Option<&str>) -> Option<i64> {
    let raw = raw?;
    let secs: f64 = raw.parse().ok()?;
    Some((secs * 1000.0).round() as i64)
}

pub async fn probe(app: &AppHandle, path: &str) -> Result<VideoMetaDto, AppError> {
    let output = app
        .shell()
        .sidecar("ffprobe")?
        .args([
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            path,
        ])
        .output()
        .await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Video(format!("ffprobe 读取视频失败: {stderr}")));
    }

    let parsed: FfprobeOutput = serde_json::from_slice(&output.stdout)
        .map_err(|e| AppError::Video(format!("ffprobe 输出解析失败: {e}")))?;

    let video = parsed
        .streams
        .iter()
        .find(|s| s.codec_type.as_deref() == Some("video"));

    let rotation = video
        .and_then(|s| s.tags.get("rotate"))
        .and_then(|v| v.as_str())
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(0);

    let (hash_head, hash_tail) = head_tail_sha256(Path::new(path)).unwrap_or_default();
    let file_name = Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string());

    let duration_ms = parse_ms(parsed.format.duration.as_deref());
    let width = video.and_then(|s| s.width);
    let height = video.and_then(|s| s.height);
    let frame_rate = video
        .map(|s| {
            parse_frame_rate(s.avg_frame_rate.as_deref())
                .or_else(|| parse_frame_rate(s.r_frame_rate.as_deref()))
        })
        .flatten();
    let codec = video.and_then(|s| s.codec_name.clone());

    Ok(VideoMetaDto {
        id: String::new(),
        project_id: String::new(),
        file_name,
        file_size: file_size(Path::new(path)),
        duration_ms,
        width,
        height,
        frame_rate,
        codec,
        container_format: parsed.format.format_name.clone(),
        rotation,
        hash_head: Some(hash_head),
        hash_tail: Some(hash_tail),
        created_at: now_iso(),
        updated_at: now_iso(),
    })
}

pub async fn capture_frame(
    app: &AppHandle,
    video_path: &str,
    time_ms: i64,
    out_path: &Path,
) -> Result<(), AppError> {
    let secs = format!("{:.3}", time_ms as f64 / 1000.0);
    let out_str = out_path.to_string_lossy().to_string();
    let output = app
        .shell()
        .sidecar("ffmpeg")?
        .args([
            "-hide_banner",
            "-y",
            "-ss",
            &secs,
            "-i",
            video_path,
            "-frames:v",
            "1",
            "-an",
            "-c:v",
            "png",
            &out_str,
        ])
        .output()
        .await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Video(format!("截图失败: {stderr}")));
    }
    if !out_path.exists() || file_size(out_path).unwrap_or(0) == 0 {
        return Err(AppError::Video(
            "截图失败：FFmpeg 未生成有效图片".to_string(),
        ));
    }
    Ok(())
}

pub async fn ensure_proxy(
    app: &AppHandle,
    project_id: &str,
    source: &Path,
    out: &Path,
    total_ms: i64,
    cancel_flag: std::sync::Arc<std::sync::atomic::AtomicBool>,
    child_holder: std::sync::Arc<
        std::sync::Mutex<Option<tauri_plugin_shell::process::CommandChild>>,
    >,
) -> Result<bool, AppError> {
    if out.exists() && file_size(out).unwrap_or(0) > 0 {
        return Ok(false);
    }
    if let Some(parent) = out.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let src = source.to_string_lossy().to_string();
    let dst = out.to_string_lossy().to_string();
    let cmd = app.shell().sidecar("ffmpeg")?;
    let (mut rx, child) = cmd.args([
        "-hide_banner",
        "-y",
        "-i",
        &src,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-vf",
        "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        "-progress",
        "pipe:1",
        "-nostats",
        &dst,
    ])
    .spawn()?;
    if let Ok(mut holder) = child_holder.lock() {
        *holder = Some(child);
    }

    let mut done_ms = 0i64;
    let mut finished = false;
    while let Some(event) = rx.recv().await {
        if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
            if let Ok(mut holder) = child_holder.lock() {
                if let Some(child) = holder.take() {
                    let _ = child.kill();
                }
            }
            let _ = std::fs::remove_file(out);
            return Err(AppError::Cancelled);
        }
        match event {
            CommandEvent::Stdout(line) => {
                let text = String::from_utf8_lossy(&line);
                let text = text.trim();
                if let Some(rest) = text.strip_prefix("out_time_us=") {
                    if let Ok(us) = rest.trim().parse::<i64>() {
                        done_ms = us / 1000;
                    }
                } else if text == "progress=end" {
                    finished = true;
                }
                let percent = if total_ms > 0 {
                    (done_ms as f64 / total_ms as f64 * 100.0).min(99.9)
                } else {
                    0.0
                };
                let _ = app.emit(
                    "proxy-progress",
                    ProgressPayload {
                        project_id: project_id.to_string(),
                        done_ms,
                        total_ms,
                        percent,
                        stage: "proxy".to_string(),
                    },
                );
            }
            CommandEvent::Stderr(line) => {
                let text = String::from_utf8_lossy(&line);
                let _ = app.emit(
                    "proxy-progress",
                    ProgressPayload {
                        project_id: project_id.to_string(),
                        done_ms,
                        total_ms,
                        percent: if total_ms > 0 {
                            (done_ms as f64 / total_ms as f64 * 100.0).min(99.9)
                        } else {
                            0.0
                        },
                        stage: "proxy".to_string(),
                    },
                );
                if !text.is_empty() {
                    eprintln!("[ffmpeg] {}", text.trim_end());
                }
            }
            CommandEvent::Terminated(_) => {
                break;
            }
            _ => {}
        }
    }

    if let Ok(mut holder) = child_holder.lock() {
        *holder = None;
    }

    if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
        let _ = std::fs::remove_file(out);
        return Err(AppError::Cancelled);
    }
    if !out.exists() || file_size(out).unwrap_or(0) == 0 {
        return Err(AppError::Video(format!(
            "代理视频生成失败（{}）",
            if finished { "输出为空" } else { "进程提前退出" }
        )));
    }
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::parse_frame_rate;

    #[test]
    fn parses_frame_rates() {
        assert_eq!(parse_frame_rate(Some("30000/1001")), Some(29.97002997002997));
        assert_eq!(parse_frame_rate(Some("60/1")), Some(60.0));
        assert_eq!(parse_frame_rate(Some("25")), Some(25.0));
        assert_eq!(parse_frame_rate(Some("0/0")), None);
        assert_eq!(parse_frame_rate(None), None);
    }
}
