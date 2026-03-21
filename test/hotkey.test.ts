import { describe, test, expect } from "bun:test"
import { readFileSync, existsSync } from "fs"
import { resolve } from "path"

describe("Global Hotkey", () => {
  test("useGlobalHotkey composable exists", () => {
    expect(
      existsSync(
        resolve(__dirname, "../src/composables/useGlobalHotkey.ts"),
      ),
    ).toBe(true)
  })

  const hotkey = readFileSync(
    resolve(__dirname, "../src/composables/useGlobalHotkey.ts"),
    "utf-8",
  )

  test("default shortcut is Cmd+Shift+J", () => {
    expect(hotkey).toContain("CommandOrControl+Shift+J")
  })

  test("registers hotkey with event handler", () => {
    expect(hotkey).toContain("register")
    expect(hotkey).toContain('event.state !== "Pressed"')
  })

  test("shows and focuses window on hotkey", () => {
    expect(hotkey).toContain(".show()")
    expect(hotkey).toContain(".setFocus()")
  })

  test("reads clipboard on hotkey activation", () => {
    expect(hotkey).toContain("readClipboardImage")
    expect(hotkey).toContain("updateClipboardImage")
  })

  test("supports changing hotkey with fallback", () => {
    expect(hotkey).toContain("changeHotkey")
    expect(hotkey).toContain("unregisterHotkey")
  })

  test("handles registration failure gracefully", () => {
    expect(hotkey).toContain("catch")
    expect(hotkey).toContain("return false")
  })
})

describe("System Tray (Rust)", () => {
  const libRs = readFileSync(
    resolve(__dirname, "../src-tauri/src/lib.rs"),
    "utf-8",
  )

  test("creates system tray with menu", () => {
    expect(libRs).toContain("TrayIconBuilder")
    expect(libRs).toContain("Show ClipJot")
    expect(libRs).toContain("Quit ClipJot")
  })

  test("handles left click on tray icon", () => {
    expect(libRs).toContain("TrayIconEvent")
    expect(libRs).toContain("MouseButton::Left")
  })

  test("prevents exit to keep tray alive", () => {
    expect(libRs).toContain("prevent_exit")
    expect(libRs).toContain("ExitRequested")
  })

  test("hides window on close instead of quitting", () => {
    expect(libRs).toContain("CloseRequested")
    expect(libRs).toContain("prevent_close")
    expect(libRs).toContain(".hide()")
  })

  test("shows window on tray menu click", () => {
    expect(libRs).toContain("get_webview_window")
    expect(libRs).toContain("set_focus")
  })
})
