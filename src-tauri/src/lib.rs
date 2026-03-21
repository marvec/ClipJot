mod trim;

use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, RunEvent, WindowEvent};
use trim::TrimBounds;

#[tauri::command]
async fn detect_trim(
    image_bytes: Vec<u8>,
    width: u32,
    height: u32,
    threshold: u8,
) -> Result<TrimBounds, String> {
    // Validate dimensions
    if width == 0 || height == 0 {
        return Err("Image dimensions must be non-zero".to_string());
    }

    if width > 32768 || height > 32768 {
        return Err("Image dimensions exceed maximum (32768×32768)".to_string());
    }

    // Validate buffer size
    let expected = (width as usize) * (height as usize) * 4;
    if image_bytes.len() != expected {
        return Err(format!(
            "Buffer size mismatch: expected {} bytes ({}×{}×4), got {}",
            expected,
            width,
            height,
            image_bytes.len()
        ));
    }

    // Run CPU-bound work on blocking thread
    tauri::async_runtime::spawn_blocking(move || {
        trim::detect_trim_bounds(&image_bytes, width, height, threshold)
    })
    .await
    .map_err(|e| format!("Trim detection failed: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![detect_trim])
        .setup(|app| {
            #[cfg(desktop)]
            {
                // System tray
                let show = MenuItemBuilder::with_id("show", "Show ClipJot").build(app)?;
                let quit = MenuItemBuilder::with_id("quit", "Quit ClipJot").build(app)?;
                let menu = MenuBuilder::new(app).items(&[&show, &quit]).build()?;

                TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .tooltip("ClipJot")
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(move |app, event| match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // Window close → hide to tray instead of quitting
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // Keep event loop alive for system tray
    app.run(|_app_handle, event| {
        if let RunEvent::ExitRequested { code, api, .. } = &event {
            // Only prevent exit when no explicit exit code (e.g., all windows closed).
            // Allow exit(0) from tray quit menu to go through.
            if code.is_none() {
                api.prevent_exit();
            }
        }
    });
}
