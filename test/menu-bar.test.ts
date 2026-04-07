import { describe, test, expect } from "bun:test"
import { readFileSync, existsSync } from "fs"
import { resolve } from "path"

describe("Menu Bar — Rust lib.rs", () => {
  const libRs = readFileSync(
    resolve(__dirname, "../src-tauri/src/lib.rs"),
    "utf-8",
  )

  test("imports SubmenuBuilder for menu construction", () => {
    expect(libRs).toContain("SubmenuBuilder")
  })

  test("imports MenuItemBuilder for menu items", () => {
    expect(libRs).toContain("MenuItemBuilder")
  })

  test("imports Emitter for event forwarding", () => {
    expect(libRs).toContain("Emitter")
  })

  test("sets application menu via app.set_menu", () => {
    expect(libRs).toContain("app.set_menu(menu)")
  })

  test("forwards menu events via app.emit(menu-event)", () => {
    expect(libRs).toContain('emit(\n                        "menu-event"')
  })

  // ── File menu ──
  test("File menu: Save with Cmd+S", () => {
    expect(libRs).toContain('"save", "Save"')
    expect(libRs).toContain('"CmdOrCtrl+S"')
  })

  test("File menu: Close Tab with Cmd+W", () => {
    expect(libRs).toContain('"close-tab", "Close Tab"')
    expect(libRs).toContain('"CmdOrCtrl+W"')
  })

  test("File menu: Quit with Cmd+Q", () => {
    expect(libRs).toContain('"quit", "Quit"')
    expect(libRs).toContain('"CmdOrCtrl+Q"')
  })

  // ── Edit menu ──
  test("Edit menu: Undo with Cmd+Z", () => {
    expect(libRs).toContain('"undo", "Undo"')
    expect(libRs).toContain('"CmdOrCtrl+Z"')
  })

  test("Edit menu: Redo with Cmd+Shift+Z", () => {
    expect(libRs).toContain('"redo", "Redo"')
    expect(libRs).toContain('"CmdOrCtrl+Shift+Z"')
  })

  test("Edit menu: Copy with Cmd+C", () => {
    expect(libRs).toContain('"copy", "Copy"')
    expect(libRs).toContain('"CmdOrCtrl+C"')
  })

  test("Edit menu: Delete", () => {
    expect(libRs).toContain('"delete", "Delete"')
  })

  // ── View menu ──
  test("View menu: Zoom In with Cmd+=", () => {
    expect(libRs).toContain('"zoom-in", "Zoom In"')
    expect(libRs).toContain('"CmdOrCtrl+="')
  })

  test("View menu: Zoom Out with Cmd+-", () => {
    expect(libRs).toContain('"zoom-out", "Zoom Out"')
    expect(libRs).toContain('"CmdOrCtrl+-"')
  })

  test("View menu: Fit to Window with Cmd+0", () => {
    expect(libRs).toContain('"fit-to-window", "Fit to Window"')
    expect(libRs).toContain('"CmdOrCtrl+0"')
  })

  // ── Tools menu ──
  test("Tools menu: all 12 tools present", () => {
    const toolEntries = [
      ['"select", "Select"'],
      ['"pen", "Pen"'],
      ['"pencil", "Pencil"'],
      ['"marker", "Marker"'],
      ['"eraser", "Eraser"'],
      ['"arrow", "Arrow"'],
      ['"line", "Line"'],
      ['"rect", "Rectangle"'],
      ['"ellipse", "Circle"'],
      ['"callout", "Callout"'],
      ['"text", "Text"'],
      ['"redact", "Redact"'],
    ]
    for (const [entry] of toolEntries) {
      expect(libRs).toContain(entry)
    }
  })

  // ── Submenu structure ──
  test("has File, Edit, View, Tools submenus", () => {
    expect(libRs).toContain('"File"')
    expect(libRs).toContain('"Edit"')
    expect(libRs).toContain('"View"')
    expect(libRs).toContain('"Tools"')
  })

  test("quit menu item exits the application", () => {
    expect(libRs).toContain('if id == "quit"')
    expect(libRs).toContain("app_handle.exit(0)")
  })
})

describe("useMenuEvents composable", () => {
  const composablePath = resolve(
    __dirname,
    "../src/composables/useMenuEvents.ts",
  )

  test("useMenuEvents.ts exists", () => {
    expect(existsSync(composablePath)).toBe(true)
  })

  const source = readFileSync(composablePath, "utf-8")

  test("listens for menu-event from Tauri", () => {
    expect(source).toContain("listen")
    expect(source).toContain('"menu-event"')
  })

  test("imports useToolStore for tool switching", () => {
    expect(source).toContain("useToolStore")
    expect(source).toContain("setTool")
  })

  test("imports useSettings for theme toggle", () => {
    expect(source).toContain("useSettings")
    expect(source).toContain("setTheme")
  })

  test("handles all action event IDs", () => {
    const actionIds = [
      "undo",
      "redo",
      "copy",
      "save",
      "delete",
      "close-tab",
      "zoom-in",
      "zoom-out",
      "fit-to-window",
      "toggle-theme",
    ]
    for (const id of actionIds) {
      expect(source).toContain(`"${id}"`)
    }
  })

  test("validates tool IDs before dispatching", () => {
    expect(source).toContain("isToolId")
    expect(source).toContain("TOOL_IDS")
  })

  test("exports MenuEventHandlers interface", () => {
    expect(source).toContain("MenuEventHandlers")
    expect(source).toContain("onUndo")
    expect(source).toContain("onRedo")
    expect(source).toContain("onCopy")
    expect(source).toContain("onSave")
    expect(source).toContain("onDelete")
    expect(source).toContain("onCloseTab")
    expect(source).toContain("onZoomIn")
    expect(source).toContain("onZoomOut")
    expect(source).toContain("onFitToWindow")
  })

  test("returns unlisten function for cleanup", () => {
    expect(source).toContain("unlisten")
    expect(source).toContain("return unlisten")
  })
})
