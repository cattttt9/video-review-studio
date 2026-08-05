use crate::models::ProjectInfo;
use rusqlite::Connection;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

pub struct AppState {
    pub projects: Mutex<HashMap<String, Arc<Mutex<ProjectHandle>>>>,
    pub cancels: Mutex<HashMap<String, CancelHandle>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            projects: Mutex::new(HashMap::new()),
            cancels: Mutex::new(HashMap::new()),
        }
    }
}

pub struct ProjectHandle {
    pub conn: Mutex<Connection>,
    pub dir: PathBuf,
    pub info: ProjectInfo,
}

#[derive(Clone)]
pub struct CancelHandle {
    pub flag: Arc<AtomicBool>,
    pub child: Arc<Mutex<Option<tauri_plugin_shell::process::CommandChild>>>,
}

impl CancelHandle {
    pub fn new() -> Self {
        Self {
            flag: Arc::new(AtomicBool::new(false)),
            child: Arc::new(Mutex::new(None)),
        }
    }
}
