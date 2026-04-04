<script setup lang="ts">
import { onMounted, onUnmounted } from "vue"
import { openUrl } from "@tauri-apps/plugin-opener"

const emit = defineEmits<{
  close: []
}>()

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    emit("close")
  }
}

async function handleBuyMeCoffee(): Promise<void> {
  await openUrl("https://www.buymeacoffee.com/marvec")
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
    <div class="support-backdrop" @click.self="emit('close')">
      <div
        class="support-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-title"
      >
        <div class="support-dialog__header">
          <h2 id="support-title" class="support-dialog__title">Enjoying ClipJot?</h2>
          <button
            class="support-dialog__close"
            aria-label="Close"
            @click="emit('close')"
          >
            &times;
          </button>
        </div>

        <div class="support-dialog__body">
          <p class="support-dialog__message">
            ClipJot takes time to maintain and improve. If it's been useful to you,
            consider buying me a coffee — I'll add you to the list of supporters on the website!
          </p>
          <button class="support-dialog__bmc-btn" @click="handleBuyMeCoffee">
            <img
              src="https://cdn.buymeacoffee.com/buttons/bmc-new-btn-logo.svg"
              alt=""
              class="support-dialog__bmc-icon"
            />
            Buy me a coffee
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.support-backdrop {
  position: fixed;
  inset: 0;
  background: var(--overlay-backdrop);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.support-dialog {
  background: var(--surface-elevated);
  border-radius: 12px;
  max-width: 400px;
  width: 90%;
  box-shadow: var(--shadow-lg);
}

.support-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 12px;
  border-bottom: 1px solid var(--border-subtle);
}

.support-dialog__title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.support-dialog__close {
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

.support-dialog__close:hover {
  background: var(--surface-panel);
  color: var(--text-primary);
}

.support-dialog__body {
  padding: 20px 24px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.support-dialog__message {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin: 0;
  text-align: center;
}

.support-dialog__bmc-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #FFDD00;
  color: #000000;
  border: 2px solid #000000;
  border-radius: 8px;
  font-size: 16px;
  font-family: "Cookie", cursive;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.support-dialog__bmc-btn:hover {
  opacity: 0.85;
}

.support-dialog__bmc-icon {
  width: 24px;
  height: 24px;
}
</style>
