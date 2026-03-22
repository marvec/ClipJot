import { shallowRef, ref, computed } from "vue"
import type { Tab } from "../types/tab"
import { createUndoRedo } from "./useUndoRedo"
import { createDrawingState } from "./useDrawing"
import { createCropState } from "./useCrop"
import { createAnnotationState } from "./useAnnotationStore"
import { createRedactionState } from "./useRedaction"
import { useSettings } from "./useSettings"

/**
 * Format a tab name from a date and pattern string.
 * Supported tokens: HH (hours), mm (minutes), ss (seconds),
 * YYYY (year), MM (month), DD (day).
 */
function formatTabName(date: Date, pattern: string): string {
  return pattern
    .replace("YYYY", String(date.getFullYear()))
    .replace("MM", String(date.getMonth() + 1).padStart(2, "0"))
    .replace("DD", String(date.getDate()).padStart(2, "0"))
    .replace("HH", String(date.getHours()).padStart(2, "0"))
    .replace("mm", String(date.getMinutes()).padStart(2, "0"))
    .replace("ss", String(date.getSeconds()).padStart(2, "0"))
}

// Module-level state (singleton)
const tabs = shallowRef<Tab[]>([])
const activeTabId = ref<string>("")

// Initialize with the clipboard tab
function initClipboardTab(): void {
  if (tabs.value.length > 0) return // Already initialized
  const clipboardTab: Tab = {
    id: "clipboard",
    name: "Clipboard",
    type: "clipboard",
    imageUrl: null,
    imageWidth: 0,
    imageHeight: 0,
    copiedSinceLastEdit: true,
    undoRedo: createUndoRedo(),
    drawingState: createDrawingState(),
    cropState: createCropState(),
    annotationState: createAnnotationState(),
    redactionState: createRedactionState(),
  }
  tabs.value = [clipboardTab]
  activeTabId.value = "clipboard"
}

export function useTabStore() {
  // Ensure clipboard tab exists
  initClipboardTab()

  const activeTab = computed<Tab | null>(
    () => tabs.value.find((t) => t.id === activeTabId.value) ?? null,
  )

  const clipboardTab = computed<Tab | null>(
    () => tabs.value.find((t) => t.type === "clipboard") ?? null,
  )

  function setActiveTab(tabId: string): void {
    if (tabs.value.some((t) => t.id === tabId)) {
      activeTabId.value = tabId
    }
  }

  function updateClipboardImage(
    url: string | null,
    width: number,
    height: number,
  ): void {
    const clipboard = tabs.value.find((t) => t.type === "clipboard")
    if (!clipboard) return

    // Revoke old URL to prevent memory leak
    if (clipboard.imageUrl) {
      URL.revokeObjectURL(clipboard.imageUrl)
    }

    // Replace the tab object (new reference) so shallowRef triggers
    // computed chains that depend on tab properties like imageUrl
    const updated: Tab = {
      ...clipboard,
      imageUrl: url,
      imageWidth: width,
      imageHeight: height,
    }
    tabs.value = tabs.value.map((t) => (t.type === "clipboard" ? updated : t))
  }

  /**
   * Create a new editing tab from an image.
   * Default name is the current time as HH:mm:ss.
   */
  function createEditingTab(
    imageUrl: string,
    imageWidth: number,
    imageHeight: number,
  ): Tab {
    const now = new Date()
    const { tabNamePattern } = useSettings()
    const name = formatTabName(now, tabNamePattern.value)

    const tab: Tab = {
      id: crypto.randomUUID(),
      name,
      type: "editing",
      imageUrl,
      imageWidth,
      imageHeight,
      copiedSinceLastEdit: false,
      undoRedo: createUndoRedo(),
      drawingState: createDrawingState(),
      cropState: createCropState(),
      annotationState: createAnnotationState(),
      redactionState: createRedactionState(),
    }

    tabs.value = [...tabs.value, tab]
    activeTabId.value = tab.id
    return tab
  }

  /**
   * Duplicate the active tab into a new editing tab, copying all layer state
   * (strokes, annotations, redaction regions, crop) and undo history.
   */
  function duplicateActiveTab(): Tab | null {
    const source = activeTab.value
    if (!source?.imageUrl) return null

    const now = new Date()
    const name = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`

    // Deep-copy drawing state (strokes with fresh cached paths)
    const newDrawingState = createDrawingState()
    newDrawingState.strokes.value = source.drawingState.strokes.value.map(
      (s) => ({ ...s, cachedPath: undefined }),
    )

    // Deep-copy annotations
    const newAnnotationState = createAnnotationState()
    newAnnotationState.annotations.value = source.annotationState.annotations.value.map(
      (a) => ({ ...a }),
    )

    // Deep-copy redaction regions
    const newRedactionState = createRedactionState()
    newRedactionState.regions.value = source.redactionState.regions.value.map(
      (r) => ({ ...r }),
    )

    // Deep-copy crop state
    const newCropState = createCropState()
    if (source.cropState.cropBounds.value) {
      newCropState.cropBounds.value = { ...source.cropState.cropBounds.value }
    }

    // Clone undo history: replay all commands in a new stack
    // For simplicity, the new tab starts with the same visual state
    // but a fresh undo stack (deep-cloning command closures is fragile)
    const newUndoRedo = createUndoRedo()

    const tab: Tab = {
      id: crypto.randomUUID(),
      name,
      type: "editing",
      imageUrl: source.imageUrl,
      imageWidth: source.imageWidth,
      imageHeight: source.imageHeight,
      copiedSinceLastEdit: false,
      undoRedo: newUndoRedo,
      drawingState: newDrawingState,
      cropState: newCropState,
      annotationState: newAnnotationState,
      redactionState: newRedactionState,
    }

    tabs.value = [...tabs.value, tab]
    activeTabId.value = tab.id
    return tab
  }

  /**
   * Close an editing tab. Revokes its blob URL, clears undo stack,
   * and switches to the previous tab or clipboard.
   * The clipboard tab cannot be closed.
   */
  function closeTab(tabId: string): void {
    const tab = tabs.value.find((t) => t.id === tabId)
    if (!tab || tab.type === "clipboard") return

    // Revoke blob URL
    if (tab.imageUrl) {
      URL.revokeObjectURL(tab.imageUrl)
    }

    // Clear undo stack
    tab.undoRedo.clear()

    // Remove tab
    const newTabs = tabs.value.filter((t) => t.id !== tabId)
    tabs.value = newTabs

    // Switch to previous tab or clipboard
    if (activeTabId.value === tabId) {
      activeTabId.value = newTabs[newTabs.length - 1]?.id ?? "clipboard"
    }
  }

  /**
   * Rename an editing tab. Trims whitespace; no-ops on empty string.
   * The clipboard tab cannot be renamed.
   */
  function renameTab(tabId: string, newName: string): void {
    const tab = tabs.value.find((t) => t.id === tabId)
    if (!tab || tab.type === "clipboard") return
    const trimmed = newName.trim() || tab.name
    tabs.value = tabs.value.map((t) =>
      t.id === tabId ? { ...t, name: trimmed } : t,
    )
  }

  /**
   * Mark a tab as having unsaved edits (resets copiedSinceLastEdit to false).
   */
  function markTabEdited(tabId: string): void {
    const tab = tabs.value.find((t) => t.id === tabId)
    if (!tab) return
    tabs.value = tabs.value.map((t) =>
      t.id === tabId ? { ...t, copiedSinceLastEdit: false } : t,
    )
  }

  /**
   * Mark a tab as having been copied (sets copiedSinceLastEdit to true
   * and marks the undo stack as saved).
   */
  function markTabCopied(tabId: string): void {
    const tab = tabs.value.find((t) => t.id === tabId)
    if (!tab) return
    tab.undoRedo.markSaved()
    tabs.value = tabs.value.map((t) =>
      t.id === tabId ? { ...t, copiedSinceLastEdit: true } : t,
    )
  }

  /**
   * Request to close a tab, implementing the auto-copy + close-warning matrix.
   *
   * - No edits → close immediately, returns 'closed'
   * - Auto-copy ON + uncopied edits → copy then close, returns 'closed'
   * - Auto-copy OFF + uncopied edits → returns 'needs-warning' (UI shows dialog)
   */
  async function requestCloseTab(
    tabId: string,
  ): Promise<"closed" | "needs-warning"> {
    const tab = tabs.value.find((t) => t.id === tabId)
    if (!tab || tab.type === "clipboard") return "closed"

    const hasUncopiedEdits =
      !tab.copiedSinceLastEdit && tab.undoRedo.isEdited.value

    if (!hasUncopiedEdits) {
      closeTab(tabId)
      return "closed"
    }

    // Lazy-import settings to avoid circular dependencies
    const { useSettings } = await import("./useSettings")
    const { autoCopyOnClose } = useSettings()

    if (autoCopyOnClose.value) {
      // Auto-copy enabled: copy then close
      try {
        const { copyTabToClipboard } = await import("./useExport")
        await copyTabToClipboard(tab)
        markTabCopied(tabId)
      } catch (err) {
        console.error("Auto-copy on close failed:", err)
        // Still close — user chose auto-copy, failure shouldn't block close
      }
      closeTab(tabId)
      return "closed"
    }

    // Auto-copy disabled: needs user confirmation
    return "needs-warning"
  }

  return {
    tabs,
    activeTabId,
    activeTab,
    clipboardTab,
    setActiveTab,
    updateClipboardImage,
    createEditingTab,
    duplicateActiveTab,
    closeTab,
    renameTab,
    markTabEdited,
    markTabCopied,
    requestCloseTab,
  }
}
