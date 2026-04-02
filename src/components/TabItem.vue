<script setup lang="ts">
import { ref } from "vue"
import type { Tab } from "../types/tab"
import TabNameEditor from "./TabNameEditor.vue"

const props = defineProps<{
  tab: Tab
  isActive: boolean
}>()

const emit = defineEmits<{
  select: [tabId: string]
  close: [tabId: string]
  rename: [tabId: string, newName: string]
}>()

const isRenaming = ref(false)

function handleDoubleClick(): void {
  if (props.tab.type === "clipboard") return
  isRenaming.value = true
}

function handleRenameConfirm(newName: string): void {
  isRenaming.value = false
  emit("rename", props.tab.id, newName)
}

function handleRenameCancel(): void {
  isRenaming.value = false
}

function handleClose(e: MouseEvent): void {
  e.stopPropagation()
  emit("close", props.tab.id)
}
</script>

<template>
  <button
    class="tab-item"
    :class="{
      'tab-item--active': isActive,
      'tab-item--clipboard': tab.type === 'clipboard',
      'tab-item--copied': tab.copiedSinceLastEdit,
      'tab-item--editing': tab.type === 'editing',
    }"
    @click="emit('select', tab.id)"
    @dblclick="handleDoubleClick"
  >
    <TabNameEditor
      v-if="isRenaming"
      :current-name="tab.name"
      @confirm="handleRenameConfirm"
      @cancel="handleRenameCancel"
    />
    <span v-else class="tab-item__name">{{ tab.name }}</span>
    <span
      v-if="tab.copiedSinceLastEdit && tab.type !== 'clipboard'"
      class="tab-item__badge"
    />
    <span
      v-if="tab.type === 'editing'"
      class="tab-item__close"
      role="button"
      aria-label="Close tab"
      @click="handleClose"
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </span>
  </button>
</template>

<style scoped>
.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--tab-default);
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background 0.15s,
    color 0.15s;
}

.tab-item:hover {
  background: var(--surface-elevated);
}

.tab-item--active {
  color: var(--text-primary);
  background: var(--tab-active);
  border-bottom-color: var(--interactive-default);
}

.tab-item--clipboard {
  font-weight: 600;
}

.tab-item--clipboard.tab-item--active {
  border-bottom-color: var(--tab-clipboard);
}

.tab-item__name {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

.tab-item__badge {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--tab-copied);
  flex-shrink: 0;
}

.tab-item__close {
  display: none;
  align-items: center;
  justify-content: center;
  margin-left: 2px;
  color: var(--text-secondary);
  border-radius: 3px;
  padding: 2px;
  flex-shrink: 0;
}

.tab-item__close:hover {
  color: var(--text-primary);
  background: var(--surface-panel);
}

.tab-item--editing:hover .tab-item__close,
.tab-item--editing.tab-item--active .tab-item__close {
  display: inline-flex;
}
</style>
