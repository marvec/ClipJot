<script setup lang="ts">
import type { Component } from "vue";
import type { ToolId } from "../types/tools";
import { useToolStore } from "../composables/useToolStore";
import ToolButton from "./ToolButton.vue";
import ActionButton from "./ActionButton.vue";
import {
  MousePointer2,
  Pen,
  Pencil,
  Highlighter,
  Eraser,
  MoveUpRight,
  Minus,
  Square,
  Circle,
  Hash,
  Type,
  ShieldOff,
  Undo2,
  Redo2,
  Copy,
  Save,
  RefreshCw,
  CopyPlus,
  Settings,
} from "lucide-vue-next";

interface ToolDef {
  id: ToolId;
  icon: Component;
  label: string;
}

const tools: ToolDef[] = [
  { id: "select", icon: MousePointer2, label: "Selection (S)" },
  { id: "pen", icon: Pen, label: "Pen (P)" },
  { id: "pencil", icon: Pencil, label: "Pencil (I)" },
  { id: "marker", icon: Highlighter, label: "Marker (M)" },
  { id: "eraser", icon: Eraser, label: "Eraser (E)" },
  { id: "arrow", icon: MoveUpRight, label: "Arrow (A)" },
  { id: "line", icon: Minus, label: "Line (L)" },
  { id: "rect", icon: Square, label: "Rectangle (R)" },
  { id: "ellipse", icon: Circle, label: "Circle (C)" },
  { id: "callout", icon: Hash, label: "Callout (O)" },
  { id: "text", icon: Type, label: "Text (T)" },
  { id: "redact", icon: ShieldOff, label: "Redact (D)" },
];

defineProps<{
  canUndo?: boolean;
  canRedo?: boolean;
}>();

const { activeTool, setTool } = useToolStore();

const emit = defineEmits<{
  undo: [];
  redo: [];
  copy: [];
  save: [];
  refresh: [];
  duplicate: [];
  settings: [];
}>();

function handleToolSelect(toolId: ToolId): void {
  setTool(toolId);
}
</script>

<template>
  <div class="toolbar" role="toolbar" aria-label="Main toolbar">
    <div class="toolbar__tools" role="group" aria-label="Drawing tools">
      <ToolButton
        v-for="tool in tools"
        :key="tool.id"
        :tool-id="tool.id"
        :icon="tool.icon"
        :label="tool.label"
        :is-active="activeTool === tool.id"
        @select="handleToolSelect"
      />
    </div>

    <div class="toolbar__spacer" />

    <div class="toolbar__actions" role="group" aria-label="Actions">
      <ActionButton
        :icon="Undo2"
        label="Undo (⌘Z)"
        :disabled="!canUndo"
        @click="emit('undo')"
      />
      <ActionButton
        :icon="Redo2"
        label="Redo (⌘⇧Z)"
        :disabled="!canRedo"
        @click="emit('redo')"
      />

      <div class="toolbar__divider" role="separator" />

      <ActionButton
        :icon="Copy"
        label="Copy to clipboard (⌘C)"
        @click="emit('copy')"
      />
      <ActionButton
        :icon="Save"
        label="Save to file (⌘S)"
        @click="emit('save')"
      />

      <div class="toolbar__divider" role="separator" />

      <ActionButton
        :icon="RefreshCw"
        label="Refresh clipboard"
        @click="emit('refresh')"
      />
      <ActionButton
        :icon="CopyPlus"
        label="Duplicate tab (⌘D)"
        @click="emit('duplicate')"
      />

      <div class="toolbar__divider" role="separator" />

      <ActionButton
        :icon="Settings"
        label="Settings (⌘,)"
        @click="emit('settings')"
      />
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  height: 44px;
  padding: 4px 8px;
  background: var(--surface-panel);
  border-bottom: 1px solid var(--border-subtle);
}

.toolbar__tools {
  display: flex;
  align-items: center;
  gap: 2px;
}

.toolbar__spacer {
  flex: 1;
}

.toolbar__actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.toolbar__divider {
  width: 1px;
  height: 20px;
  margin: 0 4px;
  background: var(--border-default);
}
</style>
