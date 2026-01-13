//! Mythos Tauri application library
//!
//! Features:
//! - Editor WebView bridge
//! - Deep link handling for OAuth
//! - In-App Purchases (Mac App Store)

use tauri::{AppHandle, Emitter};
use tauri_plugin_deep_link::DeepLinkExt;

/// Receives messages from the editor WebView and emits to React frontend
#[tauri::command]
fn editor_message(app: AppHandle, message: String) -> Result<(), String> {
    app.emit("editor-message", &message)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            // Register deep link scheme for OAuth callbacks
            // Note: This only works in bundled builds, not dev mode
            #[cfg(desktop)]
            {
                let handle = app.handle().clone();

                // Deep link registration fails in dev mode (not bundled)
                // This is expected - OAuth callbacks won't work in dev
                match app.deep_link().register("mythos") {
                    Ok(_) => println!("[deep-link] Registered mythos:// scheme"),
                    Err(e) => eprintln!("[deep-link] Failed to register (expected in dev): {}", e),
                }

                // Listen for deep link events (still set up handler for when it works)
                app.deep_link().on_open_url(move |event| {
                    let urls = event.urls();
                    for url in urls {
                        // Emit to frontend for handling
                        let _ = handle.emit("deep-link://new-url", url.to_string());
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![editor_message])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
