use std::path::PathBuf;
use std::sync::Mutex;
use tauri::menu::{MenuBuilder, MenuItem, MenuItemBuilder, SubmenuBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, RunEvent, WindowEvent};

struct DynamicMenuItems {
    undo: MenuItem<tauri::Wry>,
    redo: MenuItem<tauri::Wry>,
    delete: MenuItem<tauri::Wry>,
    close_tab: MenuItem<tauri::Wry>,
    fit_to_window: MenuItem<tauri::Wry>,
}

struct AppState {
    show_in_tray: Mutex<bool>,
    tray: Mutex<Option<TrayIcon<tauri::Wry>>>,
}

#[tauri::command]
fn set_menu_item_enabled(
    state: tauri::State<'_, DynamicMenuItems>,
    id: String,
    enabled: bool,
) -> Result<(), String> {
    let result = match id.as_str() {
        "undo" => state.undo.set_enabled(enabled),
        "redo" => state.redo.set_enabled(enabled),
        "delete" => state.delete.set_enabled(enabled),
        "close-tab" => state.close_tab.set_enabled(enabled),
        "fit-to-window" => state.fit_to_window.set_enabled(enabled),
        _ => return Ok(()),
    };
    result.map_err(|e| e.to_string())
}

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

#[tauri::command]
fn set_tray_mode(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    enabled: bool,
) -> Result<(), String> {
    *state.show_in_tray.lock().map_err(|e| e.to_string())? = enabled;

    let tray_guard = state.tray.lock().map_err(|e| e.to_string())?;
    if let Some(tray) = tray_guard.as_ref() {
        tray.set_visible(enabled).map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    if !enabled {
        // Tray turned off: restore Regular policy so dock icon stays visible.
        let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // Single-instance enforcement: if a second instance is launched, focus the
    // existing window instead of creating a new one (Windows/Linux only; macOS
    // handles this natively).
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(
        |app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        },
    ));

    let app = builder
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![write_file, set_menu_item_enabled, set_tray_mode])
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
                    .enabled(false)
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
                    .enabled(false)
                    .build(app)?;
                let redo_item = MenuItemBuilder::with_id("redo", "Redo")
                    .accelerator("CmdOrCtrl+Shift+Z")
                    .enabled(false)
                    .build(app)?;
                let copy_item = MenuItemBuilder::with_id("copy", "Copy")
                    .accelerator("CmdOrCtrl+C")
                    .build(app)?;
                let delete_item = MenuItemBuilder::with_id("delete", "Delete")
                    .accelerator("Delete")
                    .enabled(false)
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
                let view_menu = SubmenuBuilder::new(app, "View")
                    .item(&zoom_in_item)
                    .item(&zoom_out_item)
                    .item(&fit_to_window_item)
                    .build()?;

                // Tools menu
                let tool_select = MenuItemBuilder::with_id("select", "Select")
                    .accelerator("S")
                    .build(app)?;
                let tool_pen = MenuItemBuilder::with_id("pen", "Pen")
                    .accelerator("P")
                    .build(app)?;
                let tool_pencil = MenuItemBuilder::with_id("pencil", "Pencil")
                    .accelerator("I")
                    .build(app)?;
                let tool_marker = MenuItemBuilder::with_id("marker", "Marker")
                    .accelerator("M")
                    .build(app)?;
                let tool_eraser = MenuItemBuilder::with_id("eraser", "Eraser")
                    .accelerator("E")
                    .build(app)?;
                let tool_arrow = MenuItemBuilder::with_id("arrow", "Arrow")
                    .accelerator("A")
                    .build(app)?;
                let tool_line = MenuItemBuilder::with_id("line", "Line")
                    .accelerator("L")
                    .build(app)?;
                let tool_rect = MenuItemBuilder::with_id("rect", "Rectangle")
                    .accelerator("R")
                    .build(app)?;
                let tool_ellipse = MenuItemBuilder::with_id("ellipse", "Circle")
                    .accelerator("C")
                    .build(app)?;
                let tool_callout = MenuItemBuilder::with_id("callout", "Callout")
                    .accelerator("O")
                    .build(app)?;
                let tool_text = MenuItemBuilder::with_id("text", "Text")
                    .accelerator("T")
                    .build(app)?;
                let tool_redact = MenuItemBuilder::with_id("redact", "Redact")
                    .accelerator("D")
                    .build(app)?;
                let tool_crop = MenuItemBuilder::with_id("crop", "Crop")
                    .accelerator("X")
                    .build(app)?;
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
                app.manage(DynamicMenuItems {
                    undo: undo_item,
                    redo: redo_item,
                    delete: delete_item,
                    close_tab: close_tab_item,
                    fit_to_window: fit_to_window_item,
                });
                app.manage(AppState {
                    show_in_tray: Mutex::new(true),
                    tray: Mutex::new(None),
                });

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

                let is_dark = {
                    #[cfg(target_os = "macos")]
                    {
                        std::process::Command::new("defaults")
                            .args(["read", "-g", "AppleInterfaceStyle"])
                            .output()
                            .map(|o| String::from_utf8_lossy(&o.stdout).trim() == "Dark")
                            .unwrap_or(false)
                    }
                    #[cfg(target_os = "windows")]
                    {
                        use winreg::enums::HKEY_CURRENT_USER;
                        use winreg::RegKey;
                        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
                        hkcu.open_subkey(
                            "Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
                        )
                        .and_then(|key| key.get_value::<u32, _>("AppsUseLightTheme"))
                        .map(|v: u32| v == 0)
                        .unwrap_or(false)
                    }
                    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
                    {
                        false
                    }
                };
                let tray_icon = if is_dark {
                    tauri::include_image!("icons/tray-icon-light@2x.png")
                } else {
                    tauri::include_image!("icons/tray-icon@2x.png")
                };

                let built_tray = TrayIconBuilder::new()
                    .icon(tray_icon)
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

                *app.state::<AppState>().tray.lock().map_err(|e| e.to_string())? = Some(built_tray);
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
