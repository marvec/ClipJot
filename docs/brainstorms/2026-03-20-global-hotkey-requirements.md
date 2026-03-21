---
date: 2026-03-20
topic: global-hotkey
---

# Global Hotkey Launch

## Problem Frame

The screenshot-annotate-share loop is measured in seconds. The gap between "I copied an image" and "I'm annotating it in ClipJot" is the critical friction point. A system-wide global hotkey eliminates the need to find ClipJot in the dock/taskbar, click it, and wait for it to come to focus. One keypress brings the app to the foreground with the clipboard image ready to view.

## Requirements

- R1. ClipJot registers a system-wide global hotkey that works regardless of which application is focused.
- R2. The default hotkey is **Cmd+Shift+J** on macOS and **Ctrl+Shift+J** on Windows. "J" for Jot.
- R3. The hotkey is configurable in the settings dialog. The user can change it to any key combination.
- R4. When the hotkey is pressed and the clipboard contains an image: bring the ClipJot window to the foreground, switch to the clipboard tab, and display the current clipboard image. The user views the image first, then starts editing (which triggers auto-duplication per the layer architecture).
- R5. When the hotkey is pressed and the clipboard does NOT contain an image: bring the ClipJot window to the foreground, show the clipboard tab with a "No image in clipboard" message. The user can still switch to existing open tabs.
- R6. When the hotkey is pressed and ClipJot's window is already visible and focused: re-read the clipboard and refresh the clipboard tab with the latest clipboard content. This allows the user to quickly update after copying a new image.
- R7. The global hotkey requires ClipJot to be running (in the system tray). If the app is not running, the hotkey has no effect.
- R8. The hotkey activation should feel instant — the window appears within 100ms of the keypress with the clipboard image already displayed (not loading asynchronously).

## Success Criteria

- A user can go from "I just took a screenshot" to "I see it in ClipJot" in under 1 second via a single keypress.
- The hotkey works reliably from any application context on both macOS and Windows.
- The hotkey does not conflict with common system or application shortcuts.
- Changing the hotkey in settings takes effect immediately without restarting the app.

## Scope Boundaries

- **No multiple hotkeys** (e.g., separate hotkey for "open and start editing" vs "open and view"). One hotkey, one behavior.
- **No hotkey for minimizing** — the hotkey only brings the window up / refreshes. Minimizing uses the standard window close or system tray behavior.
- **No hotkey for specific tools** — the hotkey brings up the app; tool selection is separate.

## Key Decisions

- **Show clipboard tab (view first, then edit):** Consistent with the ephemeral-by-default brainstorm (R7). The user sees what's in the clipboard before committing to edit.
- **Refresh on re-press when focused:** Makes the hotkey useful even when the app is already open. The user can copy a new image and press the hotkey to refresh without alt-tabbing away first.
- **Show window even with no image:** The app may have existing tabs the user wants to access. Hiding the window when there's no clipboard image would be frustrating if the user just wanted to return to an in-progress annotation.
- **Cmd+Shift+J default:** Uncommon enough to avoid conflicts. "J" mnemonically maps to "Jot." Configurable for users who need a different binding.

## Dependencies / Assumptions

- Requires the Tauri v2 global shortcut plugin (`tauri-plugin-global-shortcut`). This is not currently wired in the project but is available in the Tauri v2 plugin ecosystem.
- Depends on system tray operation (planned feature from the spec) — the app must be running in the background to receive global hotkey events.
- Assumes the clipboard-manager plugin can read clipboard images fast enough for the 100ms target. If clipboard reading is slow for large images, may need to show the window immediately and load the image asynchronously with a brief loading indicator.

## Outstanding Questions

### Deferred to Planning

- [Affects R1][Needs research] How to register global shortcuts in Tauri v2? Verify `tauri-plugin-global-shortcut` supports the required functionality on both macOS and Windows.
- [Affects R3][Technical] How to dynamically re-register the global shortcut when the user changes the hotkey in settings?
- [Affects R8][Technical] What is the realistic clipboard image read latency for large screenshots (4K+)? May need a loading state if reading takes >100ms.

## Next Steps

-> /ce:plan for structured implementation planning
