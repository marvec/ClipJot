import { createApp } from "vue";
import "./assets/reset.css";
import "./assets/flexoki.css";
import "./assets/tokens.css";
import App from "./App.vue";
import { useSettings } from "./composables/useSettings";
import { useGlobalHotkey } from "./composables/useGlobalHotkey";
import { useKeyboard } from "./composables/useKeyboard";
import { readClipboardImage } from "./composables/useClipboard";
import { useTabStore } from "./composables/useTabStore";

// Initialize settings — applies persisted theme (or system default) immediately
useSettings();

createApp(App).mount("#app");

// Register global keyboard shortcuts after app is mounted
useKeyboard();

// Register global hotkey after app is mounted
const { registerHotkey } = useGlobalHotkey();
registerHotkey().then((success) => {
  if (!success) {
    console.warn("Global hotkey registration failed — shortcut may be in use");
  }
});

// Read clipboard on app launch — populate the clipboard tab with current image.
// Retry with backoff since Tauri plugins may not be ready immediately at startup.
async function loadClipboardWithRetry(attempts = 3, delayMs = 200): Promise<void> {
  const { updateClipboardImage } = useTabStore();
  for (let i = 0; i < attempts; i++) {
    const image = await readClipboardImage();
    if (image) {
      updateClipboardImage(image.url, image.width, image.height);
      return;
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
}
loadClipboardWithRetry();

