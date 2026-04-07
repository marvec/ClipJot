# Show in System Tray — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Show in system tray" setting (default ON) that toggles between tray-mode (dock icon disappears when window is hidden) and traditional-mode (dock icon always visible, no tray icon).

**Architecture:** The setting lives in `useSettings.ts` (localStorage, same singleton pattern as all other settings). A watch on the setting calls a new Tauri command `set_tray_mode(enabled)` which updates Rust-side state, toggles tray icon visibility, and on macOS adjusts the activation policy. The `on_window_event` handler reads the Rust state to decide whether to set `Accessory` policy when the window is hidden.

**Tech Stack:** Vue 3, TypeScript, Tauri v2 (`tauri::ActivationPolicy`, `TrayIcon::set_visible`), Bun test runner.

---

### Task 1: Add `showInTray` setting to `useSettings.ts`

**Files:**
- Modify: `src/composables/useSettings.ts`
- Test: `test/settings.test.ts`

- [ ] **Step 1: Write failing tests**

Add to the `"useSettings composable"` describe block in `test/settings.test.ts`, after the existing `setAutostart` test:

```typescript
test("has showInTray setting with true default", () => {
  expect(settings).toContain('loadFromStorage<boolean>("showInTray", true)')
})

test("persists showInTray to localStorage on change", () => {
  expect(settings).toContain('watch(showInTray, (v) => saveToStorage("showInTray", v))')
})

test("exports setShowInTray setter", () => {
  expect(settings).toContain("function setShowInTray")
})

test("invokes set_tray_mode command when showInTray changes", () => {
  expect(settings).toContain('"set_tray_mode"')
  expect(settings).toContain("showInTray")
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
export AGENT=1 && bun test test/settings.test.ts 2>&1 | tail -20
```

Expected: 4 new FAILs mentioning `showInTray`.

- [ ] **Step 3: Implement `showInTray` in `useSettings.ts`**

Add `invoke` import at the top of `src/composables/useSettings.ts` (after the existing `import { ref, watch } from "vue"`):

```typescript
import { invoke } from "@tauri-apps/api/core"
```

Add the ref after the existing `autostart` ref (line 35):

```typescript
const showInTray = ref<boolean>(loadFromStorage<boolean>("showInTray", true))
```

Add the watcher after the existing `watch(autostart, ...)` line:

```typescript
watch(showInTray, (v) => {
  saveToStorage("showInTray", v)
  invoke("set_tray_mode", { enabled: v }).catch(() => {
    // not in Tauri context
  })
})
```

Add the setter function after `setAutostart`:

```typescript
function setShowInTray(value: boolean): void {
  showInTray.value = value
}
```

Add to the return object of `useSettings()`, after `autostart` and `setAutostart`:

```typescript
showInTray,
setShowInTray,
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
export AGENT=1 && bun test test/settings.test.ts 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useSettings.ts test/settings.test.ts
git commit -m "feat: add showInTray setting to useSettings"
```

---

### Task 2: Add "Show in system tray" toggle to `SettingsDialog.vue`

**Files:**
- Modify: `src/components/SettingsDialog.vue`
- Test: `test/settings.test.ts`

- [ ] **Step 1: Write failing test**

Add to the `"SettingsDialog component"` describe block in `test/settings.test.ts`, after the existing System section test:

```typescript
test("has Show in system tray toggle in System section", () => {
  expect(dialog).toContain("Show in system tray")
  expect(dialog).toContain("showInTray")
  expect(dialog).toContain("setShowInTray")
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
export AGENT=1 && bun test test/settings.test.ts 2>&1 | tail -10
```

Expected: FAIL on `"has Show in system tray toggle in System section"`.

- [ ] **Step 3: Update `SettingsDialog.vue`**

In `src/components/SettingsDialog.vue`, update the destructure in `<script setup>` to include the new setting (after `setAutostart`):

```typescript
const {
  theme,
  autoCopyOnClose,
  tabNamePattern,
  hotkey,
  zoomSensitivity,
  autostart,
  showInTray,
  setTheme,
  setAutoCopyOnClose,
  setTabNamePattern,
  setZoomSensitivity,
  setAutostart,
  setShowInTray,
} = useSettings()
```

In the template, add the toggle inside the System `<section>`, after the "Launch at login" label:

```html
<label class="settings-field settings-field--toggle">
  <span class="settings-field__label">Show in system tray</span>
  <input
    type="checkbox"
    class="settings-field__checkbox"
    :checked="showInTray"
    @change="setShowInTray(!showInTray)"
  />
</label>
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
export AGENT=1 && bun test test/settings.test.ts 2>&1 | tail -10
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsDialog.vue test/settings.test.ts
git commit -m "feat: add Show in system tray toggle to SettingsDialog"
```

---

### Task 3: Add `AppState` and `set_tray_mode` command to Rust

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add imports and `AppState` struct**

At the top of `src-tauri/src/lib.rs`, the existing imports are:

```rust
use std::path::PathBuf;
use tauri::menu::{MenuBuilder, MenuItem, MenuItemBuilder, SubmenuBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, RunEvent, WindowEvent};
```

Replace with:

```rust
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::menu::{MenuBuilder, MenuItem, MenuItemBuilder, SubmenuBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, RunEvent, WindowEvent};
```

Add the `AppState` struct after the existing `DynamicMenuItems` struct (after line 12):

```rust
struct AppState {
    show_in_tray: Arc<Mutex<bool>>,
    tray: Arc<Mutex<Option<TrayIcon<tauri::Wry>>>>,
}
```

- [ ] **Step 2: Add `set_tray_mode` command**

Add after the existing `write_file` command (after line 43):

```rust
#[tauri::command]
fn set_tray_mode(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    enabled: bool,
) -> Result<(), String> {
    *state.show_in_tray.lock().unwrap() = enabled;

    if let Some(tray) = state.tray.lock().unwrap().as_ref() {
        tray.set_visible(enabled).map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    if !enabled {
        // Tray turned off: restore Regular policy so dock icon stays visible.
        let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
    }

    Ok(())
}
```

- [ ] **Step 3: Register `set_tray_mode` in `invoke_handler`**

Change the existing `invoke_handler` line from:

```rust
.invoke_handler(tauri::generate_handler![write_file, set_menu_item_enabled])
```

to:

```rust
.invoke_handler(tauri::generate_handler![write_file, set_menu_item_enabled, set_tray_mode])
```

- [ ] **Step 4: Manage `AppState` and store the tray icon reference**

Inside `setup`, after `app.manage(DynamicMenuItems { ... });` (currently around line 202–208), add:

```rust
app.manage(AppState {
    show_in_tray: Arc::new(Mutex::new(true)),
    tray: Arc::new(Mutex::new(None)),
});
```

Then, after `TrayIconBuilder::new()...build(app)?;`, store the tray in `AppState`. Change the tray build from:

```rust
TrayIconBuilder::new()
    .icon(tray_icon)
    .tooltip("ClipJot")
    .menu(&tray_menu)
    .show_menu_on_left_click(false)
    .on_menu_event(move |app, event| match event.id().as_ref() {
        // ...
    })
    .on_tray_icon_event(|tray, event| {
        // ...
    })
    .build(app)?;
```

to:

```rust
let built_tray = TrayIconBuilder::new()
    .icon(tray_icon)
    .tooltip("ClipJot")
    .menu(&tray_menu)
    .show_menu_on_left_click(false)
    .on_menu_event(move |app, event| match event.id().as_ref() {
        // ... (unchanged)
    })
    .on_tray_icon_event(|tray, event| {
        // ... (unchanged)
    })
    .build(app)?;

*app.state::<AppState>().tray.lock().unwrap() = Some(built_tray);
```

- [ ] **Step 5: Verify it compiles**

```bash
cd src-tauri && cargo check 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add AppState and set_tray_mode Tauri command"
```

---

### Task 4: Update `on_window_event` to set Accessory policy when hiding

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Replace the `on_window_event` handler**

The current handler is:

```rust
.on_window_event(|window, event| {
    // Window close → hide to tray instead of quitting
    if let WindowEvent::CloseRequested { api, .. } = event {
        let _ = window.hide();
        api.prevent_close();
    }
})
```

Replace with:

```rust
.on_window_event(|window, event| {
    if let WindowEvent::CloseRequested { api, .. } = event {
        let _ = window.hide();
        api.prevent_close();

        #[cfg(target_os = "macos")]
        {
            let show_in_tray = window
                .try_state::<AppState>()
                .map(|s| *s.show_in_tray.lock().unwrap())
                .unwrap_or(true);
            if show_in_tray {
                let _ = window
                    .app_handle()
                    .set_activation_policy(tauri::ActivationPolicy::Accessory);
            }
        }
    }
})
```

- [ ] **Step 2: Verify it compiles**

```bash
cd src-tauri && cargo check 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: set Accessory activation policy on window hide when tray mode is on"
```

---

### Task 5: Restore Regular activation policy when showing the window from tray

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Update the tray menu "show" handler**

Current handler inside `on_menu_event`:

```rust
"show" => {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}
```

Replace with:

```rust
"show" => {
    #[cfg(target_os = "macos")]
    {
        let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}
```

- [ ] **Step 2: Update the tray left-click handler**

Current handler inside `on_tray_icon_event`:

```rust
let app = tray.app_handle();
if let Some(window) = app.get_webview_window("main") {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
}
```

Replace with:

```rust
let app = tray.app_handle();
#[cfg(target_os = "macos")]
{
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
}
if let Some(window) = app.get_webview_window("main") {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
}
```

- [ ] **Step 3: Verify it compiles**

```bash
cd src-tauri && cargo check 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: restore Regular activation policy when showing window from tray"
```

---

### Task 6: Sync tray mode on mount in `AppShell.vue`

**Files:**
- Modify: `src/components/AppShell.vue`

- [ ] **Step 1: Import `useSettings` and add startup sync**

`AppShell.vue` already imports `invoke` from `@tauri-apps/api/core`. Add `useSettings` to the imports (after `useCopyStats`):

```typescript
import { useSettings } from "../composables/useSettings";
```

Add destructure near the top of `<script setup>`, after the existing composable calls:

```typescript
const { showInTray } = useSettings();
```

Inside the existing `onMounted(async () => { ... })`, add as the first line:

```typescript
void invoke("set_tray_mode", { enabled: showInTray.value });
```

- [ ] **Step 2: Verify full build**

```bash
bun run tsc 2>&1 | tail -20
```

Expected: no type errors.

- [ ] **Step 3: Run all tests**

```bash
export AGENT=1 && bun test 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppShell.vue
git commit -m "feat: sync showInTray setting to Rust on app mount"
```
