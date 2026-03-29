use std::path::PathBuf;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, RunEvent, WindowEvent};

#[tauri::command]
async fn write_file(path: String, data: Vec<u8>) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    // Ensure parent directory exists
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    std::fs::write(&file_path, &data)
        .map_err(|e| format!("Failed to write file: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![write_file])
        .setup(|app| {
            #[cfg(desktop)]
            {
                // ── Application menu bar ──

                // File menu
                let save_item = MenuItemBuilder::with_id("save", "Save")
                    .accelerator("CmdOrCtrl+S")
                    .build(app)?;
                let close_tab_item = MenuItemBuilder::with_id("close-tab", "Close Tab")
                    .accelerator("CmdOrCtrl+W")
                    .build(app)?;
                let settings_item = MenuItemBuilder::with_id("settings", "Settings…")
                    .accelerator("CmdOrCtrl+,")
                    .build(app)?;
                let quit_item = MenuItemBuilder::with_id("quit", "Quit")
                    .accelerator("CmdOrCtrl+Q")
                    .build(app)?;
                let file_menu = SubmenuBuilder::new(app, "File")
                    .item(&save_item)
                    .item(&close_tab_item)
                    .separator()
                    .item(&settings_item)
                    .separator()
                    .item(&quit_item)
                    .build()?;

                // Edit menu
                let undo_item = MenuItemBuilder::with_id("undo", "Undo")
                    .accelerator("CmdOrCtrl+Z")
                    .build(app)?;
                let redo_item = MenuItemBuilder::with_id("redo", "Redo")
                    .accelerator("CmdOrCtrl+Shift+Z")
                    .build(app)?;
                let copy_item = MenuItemBuilder::with_id("copy", "Copy")
                    .accelerator("CmdOrCtrl+C")
                    .build(app)?;
                let delete_item = MenuItemBuilder::with_id("delete", "Delete")
                    .build(app)?;
                let edit_menu = SubmenuBuilder::new(app, "Edit")
                    .item(&undo_item)
                    .item(&redo_item)
                    .separator()
                    .item(&copy_item)
                    .item(&delete_item)
                    .build()?;

                // View menu
                let zoom_in_item = MenuItemBuilder::with_id("zoom-in", "Zoom In")
                    .accelerator("CmdOrCtrl+=")
                    .build(app)?;
                let zoom_out_item = MenuItemBuilder::with_id("zoom-out", "Zoom Out")
                    .accelerator("CmdOrCtrl+-")
                    .build(app)?;
                let fit_to_window_item =
                    MenuItemBuilder::with_id("fit-to-window", "Fit to Window")
                        .accelerator("CmdOrCtrl+0")
                        .build(app)?;
                let toggle_theme_item =
                    MenuItemBuilder::with_id("toggle-theme", "Toggle Theme")
                        .build(app)?;
                let view_menu = SubmenuBuilder::new(app, "View")
                    .item(&zoom_in_item)
                    .item(&zoom_out_item)
                    .item(&fit_to_window_item)
                    .separator()
                    .item(&toggle_theme_item)
                    .build()?;

                // Tools menu
                let tool_select = MenuItemBuilder::with_id("select", "Select").build(app)?;
                let tool_pen = MenuItemBuilder::with_id("pen", "Pen").build(app)?;
                let tool_pencil = MenuItemBuilder::with_id("pencil", "Pencil").build(app)?;
                let tool_marker = MenuItemBuilder::with_id("marker", "Marker").build(app)?;
                let tool_eraser = MenuItemBuilder::with_id("eraser", "Eraser").build(app)?;
                let tool_arrow = MenuItemBuilder::with_id("arrow", "Arrow").build(app)?;
                let tool_line = MenuItemBuilder::with_id("line", "Line").build(app)?;
                let tool_rect = MenuItemBuilder::with_id("rect", "Rectangle").build(app)?;
                let tool_ellipse = MenuItemBuilder::with_id("ellipse", "Ellipse").build(app)?;
                let tool_callout = MenuItemBuilder::with_id("callout", "Callout").build(app)?;
                let tool_text = MenuItemBuilder::with_id("text", "Text").build(app)?;
                let tool_redact = MenuItemBuilder::with_id("redact", "Redaction").build(app)?;
                let tool_crop = MenuItemBuilder::with_id("crop", "Crop").build(app)?;
                let tools_menu = SubmenuBuilder::new(app, "Tools")
                    .item(&tool_select)
                    .separator()
                    .item(&tool_pen)
                    .item(&tool_pencil)
                    .item(&tool_marker)
                    .item(&tool_eraser)
                    .separator()
                    .item(&tool_arrow)
                    .item(&tool_line)
                    .item(&tool_rect)
                    .item(&tool_ellipse)
                    .separator()
                    .item(&tool_callout)
                    .item(&tool_text)
                    .item(&tool_redact)
                    .item(&tool_crop)
                    .build()?;

                let menu = MenuBuilder::new(app)
                    .items(&[&file_menu, &edit_menu, &view_menu, &tools_menu])
                    .build()?;
                app.set_menu(menu)?;

                // Forward menu events to the frontend
                app.on_menu_event(move |app_handle, event| {
                    let id = event.id().0.clone();
                    // Quit is handled natively
                    if id == "quit" {
                        app_handle.exit(0);
                        return;
                    }
                    // Emit to frontend for all other events
                    let _ = app_handle.emit(
                        "menu-event",
                        serde_json::json!({ "id": id }),
                    );
                });

                // ── System tray ──
                let show = MenuItemBuilder::with_id("show", "Show ClipJot").build(app)?;
                let tray_quit =
                    MenuItemBuilder::with_id("tray-quit", "Quit ClipJot").build(app)?;
                let tray_menu = MenuBuilder::new(app)
                    .items(&[&show, &tray_quit])
                    .build()?;

                TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .tooltip("ClipJot")
                    .menu(&tray_menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(move |app, event| match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                        "tray-quit" => {
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
