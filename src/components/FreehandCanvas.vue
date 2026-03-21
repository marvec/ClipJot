<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue"
import { getStroke } from "perfect-freehand"
import type { FreehandStroke } from "../types/freehand"
import type { Command } from "../types/commands"
import { createFreehandStrokeCommand } from "../commands/FreehandStrokeCommand"
import { useToolStore } from "../composables/useToolStore"
import { isFreehandTool } from "../types/tools"
import { getSvgPathFromStroke, PEN_DEFAULTS } from "../composables/useDrawing"
import type { DrawingState } from "../composables/useDrawing"

const props = defineProps<{
  drawingState: DrawingState
  imageWidth: number
  imageHeight: number
  undoRedoPush: (cmd: Command) => void
  screenToImage: (sx: number, sy: number) => { x: number; y: number }
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let currentPoints: [number, number, number][] = []
let preStrokeSnapshot: ImageData | null = null
let rafId: number | null = null
let isDrawing = false

const { activeTool } = useToolStore()

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return

  // Canvas buffer = image dimensions (B1: no devicePixelRatio multiplication)
  canvas.width = props.imageWidth
  canvas.height = props.imageHeight
  ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (ctx) {
    props.drawingState.redrawAll(ctx, props.imageWidth, props.imageHeight)
  }
})

onUnmounted(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
})

// Re-render when strokes change externally (e.g., undo/redo)
watch(
  () => props.drawingState.strokes.value,
  () => {
    if (ctx && !isDrawing) {
      props.drawingState.redrawAll(ctx, props.imageWidth, props.imageHeight)
    }
  },
)

function onPointerDown(e: PointerEvent): void {
  if (!ctx || !isFreehandTool(activeTool.value)) return
  if (e.button !== 0) return // Left click only

  isDrawing = true

  // Save pre-stroke snapshot for O(1) live rendering (B4)
  preStrokeSnapshot = ctx.getImageData(
    0,
    0,
    props.imageWidth,
    props.imageHeight,
  )

  const { x, y } = props.screenToImage(e.offsetX, e.offsetY)
  currentPoints = [[x, y, e.pressure || 0.5]]

  // Capture pointer for reliable tracking
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent): void {
  if (!isDrawing || !ctx) return

  // Collect coalesced events for smooth strokes (B5)
  const events = e.getCoalescedEvents?.() ?? [e]
  for (const ce of events) {
    const { x, y } = props.screenToImage(ce.offsetX, ce.offsetY)
    currentPoints.push([x, y, ce.pressure || 0.5])
  }

  // Batch render via rAF
  if (rafId === null) {
    rafId = requestAnimationFrame(renderLiveStroke)
  }
}

/** O(1) live stroke preview: restore snapshot + render current stroke only (B4) */
function renderLiveStroke(): void {
  rafId = null
  if (!ctx || !preStrokeSnapshot) return

  // Restore pre-stroke state
  ctx.putImageData(preStrokeSnapshot, 0, 0)

  const outline = getStroke(currentPoints, PEN_DEFAULTS)
  if (outline.length >= 4) {
    const pathData = getSvgPathFromStroke(outline)
    if (pathData) {
      ctx.save()
      ctx.globalAlpha = PEN_DEFAULTS.opacity
      ctx.fillStyle = PEN_DEFAULTS.color
      ctx.fill(new Path2D(pathData))
      ctx.restore()
    }
  }
}

function onPointerUp(_e: PointerEvent): void {
  if (!isDrawing || !ctx) return
  isDrawing = false

  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }

  if (currentPoints.length < 2) {
    // Too short — restore pre-stroke state
    if (preStrokeSnapshot) {
      ctx.putImageData(preStrokeSnapshot, 0, 0)
    }
    currentPoints = []
    preStrokeSnapshot = null
    return
  }

  // Create the completed stroke
  const stroke: FreehandStroke = {
    id: crypto.randomUUID(),
    points: [...currentPoints],
    options: { ...PEN_DEFAULTS },
    color: PEN_DEFAULTS.color,
    opacity: PEN_DEFAULTS.opacity,
    compositeOperation: "source-over",
  }

  // Push to undo stack (which adds to strokes array and redraws)
  const cmd = createFreehandStrokeCommand(
    stroke,
    props.drawingState.strokes,
    () => {
      if (ctx) {
        props.drawingState.redrawAll(ctx, props.imageWidth, props.imageHeight)
      }
    },
  )
  props.undoRedoPush(cmd)

  currentPoints = []
  preStrokeSnapshot = null
}
</script>

<template>
  <canvas
    ref="canvasRef"
    class="freehand-canvas"
    :style="{ width: imageWidth + 'px', height: imageHeight + 'px' }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
  />
</template>

<style scoped>
.freehand-canvas {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: auto;
  touch-action: none;
}
</style>
