<script setup lang="ts">
import { onMounted, onUnmounted } from "vue"
import { useSettings } from "../composables/useSettings"
import type { ThemeSetting } from "../composables/useSettings"

const emit = defineEmits<{
  close: []
}>()

const {
  theme,
  autoCopyOnClose,
  tabNamePattern,
  hotkey,
  zoomSensitivity,
  autostart,
  setTheme,
  setAutoCopyOnClose,
  setTabNamePattern,
  setZoomSensitivity,
  setAutostart,
} = useSettings()

function handleThemeChange(event: Event): void {
  const target = event.target as HTMLSelectElement
  setTheme(target.value as ThemeSetting)
}

function handleTabNamePattern(event: Event): void {
  const target = event.target as HTMLInputElement
  setTabNamePattern(target.value)
}

function handleZoomSensitivity(event: Event): void {
  const target = event.target as HTMLInputElement
  setZoomSensitivity(Number(target.value))
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    emit("close")
  }
}

onMounted(() => {
  document.addEventListener("keydown", onKeydown)
})

onUnmounted(() => {
  document.removeEventListener("keydown", onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="settings-backdrop" @click.self="emit('close')">
      <div
        class="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div class="settings-dialog__header">
          <h2 id="settings-title" class="settings-dialog__title">Settings</h2>
          <button
            class="settings-dialog__close"
            aria-label="Close settings"
            @click="emit('close')"
          >
            &times;
          </button>
        </div>

        <!-- Display Section -->
        <section class="settings-section">
          <h3 class="settings-section__heading">Display</h3>

          <label class="settings-field">
            <span class="settings-field__label">Theme</span>
            <select
              class="settings-field__select"
              :value="theme"
              @change="handleThemeChange"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </label>

          <label class="settings-field">
            <span class="settings-field__label"
              >Zoom sensitivity ({{ zoomSensitivity }})</span
            >
            <input
              type="range"
              class="settings-field__slider"
              min="1"
              max="5"
              :value="zoomSensitivity"
              @input="handleZoomSensitivity"
            />
          </label>
        </section>

        <!-- Behavior Section -->
        <section class="settings-section">
          <h3 class="settings-section__heading">Behavior</h3>

          <label class="settings-field settings-field--toggle">
            <span class="settings-field__label">Auto-copy on close</span>
            <input
              type="checkbox"
              class="settings-field__checkbox"
              :checked="autoCopyOnClose"
              @change="setAutoCopyOnClose(!autoCopyOnClose)"
            />
          </label>

        </section>

        <!-- Advanced Section -->
        <section class="settings-section">
          <h3 class="settings-section__heading">Advanced</h3>

          <label class="settings-field">
            <span class="settings-field__label">Tab name pattern</span>
            <input
              type="text"
              class="settings-field__input"
              :value="tabNamePattern"
              @input="handleTabNamePattern"
            />
          </label>
        </section>

        <!-- System Section -->
        <section class="settings-section">
          <h3 class="settings-section__heading">System</h3>

          <div class="settings-field">
            <span class="settings-field__label">Global hotkey</span>
            <span class="settings-field__value">{{ hotkey }}</span>
          </div>

          <label class="settings-field settings-field--toggle">
            <span class="settings-field__label">Launch at login</span>
            <input
              type="checkbox"
              class="settings-field__checkbox"
              :checked="autostart"
              @change="setAutostart(!autostart)"
            />
          </label>
        </section>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.settings-backdrop {
  position: fixed;
  inset: 0;
  background: var(--overlay-backdrop);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.settings-dialog {
  background: var(--surface-elevated);
  border-radius: 12px;
  padding: 0;
  max-width: 480px;
  width: 90%;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
}

.settings-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 12px;
  border-bottom: 1px solid var(--border-subtle);
}

.settings-dialog__title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.settings-dialog__close {
  appearance: none;
  background: none;
  border: none;
  font-size: 24px;
  line-height: 1;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.15s;
}

.settings-dialog__close:hover {
  background: var(--surface-panel);
  color: var(--text-primary);
}

.settings-section {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-subtle);
}

.settings-section:last-child {
  border-bottom: none;
}

.settings-section__heading {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  margin: 0 0 12px;
}

.settings-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.settings-field:last-child {
  margin-bottom: 0;
}

.settings-field__label {
  font-size: 14px;
  color: var(--text-primary);
  flex-shrink: 0;
}

.settings-field__select {
  appearance: none;
  background: var(--surface-panel);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  padding: 6px 28px 6px 10px;
  font-size: 14px;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M3 5l3 3 3-3'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
}

.settings-field__select:focus {
  outline: 2px solid var(--interactive-default);
  outline-offset: 1px;
}

.settings-field__input {
  background: var(--surface-panel);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 14px;
  font-family: monospace;
  width: 140px;
}

.settings-field__input:focus {
  outline: 2px solid var(--interactive-default);
  outline-offset: 1px;
}

.settings-field__slider {
  flex: 1;
  max-width: 200px;
  accent-color: var(--interactive-default);
}

.settings-field__checkbox {
  width: 18px;
  height: 18px;
  accent-color: var(--interactive-default);
  cursor: pointer;
}

.settings-field__value {
  font-size: 13px;
  font-family: monospace;
  color: var(--text-secondary);
  background: var(--surface-panel);
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-subtle);
}
</style>
