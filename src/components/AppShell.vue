<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import TabBar from "./TabBar.vue";
import Toolbar from "./Toolbar.vue";
import SubToolbar from "./SubToolbar.vue";
import CanvasViewport from "./CanvasViewport.vue";
import SettingsDialog from "./SettingsDialog.vue";
import { useTabStore } from "../composables/useTabStore";
import { useToast } from "../composables/useToast";
import { readClipboardImage } from "../composables/useClipboard";
import { copyTabToClipboard, saveTabToFile } from "../composables/useExport";
import { useMenuEvents } from "../composables/useMenuEvents";

const { activeTab, updateClipboardImage, markTabCopied, duplicateActiveTab } =
  useTabStore();
const { success, error } = useToast();

const showSettings = ref(false);

const canUndo = computed(() => activeTab.value?.undoRedo.canUndo.value ?? false);
const canRedo = computed(() => activeTab.value?.undoRedo.canRedo.value ?? false);

function toggleSettings(): void {
  showSettings.value = !showSettings.value;
}

// --- Menu events from native menu bar ---
let unlistenMenu: (() => void) | null = null;

function handleOpenSettings(): void {
  window.removeEventListener("open-settings", handleOpenSettings);
  toggleSettings();
  window.addEventListener("open-settings", handleOpenSettings);
}

onMounted(async () => {
  window.addEventListener("open-settings", handleOpenSettings);
  unlistenMenu = await useMenuEvents({
    onUndo: handleUndo,
    onRedo: handleRedo,
    onCopy: handleCopy,
    onSave: handleSave,
    onDelete: () => {},
    onCloseTab: () => {},
    onZoomIn: () => {},
    onZoomOut: () => {},
    onFitToWindow: () => {},
    onSettings: toggleSettings,
  });
});

onUnmounted(() => {
  window.removeEventListener("open-settings", handleOpenSettings);
  unlistenMenu?.();
});

async function handleCopy(): Promise<void> {
  const tab = activeTab.value;
  if (!tab?.imageUrl) {
    error("Nothing to copy");
    return;
  }
  try {
    await copyTabToClipboard(tab);
    markTabCopied(tab.id);
    success("Copied to clipboard");
  } catch (e) {
    error("Copy failed");
  }
}

async function handleSave(): Promise<void> {
  const tab = activeTab.value;
  if (!tab?.imageUrl) return;
  try {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const defaultName = `${tab.name.replace(/[/:]/g, "-")}.png`;
    const path = await save({
      defaultPath: defaultName,
      filters: [{ name: "PNG Image", extensions: ["png"] }],
    });
    if (path) {
      await saveTabToFile(tab, path);
      success("Saved");
    }
  } catch (e) {
    console.error("[ClipJot] Save failed:", e);
    error("Save failed");
  }
}

function handleUndo(): void {
  activeTab.value?.undoRedo.undo();
}

function handleRedo(): void {
  activeTab.value?.undoRedo.redo();
}

async function handleRefresh(): Promise<void> {
  try {
    const image = await readClipboardImage();
    if (image) {
      updateClipboardImage(image.url, image.width, image.height);
      success("Clipboard refreshed");
    } else {
      error("No image in clipboard");
    }
  } catch (e) {
    error("Failed to read clipboard");
  }
}

function handleDuplicate(): void {
  duplicateActiveTab();
}
</script>

<template>
  <div class="app-shell">
    <TabBar />
    <Toolbar
      :can-undo="canUndo"
      :can-redo="canRedo"
      @copy="handleCopy"
      @save="handleSave"
      @undo="handleUndo"
      @redo="handleRedo"
      @refresh="handleRefresh"
      @duplicate="handleDuplicate"
      @settings="toggleSettings"
    />
    <SubToolbar />
    <CanvasViewport />
    <SettingsDialog v-if="showSettings" @close="showSettings = false" />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: var(--surface-app);
  color: var(--text-primary);
}
</style>
