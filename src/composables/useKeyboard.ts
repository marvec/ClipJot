import type { ToolId } from "../types/tools"

/**
 * Tool selection via letter keys.
 * Selection, pencIl, Marker, Eraser, Arrow, Line,
 * Rectangle, Circle, callOut, Text, reDact, croP
 */
export const TOOL_KEY_MAP: Record<string, ToolId> = {
  s: "select",
  i: "pencil",
  m: "marker",
  e: "eraser",
  a: "arrow",
  l: "line",
  r: "rect",
  c: "ellipse",
  o: "callout",
  t: "text",
  d: "redact",
  p: "crop",
}

/** Minimum interval between Cmd+C executions (milliseconds). */
const COPY_DEBOUNCE_MS = 300

let lastCopyTime = 0
let isInitialized = false

/**
 * Check whether the event target is an editable element
 * (input, textarea, contenteditable) where we should NOT intercept keys.
 */
function isTextEditing(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null
  if (!target) return false
  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA") return true
  if (target.isContentEditable) return true
  return false
}

/**
 * Initialize global keyboard shortcut handler.
 * Registers a single `keydown` listener on `window`.
 * Idempotent — calling multiple times is safe.
 */
export function useKeyboard(): { destroy: () => void } {
  if (isInitialized) {
    return { destroy: () => {} }
  }
  isInitialized = true

  function handleKeyDown(e: KeyboardEvent): void {
    const mod = e.metaKey || e.ctrlKey

    // --- Cmd+C: Copy flattened image ---
    if (mod && e.key === "c" && !e.shiftKey) {
      // Don't intercept text selection copy in text inputs
      if (isTextEditing(e)) return

      e.preventDefault()

      const now = Date.now()
      if (now - lastCopyTime < COPY_DEBOUNCE_MS) return
      lastCopyTime = now

      void handleCopy()
      return
    }

    // --- Cmd+S: Save to file ---
    if (mod && e.key === "s" && !e.shiftKey) {
      e.preventDefault()
      void handleSaveToFile()
      return
    }

    // --- Cmd+,: Open settings ---
    if (mod && e.key === "," && !e.shiftKey) {
      e.preventDefault()
      handleOpenSettings()
      return
    }

    // --- Cmd+W: Close active tab ---
    if (mod && e.key === "w" && !e.shiftKey) {
      e.preventDefault()
      void handleCloseTab()
      return
    }

    // --- Cmd+Shift+Z or Cmd+Y: Redo ---
    if (mod && ((e.key === "z" && e.shiftKey) || (e.key === "y" && !e.shiftKey))) {
      e.preventDefault()
      handleRedo()
      return
    }

    // --- Cmd+Z: Undo ---
    if (mod && e.key === "z" && !e.shiftKey) {
      e.preventDefault()
      handleUndo()
      return
    }

    // --- Cmd+D: Duplicate tab ---
    if (mod && e.key === "d" && !e.shiftKey) {
      e.preventDefault()
      handleDuplicateTab()
      return
    }

    // --- Delete / Backspace: Delete selected annotations ---
    if (e.key === "Delete" || e.key === "Backspace") {
      if (isTextEditing(e)) return
      e.preventDefault()
      handleDeleteSelected()
      return
    }

    // --- Escape: Deselect / cancel crop ---
    if (e.key === "Escape") {
      e.preventDefault()
      handleEscape()
      return
    }

    // --- Number keys: Tool selection (only when not editing text) ---
    if (!mod && !e.shiftKey && !e.altKey && TOOL_KEY_MAP[e.key]) {
      if (isTextEditing(e)) return
      e.preventDefault()
      handleToolSelect(TOOL_KEY_MAP[e.key])
      return
    }
  }

  window.addEventListener("keydown", handleKeyDown)

  function destroy(): void {
    window.removeEventListener("keydown", handleKeyDown)
    isInitialized = false
  }

  return { destroy }
}

// --- Handler implementations (lazy-import to avoid circular deps) ---

async function handleCopy(): Promise<void> {
  const { useTabStore } = await import("./useTabStore")
  const { useToast } = await import("./useToast")
  const { copyTabToClipboard } = await import("./useExport")

  const { activeTab, markTabCopied } = useTabStore()
  const toast = useToast()
  const tab = activeTab.value

  if (!tab?.imageUrl) {
    toast.error("Nothing to copy")
    return
  }

  try {
    await copyTabToClipboard(tab)
    markTabCopied(tab.id)
    toast.success("Copied to clipboard")
  } catch (err) {
    toast.error("Copy failed")
    console.error("Cmd+C copy failed:", err)
  }
}

async function handleSaveToFile(): Promise<void> {
  const { useTabStore } = await import("./useTabStore")
  const { useToast } = await import("./useToast")
  const { saveTabToFile } = await import("./useExport")

  const { activeTab } = useTabStore()
  const toast = useToast()
  const tab = activeTab.value

  if (!tab?.imageUrl) {
    toast.error("Nothing to save")
    return
  }

  try {
    const { save } = await import("@tauri-apps/plugin-dialog")

    const filePath = await save({
      defaultPath: `${tab.name}.png`,
      filters: [{ name: "PNG Image", extensions: ["png"] }],
    })

    if (!filePath) return // User cancelled

    await saveTabToFile(tab, filePath)
    toast.success("Saved to file")
  } catch (err) {
    toast.error("Save failed")
    console.error("Cmd+S save failed:", err)
  }
}

async function handleCloseTab(): Promise<void> {
  const { useTabStore } = await import("./useTabStore")

  const { activeTab, requestCloseTab } = useTabStore()
  const tab = activeTab.value
  if (!tab || tab.type === "clipboard") return

  await requestCloseTab(tab.id)
}

function handleUndo(): void {
  // Sync import via module cache (already loaded by app)
  import("./useTabStore").then(({ useTabStore }) => {
    const { activeTab } = useTabStore()
    const tab = activeTab.value
    if (!tab) return
    tab.undoRedo.undo()
  })
}

function handleRedo(): void {
  import("./useTabStore").then(({ useTabStore }) => {
    const { activeTab } = useTabStore()
    const tab = activeTab.value
    if (!tab) return
    tab.undoRedo.redo()
  })
}

function handleDuplicateTab(): void {
  import("./useTabStore").then(({ useTabStore }) => {
    const { duplicateActiveTab } = useTabStore()
    duplicateActiveTab()
  })
}

function handleDeleteSelected(): void {
  Promise.all([
    import("./useSelection"),
    import("./useTabStore"),
    import("./useAnnotationStore"),
  ]).then(([selectionMod, tabMod, annotationMod]) => {
    const { selectedIds, deselect } = selectionMod.useSelection()
    const { activeTab } = tabMod.useTabStore()
    const tab = activeTab.value
    if (!tab || selectedIds.value.size === 0) return

    const store = annotationMod.useAnnotationStore(tab.annotationState)

    for (const id of selectedIds.value) {
      store.removeAnnotation(id)
    }
    deselect()
  })
}

function handleEscape(): void {
  Promise.all([import("./useSelection"), import("./useToolStore")]).then(
    ([selectionMod, toolMod]) => {
      const { deselect, hasSelection } = selectionMod.useSelection()
      const { activeTool, setTool } = toolMod.useToolStore()

      // If crop tool is active, switch to select (CropOverlay handles its own Escape)
      if (activeTool.value === "crop") {
        setTool("select")
        return
      }

      // Otherwise deselect
      if (hasSelection.value) {
        deselect()
        return
      }

      // Switch to select tool as final fallback
      if (activeTool.value !== "select") {
        setTool("select")
      }
    },
  )
}

function handleOpenSettings(): void {
  window.dispatchEvent(new CustomEvent("open-settings"))
}

function handleToolSelect(toolId: ToolId): void {
  import("./useToolStore").then(({ useToolStore }) => {
    const { setTool } = useToolStore()
    setTool(toolId)
  })
}
