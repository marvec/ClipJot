import { createApp } from "vue";
import "./assets/reset.css";
import "./assets/flexoki.css";
import "./assets/tokens.css";
import App from "./App.vue";
import { useGlobalHotkey } from "./composables/useGlobalHotkey";

// Set initial theme from OS preference
if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
  document.documentElement.classList.add("theme-dark");
}

createApp(App).mount("#app");

// Register global hotkey after app is mounted
const { registerHotkey } = useGlobalHotkey();
registerHotkey().then((success) => {
  if (!success) {
    console.warn("Global hotkey registration failed — shortcut may be in use");
  }
});
