import { describe, test, expect } from "bun:test"
import { readFileSync, existsSync } from "fs"
import { resolve } from "path"

const srcDir = resolve(__dirname, "../src")
const componentsDir = resolve(srcDir, "components")
const composablesDir = resolve(srcDir, "composables")
const typesDir = resolve(srcDir, "types")

describe("Tab Types", () => {
  test("tab.ts defines the Tab interface", () => {
    const content = readFileSync(resolve(typesDir, "tab.ts"), "utf-8")
    expect(content).toContain("export interface Tab")
    expect(content).toContain('type: "clipboard" | "editing"')
    expect(content).toContain("imageUrl: string | null")
    expect(content).toContain("undoRedo: UndoRedoInstance")
    expect(content).toContain("copiedSinceLastEdit")
    expect(content).toContain("imageWidth")
    expect(content).toContain("imageHeight")
  })

  test("tab.ts imports UndoRedoInstance", () => {
    const content = readFileSync(resolve(typesDir, "tab.ts"), "utf-8")
    expect(content).toContain("UndoRedoInstance")
    expect(content).toContain("useUndoRedo")
  })
})

describe("Clipboard Composable", () => {
  test("useClipboard.ts exists with correct exports", () => {
    const content = readFileSync(
      resolve(composablesDir, "useClipboard.ts"),
      "utf-8",
    )
    expect(content).toContain("readClipboardImage")
    expect(content).toContain("writeClipboardImage")
    expect(content).toContain("readImage")
    expect(content).toContain("ClipboardImage")
  })

  test("useClipboard.ts uses Tauri clipboard plugin", () => {
    const content = readFileSync(
      resolve(composablesDir, "useClipboard.ts"),
      "utf-8",
    )
    expect(content).toContain("@tauri-apps/plugin-clipboard-manager")
    expect(content).toContain("OffscreenCanvas")
    expect(content).toContain("createObjectURL")
  })

  test("useClipboard.ts handles errors gracefully", () => {
    const content = readFileSync(
      resolve(composablesDir, "useClipboard.ts"),
      "utf-8",
    )
    expect(content).toContain("catch")
    expect(content).toContain("return null")
  })

  test("useClipboard.ts uses Image.new for write", () => {
    const content = readFileSync(
      resolve(composablesDir, "useClipboard.ts"),
      "utf-8",
    )
    expect(content).toContain("Image.new")
    expect(content).toContain("@tauri-apps/api/image")
  })

  test("useClipboard.ts uses image.size() for dimensions", () => {
    const content = readFileSync(
      resolve(composablesDir, "useClipboard.ts"),
      "utf-8",
    )
    expect(content).toContain("image.size()")
  })
})

describe("Tab Store", () => {
  test("useTabStore.ts exists with correct exports", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    expect(content).toContain("useTabStore")
    expect(content).toContain("activeTab")
    expect(content).toContain("clipboardTab")
    expect(content).toContain("setActiveTab")
    expect(content).toContain("updateClipboardImage")
  })

  test("useTabStore.ts initializes clipboard tab", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    expect(content).toContain('id: "clipboard"')
    expect(content).toContain('type: "clipboard"')
    expect(content).toContain('name: "Clipboard"')
  })

  test("useTabStore.ts uses shallowRef for tabs array", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    expect(content).toContain("shallowRef<Tab[]>")
  })

  test("useTabStore.ts revokes old URLs on clipboard update", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    expect(content).toContain("revokeObjectURL")
  })

  test("useTabStore.ts uses module-level singleton pattern", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    // Module-level state outside the composable function
    expect(content).toContain("const tabs = shallowRef")
    expect(content).toContain("const activeTabId = ref")
    // These should be declared before the exported function
    const tabsIndex = content.indexOf("const tabs = shallowRef")
    const functionIndex = content.indexOf("export function useTabStore")
    expect(tabsIndex).toBeLessThan(functionIndex)
  })
})

describe("Tab Store — Editing Tab Lifecycle", () => {
  test("useTabStore.ts exports createEditingTab", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    expect(content).toContain("createEditingTab")
    expect(content).toContain('type: "editing"')
    expect(content).toContain("crypto.randomUUID()")
  })

  test("createEditingTab generates HH:mm:ss name", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    // Should format hours, minutes, seconds with zero-padding
    expect(content).toContain("getHours()")
    expect(content).toContain("getMinutes()")
    expect(content).toContain("getSeconds()")
    expect(content).toContain('padStart(2, "0")')
  })

  test("createEditingTab sets copiedSinceLastEdit to false", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    // Editing tabs start with unsaved state
    const createFnStart = content.indexOf("function createEditingTab")
    const createFnEnd = content.indexOf(
      "return tab",
      createFnStart,
    )
    const createFnBody = content.slice(createFnStart, createFnEnd)
    expect(createFnBody).toContain("copiedSinceLastEdit: false")
  })

  test("createEditingTab creates a fresh undoRedo instance", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    const createFnStart = content.indexOf("function createEditingTab")
    const createFnEnd = content.indexOf(
      "return tab",
      createFnStart,
    )
    const createFnBody = content.slice(createFnStart, createFnEnd)
    expect(createFnBody).toContain("undoRedo: createUndoRedo()")
  })

  test("createEditingTab switches activeTabId to the new tab", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    const createFnStart = content.indexOf("function createEditingTab")
    const returnIdx = content.indexOf("return tab", createFnStart)
    const createFnBody = content.slice(createFnStart, returnIdx)
    expect(createFnBody).toContain("activeTabId.value = tab.id")
  })
})

describe("Tab Store — duplicateActiveTab", () => {
  test("useTabStore.ts exports duplicateActiveTab", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    expect(content).toContain("duplicateActiveTab")
  })

  test("duplicateActiveTab returns null when active tab has no image", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    const fnStart = content.indexOf("function duplicateActiveTab")
    const fnEnd = content.indexOf("\n  }", fnStart)
    const fnBody = content.slice(fnStart, fnEnd)
    expect(fnBody).toContain("!source?.imageUrl")
    expect(fnBody).toContain("return null")
  })

  test("duplicateActiveTab creates a new editing tab from the active tab", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    const fnStart = content.indexOf("function duplicateActiveTab")
    const fnEnd = content.indexOf("\n  }", fnStart)
    const fnBody = content.slice(fnStart, fnEnd)
    expect(fnBody).toContain("source.imageUrl")
    expect(fnBody).toContain("source.imageWidth")
    expect(fnBody).toContain("source.imageHeight")
  })
})

describe("Tab Store — closeTab", () => {
  test("useTabStore.ts exports closeTab", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    expect(content).toContain("closeTab")
  })

  test("closeTab cannot close clipboard tab", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    const fnStart = content.indexOf("function closeTab")
    const fnEnd = content.indexOf("\n  }", fnStart)
    const fnBody = content.slice(fnStart, fnEnd)
    expect(fnBody).toContain('tab.type === "clipboard"')
    expect(fnBody).toContain("return")
  })

  test("closeTab revokes blob URL", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    const fnStart = content.indexOf("function closeTab")
    const fnEnd = content.indexOf("\n  }", fnStart)
    const fnBody = content.slice(fnStart, fnEnd)
    expect(fnBody).toContain("URL.revokeObjectURL(tab.imageUrl)")
  })

  test("closeTab clears undo stack", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    const fnStart = content.indexOf("function closeTab")
    const fnEnd = content.indexOf("\n  }", fnStart)
    const fnBody = content.slice(fnStart, fnEnd)
    expect(fnBody).toContain("tab.undoRedo.clear()")
  })

  test("closeTab switches to previous tab or clipboard", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    const fnStart = content.indexOf("function closeTab")
    const fnEnd = content.indexOf("\n  }", fnStart)
    const fnBody = content.slice(fnStart, fnEnd)
    expect(fnBody).toContain("activeTabId.value === tabId")
    expect(fnBody).toContain('?? "clipboard"')
  })
})

describe("Tab Store — renameTab", () => {
  test("useTabStore.ts exports renameTab", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    expect(content).toContain("renameTab")
  })

  test("renameTab cannot rename clipboard tab", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    const fnStart = content.indexOf("function renameTab")
    const fnEnd = content.indexOf("\n  }", fnStart)
    const fnBody = content.slice(fnStart, fnEnd)
    expect(fnBody).toContain('tab.type === "clipboard"')
  })

  test("renameTab trims whitespace and preserves old name on empty", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    const fnStart = content.indexOf("function renameTab")
    const fnEnd = content.indexOf("\n  }", fnStart)
    const fnBody = content.slice(fnStart, fnEnd)
    expect(fnBody).toContain("newName.trim()")
    expect(fnBody).toContain("|| tab.name")
  })

  test("renameTab triggers reactivity via array replacement", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    const fnStart = content.indexOf("function renameTab")
    const fnEnd = content.indexOf("\n  }", fnStart)
    const fnBody = content.slice(fnStart, fnEnd)
    expect(fnBody).toContain("tabs.value = tabs.value.map")
  })
})

describe("Tab Store — copiedSinceLastEdit lifecycle", () => {
  test("useTabStore.ts exports markTabEdited", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    expect(content).toContain("markTabEdited")
  })

  test("markTabEdited sets copiedSinceLastEdit to false", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    const fnStart = content.indexOf("function markTabEdited")
    const fnEnd = content.indexOf("\n  }", fnStart)
    const fnBody = content.slice(fnStart, fnEnd)
    expect(fnBody).toContain("copiedSinceLastEdit: false")
  })

  test("useTabStore.ts exports markTabCopied", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    expect(content).toContain("markTabCopied")
  })

  test("markTabCopied sets copiedSinceLastEdit to true and marks saved", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    const fnStart = content.indexOf("function markTabCopied")
    const fnEnd = content.indexOf("\n  }", fnStart)
    const fnBody = content.slice(fnStart, fnEnd)
    expect(fnBody).toContain("copiedSinceLastEdit: true")
    expect(fnBody).toContain("undoRedo.markSaved()")
  })
})

describe("EmptyClipboard Component", () => {
  test("EmptyClipboard.vue exists", () => {
    expect(existsSync(resolve(componentsDir, "EmptyClipboard.vue"))).toBe(true)
  })

  test("EmptyClipboard.vue shows instruction text", () => {
    const content = readFileSync(
      resolve(componentsDir, "EmptyClipboard.vue"),
      "utf-8",
    )
    expect(content).toContain("No image in clipboard")
    expect(content).toContain("displayShortcut")
  })

  test("EmptyClipboard.vue uses semantic tokens", () => {
    const content = readFileSync(
      resolve(componentsDir, "EmptyClipboard.vue"),
      "utf-8",
    )
    expect(content).toContain("var(--text-primary)")
    expect(content).toContain("var(--text-secondary)")
    expect(content).not.toMatch(/var\(--flexoki-/)
  })
})

describe("TabItem Component", () => {
  test("TabItem.vue exists with correct props", () => {
    const content = readFileSync(
      resolve(componentsDir, "TabItem.vue"),
      "utf-8",
    )
    expect(content).toContain("tab: Tab")
    expect(content).toContain("isActive: boolean")
  })

  test("TabItem.vue handles clipboard and editing tab types", () => {
    const content = readFileSync(
      resolve(componentsDir, "TabItem.vue"),
      "utf-8",
    )
    expect(content).toContain("tab.type === 'clipboard'")
    expect(content).toContain("copiedSinceLastEdit")
    expect(content).toContain("tab-item--clipboard")
    expect(content).toContain("tab-item--copied")
  })

  test("TabItem.vue emits select event", () => {
    const content = readFileSync(
      resolve(componentsDir, "TabItem.vue"),
      "utf-8",
    )
    expect(content).toContain("select: [tabId: string]")
    expect(content).toContain("emit('select'")
  })

  test("TabItem.vue uses semantic tokens", () => {
    const content = readFileSync(
      resolve(componentsDir, "TabItem.vue"),
      "utf-8",
    )
    expect(content).toContain("var(--tab-default)")
    expect(content).toContain("var(--tab-active)")
    expect(content).toContain("var(--tab-clipboard)")
    expect(content).toContain("var(--tab-copied)")
    expect(content).not.toMatch(/var\(--flexoki-/)
  })

  test("TabItem.vue has close button for editing tabs", () => {
    const content = readFileSync(
      resolve(componentsDir, "TabItem.vue"),
      "utf-8",
    )
    expect(content).toContain("tab-item__close")
    expect(content).toContain("tab.type === 'editing'")
    expect(content).toContain('emit("close"')
    expect(content).toContain("Close tab")
  })

  test("TabItem.vue emits close event", () => {
    const content = readFileSync(
      resolve(componentsDir, "TabItem.vue"),
      "utf-8",
    )
    expect(content).toContain("close: [tabId: string]")
  })

  test("TabItem.vue supports double-click rename", () => {
    const content = readFileSync(
      resolve(componentsDir, "TabItem.vue"),
      "utf-8",
    )
    expect(content).toContain("@dblclick")
    expect(content).toContain("isRenaming")
    expect(content).toContain("TabNameEditor")
    expect(content).toContain("rename: [tabId: string, newName: string]")
  })

  test("TabItem.vue close button uses stopPropagation", () => {
    const content = readFileSync(
      resolve(componentsDir, "TabItem.vue"),
      "utf-8",
    )
    expect(content).toContain("stopPropagation")
  })

  test("TabItem.vue close button hidden on clipboard tabs", () => {
    const content = readFileSync(
      resolve(componentsDir, "TabItem.vue"),
      "utf-8",
    )
    // Close button is only rendered for editing tabs via v-if
    expect(content).toContain('v-if="tab.type === \'editing\'"')
  })
})

describe("TabNameEditor Component", () => {
  test("TabNameEditor.vue exists", () => {
    expect(existsSync(resolve(componentsDir, "TabNameEditor.vue"))).toBe(true)
  })

  test("TabNameEditor.vue has correct props and emits", () => {
    const content = readFileSync(
      resolve(componentsDir, "TabNameEditor.vue"),
      "utf-8",
    )
    expect(content).toContain("currentName: string")
    expect(content).toContain("confirm: [name: string]")
    expect(content).toContain("cancel: []")
  })

  test("TabNameEditor.vue handles Enter, Escape, and blur", () => {
    const content = readFileSync(
      resolve(componentsDir, "TabNameEditor.vue"),
      "utf-8",
    )
    expect(content).toContain('"Enter"')
    expect(content).toContain('"Escape"')
    expect(content).toContain("@blur")
  })

  test("TabNameEditor.vue auto-selects text on mount", () => {
    const content = readFileSync(
      resolve(componentsDir, "TabNameEditor.vue"),
      "utf-8",
    )
    expect(content).toContain("onMounted")
    expect(content).toContain("select()")
    expect(content).toContain("nextTick")
  })

  test("TabNameEditor.vue uses semantic tokens", () => {
    const content = readFileSync(
      resolve(componentsDir, "TabNameEditor.vue"),
      "utf-8",
    )
    expect(content).toContain("var(--surface-elevated)")
    expect(content).toContain("var(--interactive-default)")
    expect(content).toContain("var(--text-primary)")
    expect(content).not.toMatch(/var\(--flexoki-/)
  })
})

describe("CloseWarningDialog Component", () => {
  test("CloseWarningDialog.vue exists", () => {
    expect(existsSync(resolve(componentsDir, "CloseWarningDialog.vue"))).toBe(
      true,
    )
  })

  test("CloseWarningDialog.vue has three action buttons", () => {
    const content = readFileSync(
      resolve(componentsDir, "CloseWarningDialog.vue"),
      "utf-8",
    )
    expect(content).toContain("Copy &amp; Close")
    expect(content).toContain("Discard")
    expect(content).toContain("Cancel")
  })

  test("CloseWarningDialog.vue emits correct events", () => {
    const content = readFileSync(
      resolve(componentsDir, "CloseWarningDialog.vue"),
      "utf-8",
    )
    expect(content).toContain("copyAndClose: []")
    expect(content).toContain("discard: []")
    expect(content).toContain("cancel: []")
  })

  test("CloseWarningDialog.vue uses Teleport for modal", () => {
    const content = readFileSync(
      resolve(componentsDir, "CloseWarningDialog.vue"),
      "utf-8",
    )
    expect(content).toContain('Teleport to="body"')
    expect(content).toContain("dialog-backdrop")
    expect(content).toContain('role="dialog"')
    expect(content).toContain('aria-modal="true"')
  })

  test("CloseWarningDialog.vue backdrop dismisses on click", () => {
    const content = readFileSync(
      resolve(componentsDir, "CloseWarningDialog.vue"),
      "utf-8",
    )
    expect(content).toContain("@click.self")
    expect(content).toContain("emit('cancel')")
  })

  test("CloseWarningDialog.vue displays tab name in message", () => {
    const content = readFileSync(
      resolve(componentsDir, "CloseWarningDialog.vue"),
      "utf-8",
    )
    expect(content).toContain("tabName: string")
    expect(content).toContain("{{ tabName }}")
  })

  test("CloseWarningDialog.vue uses semantic tokens", () => {
    const content = readFileSync(
      resolve(componentsDir, "CloseWarningDialog.vue"),
      "utf-8",
    )
    expect(content).toContain("var(--overlay-backdrop)")
    expect(content).toContain("var(--surface-elevated)")
    expect(content).toContain("var(--text-primary)")
    expect(content).toContain("var(--text-secondary)")
    expect(content).toContain("var(--interactive-default)")
    expect(content).toContain("var(--shadow-lg)")
    expect(content).not.toMatch(/var\(--flexoki-/)
  })

  test("CloseWarningDialog.vue primary button has autofocus", () => {
    const content = readFileSync(
      resolve(componentsDir, "CloseWarningDialog.vue"),
      "utf-8",
    )
    expect(content).toContain("autofocus")
  })
})

describe("CanvasViewport Integration", () => {
  test("CanvasViewport.vue shows EmptyClipboard when no image", () => {
    const content = readFileSync(
      resolve(componentsDir, "CanvasViewport.vue"),
      "utf-8",
    )
    expect(content).toContain("EmptyClipboard")
    expect(content).toContain("hasImage")
    expect(content).toContain("activeTab")
  })

  test("CanvasViewport.vue uses useTabStore", () => {
    const content = readFileSync(
      resolve(componentsDir, "CanvasViewport.vue"),
      "utf-8",
    )
    expect(content).toContain("useTabStore")
  })

  test("CanvasViewport.vue displays image with correct attributes", () => {
    const content = readFileSync(
      resolve(componentsDir, "CanvasViewport.vue"),
      "utf-8",
    )
    expect(content).toContain("activeTab.imageUrl")
    expect(content).toContain("activeTab.imageWidth")
    expect(content).toContain("activeTab.imageHeight")
    expect(content).toContain('draggable="false"')
  })

  test("CanvasViewport.vue preserves flex: 1 and position: relative", () => {
    const content = readFileSync(
      resolve(componentsDir, "CanvasViewport.vue"),
      "utf-8",
    )
    expect(content).toContain("flex: 1")
    expect(content).toContain("position: relative")
  })

  test("CanvasViewport.vue uses semantic tokens only", () => {
    const content = readFileSync(
      resolve(componentsDir, "CanvasViewport.vue"),
      "utf-8",
    )
    expect(content).toContain("var(--surface-canvas)")
    expect(content).not.toMatch(/var\(--flexoki-/)
  })
})

describe("TabBar Integration", () => {
  test("TabBar.vue renders TabItem components", () => {
    const content = readFileSync(
      resolve(componentsDir, "TabBar.vue"),
      "utf-8",
    )
    expect(content).toContain("TabItem")
    expect(content).toContain("v-for")
    expect(content).toContain("useTabStore")
  })

  test("TabBar.vue preserves flex-shrink: 0", () => {
    const content = readFileSync(
      resolve(componentsDir, "TabBar.vue"),
      "utf-8",
    )
    expect(content).toContain("flex-shrink: 0")
  })

  test("TabBar.vue wires close event to handleClose", () => {
    const content = readFileSync(
      resolve(componentsDir, "TabBar.vue"),
      "utf-8",
    )
    expect(content).toContain("@close")
    expect(content).toContain("handleClose")
    expect(content).toContain("closeTab")
  })

  test("TabBar.vue wires rename event to handleRename", () => {
    const content = readFileSync(
      resolve(componentsDir, "TabBar.vue"),
      "utf-8",
    )
    expect(content).toContain("@rename")
    expect(content).toContain("handleRename")
    expect(content).toContain("renameTab")
  })

  test("TabBar.vue includes CloseWarningDialog", () => {
    const content = readFileSync(
      resolve(componentsDir, "TabBar.vue"),
      "utf-8",
    )
    expect(content).toContain("CloseWarningDialog")
    expect(content).toContain("pendingCloseTabId")
    expect(content).toContain("pendingCloseTabName")
  })

  test("TabBar.vue implements close-warning matrix logic", () => {
    const content = readFileSync(
      resolve(componentsDir, "TabBar.vue"),
      "utf-8",
    )
    // Checks copiedSinceLastEdit and isEdited to determine dialog
    expect(content).toContain("copiedSinceLastEdit")
    expect(content).toContain("isEdited")
    expect(content).toContain("hasUncopiedEdits")
  })

  test("TabBar.vue dialog emits are wired correctly", () => {
    const content = readFileSync(
      resolve(componentsDir, "TabBar.vue"),
      "utf-8",
    )
    expect(content).toContain("@copy-and-close")
    expect(content).toContain("@discard")
    expect(content).toContain("@cancel")
    expect(content).toContain("handleCopyAndClose")
    expect(content).toContain("handleDiscard")
    expect(content).toContain("handleCancelClose")
  })
})
