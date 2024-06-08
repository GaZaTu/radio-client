mod tauri_plugin_pwhash;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_app::init())
    // .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_cors_fetch::init())
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_pwhash::init())
    .plugin(tauri_plugin_websocket::init())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
