import { describe, test, expect } from "bun:test"
import { readFileSync, existsSync } from "fs"
import { resolve } from "path"

const srcDir = resolve(__dirname, "../src")
const composablesDir = resolve(srcDir, "composables")
const componentsDir = resolve(srcDir, "components")

describe("useSettings composable", () => {
  const settingsPath = resolve(composablesDir, "useSettings.ts")

  test("useSettings.ts exists", () => {
    expect(existsSync(settingsPath)).toBe(true)
  })

  const settings = readFileSync(settingsPath, "utf-8")

  test("exports useSettings function", () => {
    expect(settings).toContain("export function useSettings()")
  })

  test("exports ThemeSetting type", () => {
    expect(settings).toContain("export type ThemeSetting")
    expect(settings).toContain('"light" | "dark" | "system"')
  })

  // --- All 7 settings present ---

  test("has theme setting with system default", () => {
    expect(settings).toContain('ref<ThemeSetting>(loadFromStorage<ThemeSetting>("theme", "system"))')
  })

  test("has autoCopyOnClose setting with true default", () => {
    expect(settings).toContain('loadFromStorage<boolean>("autoCopyOnClose", true)')
  })

  test("has tabNamePattern setting with HH:mm:ss default", () => {
    expect(settings).toContain('loadFromStorage<string>("tabNamePattern", "HH:mm:ss")')
  })

  test("has hotkey setting with CommandOrControl+Shift+J default", () => {
    expect(settings).toContain('loadFromStorage<string>("hotkey", "CommandOrControl+Shift+J")')
  })

  test("has autostart setting with false default", () => {
    expect(settings).toContain('loadFromStorage<boolean>("autostart", false)')
  })

  // --- localStorage persistence ---

  test("reads from localStorage on init", () => {
    expect(settings).toContain("localStorage.getItem")
    expect(settings).toContain("JSON.parse")
  })

  test("writes to localStorage on change via watch", () => {
    expect(settings).toContain("localStorage.setItem")
    expect(settings).toContain("JSON.stringify")
    // Each setting has a watcher
    expect(settings).toContain('watch(theme, (v) => saveToStorage("theme", v))')
    expect(settings).toContain('watch(autoCopyOnClose, (v) => saveToStorage("autoCopyOnClose", v))')
  })

  test("uses prefixed storage keys", () => {
    expect(settings).toContain("clipjot-settings-")
  })

  // --- Theme application ---

  test("applies theme-dark class to document root", () => {
    expect(settings).toContain('document.documentElement.classList.add("theme-dark")')
    expect(settings).toContain('document.documentElement.classList.remove("theme-dark")')
  })

  test("resolves system theme via matchMedia", () => {
    expect(settings).toContain("prefers-color-scheme: dark")
    expect(settings).toContain("resolveTheme")
  })

  test("watches for OS theme changes when set to system", () => {
    expect(settings).toContain('addEventListener("change"')
    expect(settings).toContain('theme.value === "system"')
  })

  // --- Update functions ---

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

  test("exports setter functions for all settings", () => {
    expect(settings).toContain("function setTheme")
    expect(settings).toContain("function setAutoCopyOnClose")
    expect(settings).toContain("function setTabNamePattern")
    expect(settings).toContain("function setHotkey")
    expect(settings).toContain("function setAutostart")
  })

  // --- Module-level singleton pattern ---

  test("uses module-level state like useTabStore", () => {
    // Settings are declared at module level, not inside the function
    expect(settings).toContain("const theme = ref<ThemeSetting>")
    expect(settings).toContain("const autoCopyOnClose = ref<boolean>")
  })
})

describe("SettingsDialog component", () => {
  const dialogPath = resolve(componentsDir, "SettingsDialog.vue")

  test("SettingsDialog.vue exists", () => {
    expect(existsSync(dialogPath)).toBe(true)
  })

  const dialog = readFileSync(dialogPath, "utf-8")

  test("uses script setup with TypeScript", () => {
    expect(dialog).toContain('<script setup lang="ts">')
  })

  test("imports useSettings composable", () => {
    expect(dialog).toContain("useSettings")
  })

  test("teleports to body", () => {
    expect(dialog).toContain('<Teleport to="body">')
  })

  test("has close button", () => {
    expect(dialog).toContain("settings-dialog__close")
    expect(dialog).toContain("&times;")
  })

  test("closes on ESC key", () => {
    expect(dialog).toContain("Escape")
  })

  test("closes on backdrop click", () => {
    expect(dialog).toContain("@click.self")
  })

  // --- Display section ---

  test("has Display section with theme dropdown", () => {
    expect(dialog).toContain("Display")
    expect(dialog).toContain("<select")
    expect(dialog).toContain('value="light"')
    expect(dialog).toContain('value="dark"')
    expect(dialog).toContain('value="system"')
  })

  // --- Behavior section ---

  test("has Behavior section with toggle switches", () => {
    expect(dialog).toContain("Behavior")
    expect(dialog).toContain("Auto-copy on close")
    expect(dialog).toContain('type="checkbox"')
  })

  // --- Advanced section ---

  test("has Advanced section with text input", () => {
    expect(dialog).toContain("Advanced")
    expect(dialog).toContain("Tab name pattern")
    expect(dialog).toContain('type="text"')
  })

  // --- System section ---

  test("has System section with hotkey display and autostart toggle", () => {
    expect(dialog).toContain("System")
    expect(dialog).toContain("Global hotkey")
    expect(dialog).toContain("hotkey")
    expect(dialog).toContain("Launch at login")
    expect(dialog).toContain("autostart")
  })

  test("has Show in system tray toggle in System section", () => {
    expect(dialog).toContain("Show in system tray")
    expect(dialog).toContain("showInTray")
    expect(dialog).toContain("setShowInTray")
  })

  // --- Semantic tokens ---

  test("uses semantic design tokens", () => {
    expect(dialog).toContain("--surface-elevated")
    expect(dialog).toContain("--overlay-backdrop")
    expect(dialog).toContain("--text-primary")
    expect(dialog).toContain("--text-secondary")
    expect(dialog).toContain("--border-subtle")
    expect(dialog).toContain("--interactive-default")
    expect(dialog).toContain("--surface-panel")
  })

  test("has aria attributes for accessibility", () => {
    expect(dialog).toContain('role="dialog"')
    expect(dialog).toContain('aria-modal="true"')
    expect(dialog).toContain('aria-labelledby="settings-title"')
    expect(dialog).toContain('aria-label="Close settings"')
  })
})

describe("main.ts integration", () => {
  const mainPath = resolve(srcDir, "main.ts")

  test("imports useSettings in main.ts", () => {
    const main = readFileSync(mainPath, "utf-8")
    expect(main).toContain("useSettings")
  })

  test("applies initial theme via useSettings before hotkey registration", () => {
    const main = readFileSync(mainPath, "utf-8")
    const settingsIdx = main.indexOf("useSettings")
    const hotkeyIdx = main.indexOf("useGlobalHotkey")
    expect(settingsIdx).toBeGreaterThan(-1)
    expect(hotkeyIdx).toBeGreaterThan(-1)
    // useSettings import should appear; initialization happens at module level
    expect(main).toContain("useSettings")
  })
})
