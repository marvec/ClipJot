<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue"
import type { Ref } from "vue"
import type { CropBounds } from "../types/crop"
import type { Command } from "../types/commands"
import { createCropCommand } from "../commands/CropCommand"

type HandleId =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"

const props = defineProps<{
  imageWidth: number
  imageHeight: number
  screenToImage: (sx: number, sy: number) => { x: number; y: number }
  cropBounds: Ref<CropBounds | null>
  undoRedoPush: (cmd: Command) => void
}>()

/** The pending crop region the user is drawing/adjusting */
const pending = ref<CropBounds | null>(null)

/** Whether a crop region has been confirmed (ready to commit) */
const hasRegion = computed(() => pending.value !== null)

// ── Drag state (non-reactive, no rendering cost) ───────────────────────────

let isDragging = false
let dragType: "draw" | HandleId = "draw"
let dragOriginX = 0
let dragOriginY = 0
/** Snapshot of pending bounds at drag start (for handle resize) */
let dragStartBounds: CropBounds | null = null
/** Cached viewport element for coordinate transforms */
let viewportEl: HTMLElement | null = null
/** Ref to the root element for getBoundingClientRect */
const rootRef = ref<HTMLElement | null>(null)

// ── Coordinate conversion ──────────────────────────────────────────────────

function pointerToImage(e: PointerEvent): { x: number; y: number } | null {
  const rect = viewportEl?.getBoundingClientRect()
  if (!rect) return null
  return props.screenToImage(e.clientX - rect.left, e.clientY - rect.top)
}

// ── Draw: click-and-drag to define crop region ─────────────────────────────

const MIN_DRAG_SIZE = 5

function onPointerDown(e: PointerEvent): void {
  if (e.button !== 0) return

  viewportEl =
    rootRef.value?.closest<HTMLElement>(".canvas-viewport") ?? null

  const pt = pointerToImage(e)
  if (!pt) return

  isDragging = true
  dragType = "draw"
  dragOriginX = pt.x
  dragOriginY = pt.y
  dragStartBounds = null

  // Clear any existing pending region when starting a new draw
  pending.value = null
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent): void {
  if (!isDragging) return

  const pt = pointerToImage(e)
  if (!pt) return

  if (dragType === "draw") {
    const x = Math.max(0, Math.min(pt.x, props.imageWidth))
    const y = Math.max(0, Math.min(pt.y, props.imageHeight))

    const left = Math.min(dragOriginX, x)
    const top = Math.min(dragOriginY, y)
    const right = Math.max(dragOriginX, x)
    const bottom = Math.max(dragOriginY, y)

    pending.value = {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    }
  } else {
    // Handle resize
    resizeWithHandle(dragType, pt)
  }
}

function onPointerUp(_e: PointerEvent): void {
  if (!isDragging) return
  isDragging = false

  // If the draw was too small, discard
  if (
    dragType === "draw" &&
    pending.value &&
    (pending.value.width < MIN_DRAG_SIZE ||
      pending.value.height < MIN_DRAG_SIZE)
  ) {
    pending.value = null
  }
}

// ── Handle resize ──────────────────────────────────────────────────────────

function onHandlePointerDown(e: PointerEvent, handle: HandleId): void {
  if (e.button !== 0) return
  e.stopPropagation()

  viewportEl =
    rootRef.value?.closest<HTMLElement>(".canvas-viewport") ?? null

  const pt = pointerToImage(e)
  if (!pt || !pending.value) return

  isDragging = true
  dragType = handle
  dragOriginX = pt.x
  dragOriginY = pt.y
  dragStartBounds = { ...pending.value }
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function resizeWithHandle(
  handle: HandleId,
  pt: { x: number; y: number },
): void {
  if (!dragStartBounds) return

  const b = { ...dragStartBounds }
  const clampX = Math.max(0, Math.min(pt.x, props.imageWidth))
  const clampY = Math.max(0, Math.min(pt.y, props.imageHeight))

  // Horizontal edges
  if (handle === "w" || handle === "nw" || handle === "sw") {
    const right = b.x + b.width
    const newX = Math.min(clampX, right - MIN_DRAG_SIZE)
    b.width = right - newX
    b.x = newX
  }
  if (handle === "e" || handle === "ne" || handle === "se") {
    const newRight = Math.max(clampX, b.x + MIN_DRAG_SIZE)
    b.width = newRight - b.x
  }

  // Vertical edges
  if (handle === "n" || handle === "nw" || handle === "ne") {
    const bottom = b.y + b.height
    const newY = Math.min(clampY, bottom - MIN_DRAG_SIZE)
    b.height = bottom - newY
    b.y = newY
  }
  if (handle === "s" || handle === "sw" || handle === "se") {
    const newBottom = Math.max(clampY, b.y + MIN_DRAG_SIZE)
    b.height = newBottom - b.y
  }

  pending.value = b
}

// ── Confirm / cancel ───────────────────────────────────────────────────────

function confirmCrop(): void {
  if (!pending.value) return

  const newBounds: CropBounds = {
    x: Math.round(pending.value.x),
    y: Math.round(pending.value.y),
    width: Math.round(pending.value.width),
    height: Math.round(pending.value.height),
  }

  const cmd = createCropCommand(
    props.cropBounds.value,
    newBounds,
    props.cropBounds,
  )
  cmd.execute()
  props.undoRedoPush(cmd)

  pending.value = null
}

function cancelCrop(): void {
  pending.value = null
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === "Enter" && pending.value) {
    e.preventDefault()
    confirmCrop()
  } else if (e.key === "Escape") {
    e.preventDefault()
    cancelCrop()
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown)
})

// ── Handle positions (image-space) ─────────────────────────────────────────

const HANDLE_SIZE = 8

interface HandleDef {
  id: HandleId
  cursor: string
  /** Returns image-space center of the handle */
  cx: (b: CropBounds) => number
  cy: (b: CropBounds) => number
}

const handleDefs: HandleDef[] = [
  { id: "nw", cursor: "nwse-resize", cx: (b) => b.x, cy: (b) => b.y },
  {
    id: "n",
    cursor: "ns-resize",
    cx: (b) => b.x + b.width / 2,
    cy: (b) => b.y,
  },
  {
    id: "ne",
    cursor: "nesw-resize",
    cx: (b) => b.x + b.width,
    cy: (b) => b.y,
  },
  {
    id: "e",
    cursor: "ew-resize",
    cx: (b) => b.x + b.width,
    cy: (b) => b.y + b.height / 2,
  },
  {
    id: "se",
    cursor: "nwse-resize",
    cx: (b) => b.x + b.width,
    cy: (b) => b.y + b.height,
  },
  {
    id: "s",
    cursor: "ns-resize",
    cx: (b) => b.x + b.width / 2,
    cy: (b) => b.y + b.height,
  },
  {
    id: "sw",
    cursor: "nesw-resize",
    cx: (b) => b.x,
    cy: (b) => b.y + b.height,
  },
  {
    id: "w",
    cursor: "ew-resize",
    cx: (b) => b.x,
    cy: (b) => b.y + b.height / 2,
  },
]
</script>

<template>
  <div
    ref="rootRef"
    class="crop-overlay"
    :style="{
      width: props.imageWidth + 'px',
      height: props.imageHeight + 'px',
    }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
  >
    <template v-if="pending">
      <!-- Top dim region -->
      <div
        class="crop-overlay__dim"
        :style="{
          top: 0,
          left: 0,
          width: props.imageWidth + 'px',
          height: pending.y + 'px',
        }"
      />
      <!-- Bottom dim region -->
      <div
        class="crop-overlay__dim"
        :style="{
          top: pending.y + pending.height + 'px',
          left: 0,
          width: props.imageWidth + 'px',
          height:
            props.imageHeight - pending.y - pending.height + 'px',
        }"
      />
      <!-- Left dim region -->
      <div
        class="crop-overlay__dim"
        :style="{
          top: pending.y + 'px',
          left: 0,
          width: pending.x + 'px',
          height: pending.height + 'px',
        }"
      />
      <!-- Right dim region -->
      <div
        class="crop-overlay__dim"
        :style="{
          top: pending.y + 'px',
          left: pending.x + pending.width + 'px',
          width:
            props.imageWidth - pending.x - pending.width + 'px',
          height: pending.height + 'px',
        }"
      />

      <!-- Selection border -->
      <div
        class="crop-overlay__selection"
        :style="{
          top: pending.y + 'px',
          left: pending.x + 'px',
          width: pending.width + 'px',
          height: pending.height + 'px',
        }"
      />

      <!-- Resize handles -->
      <div
        v-for="h in handleDefs"
        :key="h.id"
        class="crop-overlay__handle"
        :style="{
          left: h.cx(pending) - HANDLE_SIZE / 2 + 'px',
          top: h.cy(pending) - HANDLE_SIZE / 2 + 'px',
          width: HANDLE_SIZE + 'px',
          height: HANDLE_SIZE + 'px',
          cursor: h.cursor,
        }"
        @pointerdown="(e: PointerEvent) => onHandlePointerDown(e, h.id)"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
      />

      <!-- Confirm button centered in selection -->
      <button
        class="crop-overlay__btn"
        :style="{
          top: pending.y + pending.height / 2 + 'px',
          left: pending.x + pending.width / 2 + 'px',
        }"
        @click.stop="confirmCrop"
      >
        Crop
      </button>
    </template>
  </div>
</template>

<style scoped>
.crop-overlay {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 20;
  touch-action: none;
  cursor: crosshair;
}

.crop-overlay__dim {
  position: absolute;
  background: var(--overlay-dim);
  pointer-events: none;
}

.crop-overlay__selection {
  position: absolute;
  border: 2px dashed var(--border-accent);
  pointer-events: none;
  box-sizing: border-box;
}

.crop-overlay__handle {
  position: absolute;
  background: var(--interactive-default);
  border: 1px solid var(--text-inverse);
  border-radius: 2px;
  pointer-events: auto;
  z-index: 21;
}

.crop-overlay__btn {
  position: absolute;
  transform: translate(-50%, -50%);
  padding: 8px 20px;
  background: var(--interactive-default);
  color: var(--text-inverse);
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: var(--shadow-md);
  transition: background 0.15s;
}

.crop-overlay__btn:hover {
  background: var(--interactive-hover);
}
</style>
