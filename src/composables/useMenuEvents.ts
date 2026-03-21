import { listen } from "@tauri-apps/api/event"
import { useToolStore } from "./useToolStore"
import { useSettings } from "./useSettings"
import type { ToolId } from "../types/tools"

/** Menu event payload emitted from Rust via app.emit("menu-event", id) */
interface MenuEventPayload {
  id: string
}

/**
 * Tool IDs that can be activated from the menu bar.
 * Used to validate incoming menu event IDs.
 */
const TOOL_IDS: readonly ToolId[] = [
  "select",
  "pen",
  "pencil",
  "marker",
  "eraser",
  "arrow",
  "line",
  "rect",
  "ellipse",
  "callout",
  "text",
  "redact",
] as const

function isToolId(id: string): id is ToolId {
  return (TOOL_IDS as readonly string[]).includes(id)
}

export interface MenuEventHandlers {
  onUndo: () => void
  onRedo: () => void
  onCopy: () => void
  onSave: () => void
  onDelete: () => void
  onCloseTab: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFitToWindow: () => void
  onSettings: () => void
}

/**
 * Listen for menu events emitted from the Rust native menu bar
 * and dispatch to appropriate handler functions.
 *
 * Call this once during app initialization (e.g., in App.vue setup).
 * Returns an unlisten function for cleanup.
 */
export async function useMenuEvents(
  handlers: MenuEventHandlers,
): Promise<() => void> {
  const { setTool } = useToolStore()
  const { theme, setTheme } = useSettings()

  const unlisten = await listen<MenuEventPayload>(
    "menu-event",
    (event) => {
      const id = event.payload.id

      // Tool activation
      if (isToolId(id)) {
        setTool(id)
        return
      }

      // Action dispatch
      switch (id) {
        case "undo":
          handlers.onUndo()
          break
        case "redo":
          handlers.onRedo()
          break
        case "copy":
          handlers.onCopy()
          break
        case "save":
          handlers.onSave()
          break
        case "delete":
          handlers.onDelete()
          break
        case "close-tab":
          handlers.onCloseTab()
          break
        case "zoom-in":
          handlers.onZoomIn()
          break
        case "zoom-out":
          handlers.onZoomOut()
          break
        case "fit-to-window":
          handlers.onFitToWindow()
          break
        case "settings":
          handlers.onSettings()
          break
        case "toggle-theme": {
          const next = theme.value === "dark" ? "light" : "dark"
          setTheme(next)
          break
        }
        case "quit":
          // Handled natively by Tauri on macOS; no-op on frontend
          break
      }
    },
  )

  return unlisten
}
