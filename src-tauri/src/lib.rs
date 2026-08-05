mod commands;
mod database;
mod error;
mod models;
mod services;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::project::create_project,
            commands::project::open_project,
            commands::project::list_recent_projects,
            commands::project::delete_project,
            commands::project::rename_project,
            commands::project::update_project_settings,
            commands::project::close_project,
            commands::video::bind_video,
            commands::video::check_video,
            commands::video::compare_video,
            commands::video::force_bind_video,
            commands::video::ensure_proxy,
            commands::video::cancel_operation,
            commands::video::capture_screenshot,
            commands::video::resolve_playable_video,
            commands::video::probe_external_file,
            commands::records::create_record,
            commands::records::update_record,
            commands::records::delete_record,
            commands::records::copy_record,
            commands::records::list_records,
            commands::records::get_annotations,
            commands::records::replace_annotations,
            commands::records::save_thumbnail,
            commands::records::refresh_project_dto,
            commands::files::write_project_file,
            commands::files::write_project_text,
            commands::files::reveal_in_folder,
            commands::files::open_path,
            commands::portable::convert_to_portable,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
