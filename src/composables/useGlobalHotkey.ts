import {
  register,
  unregister,
  isRegistered,
} from "@tauri-apps/plugin-global-shortcut"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { readClipboardImage } from "./useClipboard"
import { useTabStore } from "./useTabStore"

const DEFAULT_SHORTCUT = "CommandOrControl+Shift+J"

export function useGlobalHotkey() {
  async function registerHotkey(
    shortcut = DEFAULT_SHORTCUT,
  ): Promise<boolean> {
    try {
      await register(shortcut, async (event) => {
        if (event.state !== "Pressed") return

        const window = getCurrentWindow()

        // Show and focus the window
        await window.show()
        await window.unminimize()
        await window.setFocus()

        // Read clipboard and update the clipboard tab
        const { updateClipboardImage } = useTabStore()
        const image = await readClipboardImage()
        if (image) {
          updateClipboardImage(image.url, image.width, image.height)
        } else {
          updateClipboardImage(null, 0, 0)
        }
      })
      return true
    } catch (err) {
      console.error("Failed to register global shortcut:", err)
      return false
    }
  }

  async function unregisterHotkey(
    shortcut = DEFAULT_SHORTCUT,
  ): Promise<void> {
    try {
      if (await isRegistered(shortcut)) {
        await unregister(shortcut)
      }
    } catch {
      // Ignore errors on unregister
    }
  }

  async function changeHotkey(
    oldShortcut: string,
    newShortcut: string,
  ): Promise<boolean> {
    await unregisterHotkey(oldShortcut)
    const success = await registerHotkey(newShortcut)
    if (!success) {
      // Fallback to old shortcut
      await registerHotkey(oldShortcut)
      return false
    }
    return true
  }

  return {
    registerHotkey,
    unregisterHotkey,
    changeHotkey,
    DEFAULT_SHORTCUT,
  }
}
