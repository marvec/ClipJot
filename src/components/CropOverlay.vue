<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue"
import type { CropBounds } from "../types/crop"
import type { AspectRatioPreset } from "../types/tools"
import { resolveAspectRatio, constrainToRatio } from "../utils/cropRatio"

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
  aspectRatio: AspectRatioPreset
}>()

const emit = defineEmits<{
  confirm: [bounds: CropBounds]
  cancel: []
  "update:pending": [bounds: CropBounds | null]
}>()

/** The pending crop region the user is drawing/adjusting */
const pending = ref<CropBounds | null>(null)

/** Resolved numeric ratio (null = free) */
const numericRatio = computed(() =>
  resolveAspectRatio(props.aspectRatio, props.imageWidth, props.imageHeight),
)

/** Whether edge handles should be shown (disabled under locked ratio) */
const showEdgeHandles = computed(() => numericRatio.value === null)

// Emit pending updates
watch(pending, (val) => {
  emit("update:pending", val ? { ...val } : null)
})

// Re-adjust pending region when aspect ratio changes
watch(numericRatio, (ratio) => {
  if (!pending.value || ratio === null) return
  const b = pending.value
  const centerX = b.x + b.width / 2
  const centerY = b.y + b.height / 2
  const constrained = constrainToRatio(b.width, b.height, ratio)
  const newX = Math.max(0, Math.min(centerX - constrained.width / 2, props.imageWidth - constrained.width))
  const newY = Math.max(0, Math.min(centerY - constrained.height / 2, props.imageHeight - constrained.height))
  pending.value = {
    x: newX,
    y: newY,
    width: constrained.width,
    height: constrained.height,
  }
})

// ── Drag state (non-reactive, no rendering cost) ───────────────────────────

let isDragging = false
let dragType: "draw" | HandleId = "draw"
let dragOriginX = 0
let dragOriginY = 0
let dragStartBounds: CropBounds | null = null
let viewportEl: HTMLElement | null = null
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

    let width = Math.abs(x - dragOriginX)
    let height = Math.abs(y - dragOriginY)

    // Apply aspect ratio constraint
    const ratio = numericRatio.value
    if (ratio !== null) {
      const constrained = constrainToRatio(width, height, ratio)
      width = constrained.width
      height = constrained.height
    }

    const left = x < dragOriginX ? dragOriginX - width : dragOriginX
    const top = y < dragOriginY ? dragOriginY - height : dragOriginY

    // Clamp to image bounds
    const clampedLeft = Math.max(0, Math.min(left, props.imageWidth - width))
    const clampedTop = Math.max(0, Math.min(top, props.imageHeight - height))

    pending.value = {
      x: clampedLeft,
      y: clampedTop,
      width,
      height,
    }
  } else {
    resizeWithHandle(dragType, pt)
  }
}

function onPointerUp(_e: PointerEvent): void {
  if (!isDragging) return
  isDragging = false

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
  const ratio = numericRatio.value

  if (ratio !== null) {
    // Corner handles only — resize proportionally
    const isLeft = handle === "nw" || handle === "sw"
    const isTop = handle === "nw" || handle === "ne"
    const isRight = handle === "ne" || handle === "se"

    if (isRight || isLeft) {
      let newWidth: number
      if (isRight) {
        newWidth = Math.max(MIN_DRAG_SIZE, clampX - b.x)
      } else {
        const right = b.x + b.width
        newWidth = Math.max(MIN_DRAG_SIZE, right - clampX)
      }
      const newHeight = newWidth / ratio

      if (isLeft) b.x = b.x + b.width - newWidth
      if (isTop) b.y = b.y + b.height - newHeight

      b.width = newWidth
      b.height = newHeight
    }
  } else {
    // Free-form resize
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
  }

  pending.value = b
}

// ── Confirm / cancel ───────────────────────────────────────────────────────

function confirmCrop(): void {
  if (!pending.value) return

  const bounds: CropBounds = {
    x: Math.round(pending.value.x),
    y: Math.round(pending.value.y),
    width: Math.round(pending.value.width),
    height: Math.round(pending.value.height),
  }

  emit("confirm", bounds)
  pending.value = null
}

function cancelCrop(): void {
  pending.value = null
  emit("cancel")
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

// Listen for toolbar apply/cancel events
function onCropApply(): void {
  confirmCrop()
}

function onCropCancel(): void {
  cancelCrop()
}

onMounted(() => {
  window.addEventListener("keydown", onKeyDown)
  window.addEventListener("crop-apply", onCropApply)
  window.addEventListener("crop-cancel", onCropCancel)
})

onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown)
  window.removeEventListener("crop-apply", onCropApply)
  window.removeEventListener("crop-cancel", onCropCancel)
})

// ── Handle positions (image-space) ─────────────────────────────────────────

const HANDLE_SIZE = 8

interface HandleDef {
  id: HandleId
  cursor: string
  isEdge: boolean
  cx: (b: CropBounds) => number
  cy: (b: CropBounds) => number
}

const handleDefs: HandleDef[] = [
  { id: "nw", cursor: "nwse-resize", isEdge: false, cx: (b) => b.x, cy: (b) => b.y },
  {
    id: "n",
    cursor: "ns-resize",
    isEdge: true,
    cx: (b) => b.x + b.width / 2,
    cy: (b) => b.y,
  },
  {
    id: "ne",
    cursor: "nesw-resize",
    isEdge: false,
    cx: (b) => b.x + b.width,
    cy: (b) => b.y,
  },
  {
    id: "e",
    cursor: "ew-resize",
    isEdge: true,
    cx: (b) => b.x + b.width,
    cy: (b) => b.y + b.height / 2,
  },
  {
    id: "se",
    cursor: "nwse-resize",
    isEdge: false,
    cx: (b) => b.x + b.width,
    cy: (b) => b.y + b.height,
  },
  {
    id: "s",
    cursor: "ns-resize",
    isEdge: true,
    cx: (b) => b.x + b.width / 2,
    cy: (b) => b.y + b.height,
  },
  {
    id: "sw",
    cursor: "nesw-resize",
    isEdge: false,
    cx: (b) => b.x,
    cy: (b) => b.y + b.height,
  },
  {
    id: "w",
    cursor: "ew-resize",
    isEdge: true,
    cx: (b) => b.x,
    cy: (b) => b.y + b.height / 2,
  },
]

const visibleHandles = computed(() =>
  showEdgeHandles.value
    ? handleDefs
    : handleDefs.filter((h) => !h.isEdge),
)
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
        v-for="h in visibleHandles"
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
</style>
