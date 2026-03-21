import { shallowRef, ref, computed, triggerRef } from "vue"
import type { Tab } from "../types/tab"
import { createUndoRedo } from "./useUndoRedo"
import { createDrawingState } from "./useDrawing"

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

    clipboard.imageUrl = url
    clipboard.imageWidth = width
    clipboard.imageHeight = height
    triggerRef(tabs) // Notify shallowRef watchers
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
    const name = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`

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
    }

    tabs.value = [...tabs.value, tab]
    activeTabId.value = tab.id
    return tab
  }

  /**
   * Duplicate the clipboard tab into a new editing tab.
   * Shares the blob URL — clipboard will get a fresh one on next refresh.
   */
  function duplicateClipboardTab(): Tab | null {
    const clipboard = tabs.value.find((t) => t.type === "clipboard")
    if (!clipboard?.imageUrl) return null

    return createEditingTab(
      clipboard.imageUrl,
      clipboard.imageWidth,
      clipboard.imageHeight,
    )
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
    tab.name = newName.trim() || tab.name
    triggerRef(tabs)
  }

  /**
   * Mark a tab as having unsaved edits (resets copiedSinceLastEdit to false).
   */
  function markTabEdited(tabId: string): void {
    const tab = tabs.value.find((t) => t.id === tabId)
    if (!tab) return
    tab.copiedSinceLastEdit = false
    triggerRef(tabs)
  }

  /**
   * Mark a tab as having been copied (sets copiedSinceLastEdit to true
   * and marks the undo stack as saved).
   */
  function markTabCopied(tabId: string): void {
    const tab = tabs.value.find((t) => t.id === tabId)
    if (!tab) return
    tab.copiedSinceLastEdit = true
    tab.undoRedo.markSaved()
    triggerRef(tabs)
  }

  return {
    tabs,
    activeTabId,
    activeTab,
    clipboardTab,
    setActiveTab,
    updateClipboardImage,
    createEditingTab,
    duplicateClipboardTab,
    closeTab,
    renameTab,
    markTabEdited,
    markTabCopied,
  }
}
