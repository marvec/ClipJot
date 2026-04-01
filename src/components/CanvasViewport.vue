<script setup lang="ts">
import { computed, nextTick, ref, watch, onMounted, onUnmounted } from "vue"
import { useTabStore } from "../composables/useTabStore"
import { useAnnotationStore } from "../composables/useAnnotationStore"
import { useTextEditing } from "../composables/useTextEditing"
import { useToolStore } from "../composables/useToolStore"
import { useSelection } from "../composables/useSelection"
import { useRedactionStore } from "../composables/useRedaction"
import { createViewportContext } from "../composables/useZoom"
import { useSettings } from "../composables/useSettings"
import { createSvgMutateCommand } from "../commands/SvgMutateCommand"
import { createSvgCreateCommand } from "../commands/SvgCreateCommand"
import { createRedactionCreateCommand } from "../commands/RedactionCreateCommand"
import { createCropCommand } from "../commands/CropCommand"
import {
  isFreehandTool,
  isShapeTool,
  isLineTool,
} from "../types/tools"
import type {
  TextAnnotation,
  ArrowAnnotation,
  LineAnnotation,
  CalloutAnnotation,
  Annotation,
} from "../types/annotations"
import type { CropBounds } from "../types/crop"
import type { AspectRatioPreset } from "../types/tools"
import type { RedactionRegion } from "../types/redaction"
import {
  SOLID_DEFAULT_COLOR,
  blockSizeForStrength,
  blurRadiusForStrength,
} from "../types/redaction"
import EmptyClipboard from "./EmptyClipboard.vue"
import RedactionCanvas from "./RedactionCanvas.vue"
import FreehandCanvas from "./FreehandCanvas.vue"
import SvgAnnotationLayer from "./SvgAnnotationLayer.vue"
import TextEditor from "./TextEditor.vue"
import CropOverlay from "./CropOverlay.vue"
import ContextualPanel from "./ContextualPanel.vue"

const { activeTab, promoteClipboardTab } = useTabStore()

const hasImage = computed(() => activeTab.value?.imageUrl != null)

// Ref to FreehandCanvas component — used to pass its canvas element to RedactionCanvas
const freehandCanvasRef = ref<InstanceType<typeof FreehandCanvas> | null>(null)
const freehandCanvasEl = computed(() => freehandCanvasRef.value?.canvasRef ?? null)

// Ref to RedactionCanvas — re-render when freehand strokes change
const redactionCanvasRef = ref<InstanceType<typeof RedactionCanvas> | null>(null)

const annotationStore = computed(() =>
  activeTab.value ? useAnnotationStore(activeTab.value.annotationState) : null,
)

// ── Text editing state ─────────────────────────────────────────────────────

const { editingAnnotationId, startEditing, commitEdit, cancelEdit } =
  useTextEditing()

const editingTextAnnotation = computed<TextAnnotation | null>(() => {
  if (!editingAnnotationId.value || !annotationStore.value) return null
  const ann = annotationStore.value.getAnnotation(editingAnnotationId.value)
  return ann?.type === "text" ? (ann as TextAnnotation) : null
})

function onStartTextEditing(id: string): void {
  if (!annotationStore.value) return
  const ann = annotationStore.value.getAnnotation(id)
  if (ann?.type === "text") {
    startEditing(id, (ann as TextAnnotation).htmlContent)
  }
}

function onTextCommit(
  annotationId: string,
  newHtml: string,
  width: number,
  height: number,
): void {
  if (!annotationStore.value || !activeTab.value) return
  const session = commitEdit()
  if (!session) return

  const ann = annotationStore.value.getAnnotation(annotationId)
  const prevWidth = ann?.type === "text" ? ann.width : 200
  const prevHeight = ann?.type === "text" ? ann.height : 40

  const cmd = createSvgMutateCommand(
    annotationId,
    { htmlContent: session.previousHtml, width: prevWidth, height: prevHeight },
    { htmlContent: newHtml, width, height },
    annotationStore.value.updateAnnotation,
  )
  cmd.execute()
  activeTab.value.undoRedo.push(cmd)
}

function onTextCancel(_annotationId: string): void {
  cancelEdit()
}

function onTextResize(
  annotationId: string,
  width: number,
  height: number,
): void {
  if (!annotationStore.value) return
  annotationStore.value.updateAnnotation(annotationId, { width, height })
}

function onTextLockWidth(
  annotationId: string,
  width: number,
  newX?: number,
): void {
  if (!annotationStore.value) return
  const patch: Record<string, unknown> = { fixedWidth: true, width }
  if (newX !== undefined) patch.x = newX
  annotationStore.value.updateAnnotation(annotationId, patch)
}

/** Live annotation update during move/resize drag (no undo) */
function onUpdateAnnotation(annotationId: string, patch: Partial<Annotation>): void {
  if (!annotationStore.value) return
  annotationStore.value.updateAnnotation(annotationId, patch)
}

/** Commit a move/resize with undo support */
function onCommitAnnotationUpdate(
  annotationId: string,
  before: Partial<Annotation>,
  after: Partial<Annotation>,
): void {
  if (!annotationStore.value || !activeTab.value) return
  const cmd = createSvgMutateCommand(
    annotationId,
    before,
    after,
    annotationStore.value.updateAnnotation,
  )
  // The annotation is already in the "after" state from live updates, no execute needed
  activeTab.value.undoRedo.push(cmd)
  promoteIfClipboard()
}

function onTextDelete(annotationId: string): void {
  if (!annotationStore.value) return
  cancelEdit()
  annotationStore.value.removeAnnotation(annotationId)
}

// ── Tool store & selection ──────────────────────────────────────────────────

const {
  activeTool,
  settingsVersion,
  setTool,
  getShapeSettings,
  getLineSettings,
  getCalloutSettings,
  getTextSettings,
  getRedactSettings,
  getCropSettings,
} = useToolStore()
const { select, deselect } = useSelection()

const cropAspectRatio = computed<AspectRatioPreset>(() => {
  void settingsVersion.value
  return getCropSettings().aspectRatio
})

const cropPendingBounds = ref<CropBounds | null>(null)

function onCropConfirm(bounds: CropBounds): void {
  const tab = activeTab.value
  if (!tab) return

  const cmd = createCropCommand(
    tab.cropState.cropBounds.value,
    bounds,
    tab.cropState.cropBounds,
  )
  cmd.execute()
  tab.undoRedo.push(cmd)
  promoteIfClipboard()
  cropPendingBounds.value = null
  setTool("select")
}

function onCropCancel(): void {
  cropPendingBounds.value = null
}

function onCropPendingUpdate(bounds: CropBounds | null): void {
  cropPendingBounds.value = bounds
  window.dispatchEvent(
    new CustomEvent("crop-pending-change", { detail: bounds !== null }),
  )
}

/** Whether the interaction overlay should capture pointer events */
const overlayPointerEvents = computed(() => {
  const tool = activeTool.value
  if (isFreehandTool(tool) || tool === "crop" || tool === "select") return "none"
  return "auto"
})

/** Cursor style for the interaction overlay based on active tool */
const overlayCursor = computed(() => {
  const tool = activeTool.value
  if (tool === "select") return "default"
  if (tool === "text" || tool === "callout") return "text"
  return "crosshair"
})

/** Cursor for the layers div (applies when overlay has pointer-events: none) */
const layersCursor = computed(() => {
  const tool = activeTool.value
  if (tool === "select") return "default"
  return undefined
})

/** Whether the current active tab is a clipboard tab that needs promotion */
function isClipboardTab(): boolean {
  return activeTab.value?.type === "clipboard"
}

/** Promote the clipboard tab after a command has been pushed */
function promoteIfClipboard(): void {
  if (isClipboardTab()) {
    promoteClipboardTab()
  }
}

// ── Interaction layer: shape/line/callout/text/redact/select ────────────────

/** Drag state for shape/line/redact creation */
interface DragState {
  kind: "shape" | "line" | "redact"
  originX: number
  originY: number
  currentX: number
  currentY: number
}
let dragState: DragState | null = null

/** Reactive preview rect for shape/line/redact creation */
const previewRect = ref<{
  x: number
  y: number
  width: number
  height: number
} | null>(null)

/** Reactive preview line for arrow/line creation */
const previewLine = ref<{
  x1: number
  y1: number
  x2: number
  y2: number
} | null>(null)

function onOverlayPointerDown(e: PointerEvent): void {
  if (e.button !== 0) return // Left click only

  const tab = activeTab.value
  if (!tab) return

  const rect = viewportRef.value?.getBoundingClientRect()
  if (!rect) return
  const img = screenToImage(e.clientX - rect.left, e.clientY - rect.top)

  const tool = activeTool.value

  // ── Select tool ──
  if (tool === "select") {
    // For now: deselect on empty-area click (annotations handle their own selection)
    deselect()
    return
  }

  // ── Shape tools (rect, ellipse) ──
  if (isShapeTool(tool)) {
    dragState = {
      kind: "shape",
      originX: img.x,
      originY: img.y,
      currentX: img.x,
      currentY: img.y,
    }
    previewRect.value = { x: img.x, y: img.y, width: 0, height: 0 }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    return
  }

  // ── Line tools (arrow, line) ──
  if (isLineTool(tool)) {
    dragState = {
      kind: "line",
      originX: img.x,
      originY: img.y,
      currentX: img.x,
      currentY: img.y,
    }
    previewLine.value = { x1: img.x, y1: img.y, x2: img.x, y2: img.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    return
  }

  // ── Redact tool ──
  if (tool === "redact") {
    dragState = {
      kind: "redact",
      originX: img.x,
      originY: img.y,
      currentX: img.x,
      currentY: img.y,
    }
    previewRect.value = { x: img.x, y: img.y, width: 0, height: 0 }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    return
  }

  // ── Callout tool (single click) ──
  if (tool === "callout") {
    const store = annotationStore.value
    if (!store) return
    const settings = getCalloutSettings()
    const callout: CalloutAnnotation = {
      id: crypto.randomUUID(),
      type: "callout",
      x: img.x,
      y: img.y,
      rotation: 0,
      strokeColor: settings.fillColor,
      strokeWidth: 0,
      selected: false,
      number: store.getNextCalloutNumber(),
      radius: settings.radius,
      fillColor: settings.fillColor,
    }
    const cmd = createSvgCreateCommand(callout, store.addAnnotation, (id) => {
      store.removeAnnotation(id)
    })
    tab.undoRedo.push(cmd)
    promoteIfClipboard()
    return
  }

  // ── Text tool (single click) ──
  if (tool === "text") {
    // If already editing a text annotation, just finish the current edit
    // (the blur on the editor will commit/delete as appropriate).
    if (editingAnnotationId.value) {
      return
    }

    const store = annotationStore.value
    if (!store) return
    const settings = getTextSettings()
    const text: TextAnnotation = {
      id: crypto.randomUUID(),
      type: "text",
      x: img.x,
      y: img.y,
      width: 200,
      height: 40,
      rotation: 0,
      strokeColor: settings.color,
      strokeWidth: 0,
      selected: false,
      htmlContent: "",
      fontFamily: "sans-serif",
      fontSize: settings.fontSize,
      fill: false,
      fillColor: "#000000",
      fixedWidth: false,
    }
    const cmd = createSvgCreateCommand(text, store.addAnnotation, (id) => {
      store.removeAnnotation(id)
    })
    tab.undoRedo.push(cmd)
    promoteIfClipboard()
    // Start editing the newly created text
    startEditing(text.id, text.htmlContent)
    return
  }
}

function onOverlayPointerMove(e: PointerEvent): void {
  if (!dragState) return

  const rect = viewportRef.value?.getBoundingClientRect()
  if (!rect) return
  const img = screenToImage(e.clientX - rect.left, e.clientY - rect.top)

  dragState.currentX = img.x
  dragState.currentY = img.y

  if (dragState.kind === "shape" || dragState.kind === "redact") {
    let width = Math.abs(img.x - dragState.originX)
    let height = Math.abs(img.y - dragState.originY)

    // Shift constrains to square
    if (e.shiftKey && dragState.kind === "shape") {
      const size = Math.max(width, height)
      width = size
      height = size
    }

    const x =
      img.x >= dragState.originX
        ? dragState.originX
        : dragState.originX - width
    const y =
      img.y >= dragState.originY
        ? dragState.originY
        : dragState.originY - height

    previewRect.value = { x, y, width, height }
  } else if (dragState.kind === "line") {
    previewLine.value = {
      x1: dragState.originX,
      y1: dragState.originY,
      x2: img.x,
      y2: img.y,
    }
  }
}

/** Minimum dimension (px) for a shape/line to be committed */
const MIN_DRAG_SIZE = 5

function onOverlayPointerUp(e: PointerEvent): void {
  if (!dragState) return

  const tab = activeTab.value
  const store = annotationStore.value
  if (!tab || !store) {
    resetDrag()
    return
  }

  if (dragState.kind === "shape") {
    const p = previewRect.value
    if (!p || p.width < MIN_DRAG_SIZE || p.height < MIN_DRAG_SIZE) {
      resetDrag()
      return
    }

    const tool = activeTool.value
    if (!isShapeTool(tool)) {
      resetDrag()
      return
    }

    const settings = getShapeSettings(tool)
    const annotation: Annotation =
      tool === "rect"
        ? {
            id: crypto.randomUUID(),
            type: "rect" as const,
            x: p.x,
            y: p.y,
            width: p.width,
            height: p.height,
            rotation: 0,
            strokeColor: settings.color,
            strokeWidth: settings.width,
            selected: false,
            fill: settings.fill,
            fillColor: settings.fillColor,
            fillOpacity: settings.fillOpacity,
          }
        : {
            id: crypto.randomUUID(),
            type: "ellipse" as const,
            x: p.x,
            y: p.y,
            width: p.width,
            height: p.height,
            rotation: 0,
            strokeColor: settings.color,
            strokeWidth: settings.width,
            selected: false,
            fill: settings.fill,
            fillColor: settings.fillColor,
            fillOpacity: settings.fillOpacity,
          }

    const cmd = createSvgCreateCommand(annotation, store.addAnnotation, (id) => {
      store.removeAnnotation(id)
    })
    tab.undoRedo.push(cmd)
  } else if (dragState.kind === "line") {
    const p = previewLine.value
    if (!p) {
      resetDrag()
      return
    }

    const dx = Math.abs(p.x2 - p.x1)
    const dy = Math.abs(p.y2 - p.y1)
    if (dx < MIN_DRAG_SIZE && dy < MIN_DRAG_SIZE) {
      resetDrag()
      return
    }

    const tool = activeTool.value
    if (!isLineTool(tool)) {
      resetDrag()
      return
    }

    const settings = getLineSettings(tool)

    const annotation: Annotation =
      tool === "arrow"
        ? ({
            id: crypto.randomUUID(),
            type: "arrow" as const,
            x: p.x1,
            y: p.y1,
            endX: p.x2,
            endY: p.y2,
            controlX: 0,
            controlY: 0,
            rotation: 0,
            strokeColor: settings.color,
            strokeWidth: settings.width,
            selected: false,
          } satisfies ArrowAnnotation)
        : ({
            id: crypto.randomUUID(),
            type: "line" as const,
            x: p.x1,
            y: p.y1,
            endX: p.x2,
            endY: p.y2,
            rotation: 0,
            strokeColor: settings.color,
            strokeWidth: settings.width,
            selected: false,
          } satisfies LineAnnotation)

    const cmd = createSvgCreateCommand(annotation, store.addAnnotation, (id) => {
      store.removeAnnotation(id)
    })
    tab.undoRedo.push(cmd)
  } else if (dragState.kind === "redact") {
    const p = previewRect.value
    if (!p || p.width < MIN_DRAG_SIZE || p.height < MIN_DRAG_SIZE) {
      resetDrag()
      return
    }

    const settings = getRedactSettings()
    const redactionStore = useRedactionStore(tab.redactionState)
    const region: RedactionRegion = {
      id: crypto.randomUUID(),
      x: Math.round(p.x),
      y: Math.round(p.y),
      width: Math.round(p.width),
      height: Math.round(p.height),
      style: settings.style,
      solidColor: SOLID_DEFAULT_COLOR,
      blockSize: blockSizeForStrength(settings.strength),
      blurRadius: blurRadiusForStrength(settings.strength),
    }

    const cmd = createRedactionCreateCommand(
      region,
      redactionStore.addRegion,
      (id) => {
        redactionStore.removeRegion(id)
      },
    )
    tab.undoRedo.push(cmd)
  }

  promoteIfClipboard()
  resetDrag()
}

function resetDrag(): void {
  dragState = null
  previewRect.value = null
  previewLine.value = null
}

// ── Viewport zoom/pan context ──────────────────────────────────────────────

/** Active crop bounds for the current tab (null = no crop) */
const activeCropBounds = computed(() => {
  // When crop tool is active, show full image so user can re-crop
  if (activeTool.value === "crop") return null
  return activeTab.value?.cropState.cropBounds.value ?? null
})

/** Effective display width (cropped or full) */
const imageWidth = computed(() => activeCropBounds.value?.width ?? activeTab.value?.imageWidth ?? 0)
/** Effective display height (cropped or full) */
const imageHeight = computed(() => activeCropBounds.value?.height ?? activeTab.value?.imageHeight ?? 0)

const viewport = createViewportContext(imageWidth, imageHeight)

/** Inner content offset to shift crop region to origin */
const cropContentTransform = computed(() => {
  const crop = activeCropBounds.value
  if (!crop) return undefined
  return `translate(${-crop.x}px, ${-crop.y}px)`
})

/** Delegate to viewport context for coordinate transforms.
 *  When crop is active, offset by the crop origin so all layers
 *  receive coordinates in the original image space. */
function screenToImage(
  sx: number,
  sy: number,
): { x: number; y: number } {
  const pt = viewport.screenToImage(sx, sy)
  const crop = activeCropBounds.value
  if (crop) {
    pt.x += crop.x
    pt.y += crop.y
  }
  return pt
}

/** Zoom percentage for the indicator badge */
const zoomPercent = computed(() => Math.round(viewport.scale.value * 100))

// ── Viewport element ref & ResizeObserver ──────────────────────────────────

const viewportRef = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null

/** Whether the initial fit-to-window has been performed */
let initialFitDone = false

function callFitToWindow(): void {
  const el = viewportRef.value
  if (!el || el.clientWidth === 0 || el.clientHeight === 0) return
  viewport.fitToWindow(el.clientWidth, el.clientHeight)
}

onMounted(() => {
  const el = viewportRef.value
  if (!el) return

  // Only auto-fit on the initial layout; ignore subsequent resizes (e.g.
  // sub-toolbar appearing/disappearing) to avoid resetting user zoom.
  resizeObserver = new ResizeObserver(() => {
    if (!initialFitDone) {
      initialFitDone = true
      callFitToWindow()
    }
  })
  resizeObserver.observe(el)

  callFitToWindow()
  initialFitDone = true
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

/** Re-fit when the image finishes loading (natural dimensions now available). */
function onImageLoad(): void {
  nextTick(callFitToWindow)
}

// Re-fit when the active image changes (nextTick ensures DOM layout is settled)
watch(
  () => activeTab.value?.imageUrl,
  () => {
    initialFitDone = false
    void nextTick(callFitToWindow)
  },
)

// Re-render redaction when freehand strokes change (redaction composites freehand)
watch(
  () => activeTab.value?.drawingState.strokes.value,
  () => redactionCanvasRef.value?.renderAll(),
)

// Re-fit when crop bounds change (effective image dimensions change)
watch(activeCropBounds, () => {
  void nextTick(callFitToWindow)
})

// ── Scroll-wheel zoom (Ctrl/Meta + wheel) ──────────────────────────────────

const { zoomSensitivity } = useSettings()

/**
 * Zoom factor per pixel of wheel delta, scaled by sensitivity (1–5).
 * Uses proportional (multiplicative) zoom so behaviour feels consistent
 * at every zoom level and trackpad pinch gestures stay smooth.
 */
const ZOOM_SPEED_BASE = 0.0008

function onWheel(e: WheelEvent): void {
  if (!e.metaKey && !e.ctrlKey) return
  e.preventDefault()

  const rect = viewportRef.value?.getBoundingClientRect()
  if (!rect) return

  // Cursor position relative to viewport element
  const cursorX = e.clientX - rect.left
  const cursorY = e.clientY - rect.top

  // Image point under cursor before zoom
  const imgPt = viewport.screenToImage(cursorX, cursorY)

  // Proportional zoom: multiply current scale by a factor derived from deltaY
  const speed = ZOOM_SPEED_BASE * zoomSensitivity.value
  const factor = Math.pow(2, -e.deltaY * speed)
  const newScale = viewport.scale.value * factor
  viewport.setZoom(newScale)

  // Adjust pan so the same image point stays under the cursor
  viewport.panX.value = cursorX - imgPt.x * viewport.scale.value
  viewport.panY.value = cursorY - imgPt.y * viewport.scale.value
}

// ── Middle-mouse-button pan ────────────────────────────────────────────────

let isPanning = false
let panStartX = 0
let panStartY = 0
let panStartPanX = 0
let panStartPanY = 0

function onPointerDown(e: PointerEvent): void {
  // button 1 = middle mouse
  if (e.button !== 1) return
  e.preventDefault()

  isPanning = true
  panStartX = e.clientX
  panStartY = e.clientY
  panStartPanX = viewport.panX.value
  panStartPanY = viewport.panY.value
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent): void {
  if (!isPanning) return
  viewport.panX.value = panStartPanX + (e.clientX - panStartX)
  viewport.panY.value = panStartPanY + (e.clientY - panStartY)
}

function onPointerUp(e: PointerEvent): void {
  if (!isPanning) return
  isPanning = false
  ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
}
</script>

<template>
  <div
    ref="viewportRef"
    class="canvas-viewport"
    @wheel="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
  >
    <template v-if="hasImage && activeTab">
      <div
        class="canvas-viewport__layers"
        :style="{
          transform: viewport.transformStyle.value,
          width: imageWidth + 'px',
          height: imageHeight + 'px',
          cursor: layersCursor,
          overflow: activeCropBounds ? 'hidden' : undefined,
        }"
      >
        <div
          class="canvas-viewport__crop-content"
          :style="{
            width: activeTab.imageWidth + 'px',
            height: activeTab.imageHeight + 'px',
            transform: cropContentTransform,
          }"
        >
        <img
          :src="activeTab.imageUrl!"
          class="canvas-viewport__base-image"
          alt="Clipboard image"
          draggable="false"
          @load="onImageLoad"
        />
        <!-- Freehand canvas (z:1) — below redaction so redactions cover drawings -->
        <FreehandCanvas
          ref="freehandCanvasRef"
          :drawing-state="activeTab.drawingState"
          :image-width="activeTab.imageWidth"
          :image-height="activeTab.imageHeight"
          :undo-redo-push="(cmd) => activeTab!.undoRedo.push(cmd)"
          :screen-to-image="screenToImage"
        />
        <!-- Redaction canvas (z:3) — above freehand, composites base + drawings -->
        <RedactionCanvas
          ref="redactionCanvasRef"
          :redaction-state="activeTab.redactionState"
          :image-width="activeTab.imageWidth"
          :image-height="activeTab.imageHeight"
          :base-image-url="activeTab.imageUrl!"
          :freehand-canvas="freehandCanvasEl"
        />
        <!-- SVG annotation layer (z:4) -->
        <SvgAnnotationLayer
          v-if="annotationStore"
          :annotations="annotationStore.annotations.value"
          :image-width="activeTab.imageWidth"
          :image-height="activeTab.imageHeight"
          @start-text-editing="onStartTextEditing"
          @resize-text="onTextLockWidth"
          @update-annotation="onUpdateAnnotation"
          @commit-annotation-update="onCommitAnnotationUpdate"
        />

        <!-- Interaction overlay for non-freehand tools (z:4 in layer model) -->
        <div
          class="canvas-viewport__interaction-overlay"
          :style="{
            pointerEvents: overlayPointerEvents,
            cursor: overlayCursor,
          }"
          @pointerdown="onOverlayPointerDown"
          @pointermove="onOverlayPointerMove"
          @pointerup="onOverlayPointerUp"
        />

        <!-- Shape/line creation preview (z:5) -->
        <svg
          v-if="previewRect || previewLine"
          class="canvas-viewport__preview-svg"
          :viewBox="`0 0 ${activeTab.imageWidth} ${activeTab.imageHeight}`"
        >
          <rect
            v-if="previewRect && activeTool === 'rect'"
            :x="previewRect.x"
            :y="previewRect.y"
            :width="previewRect.width"
            :height="previewRect.height"
            fill="none"
            stroke="#D14D41"
            stroke-width="2"
            stroke-dasharray="6 3"
            opacity="0.7"
          />
          <ellipse
            v-if="previewRect && activeTool === 'ellipse'"
            :cx="previewRect.x + previewRect.width / 2"
            :cy="previewRect.y + previewRect.height / 2"
            :rx="previewRect.width / 2"
            :ry="previewRect.height / 2"
            fill="none"
            stroke="#4385BE"
            stroke-width="2"
            stroke-dasharray="6 3"
            opacity="0.7"
          />
          <rect
            v-if="previewRect && activeTool === 'redact'"
            :x="previewRect.x"
            :y="previewRect.y"
            :width="previewRect.width"
            :height="previewRect.height"
            fill="rgba(0,0,0,0.3)"
            stroke="#000"
            stroke-width="1"
            stroke-dasharray="4 2"
          />
          <line
            v-if="previewLine"
            :x1="previewLine.x1"
            :y1="previewLine.y1"
            :x2="previewLine.x2"
            :y2="previewLine.y2"
            stroke="#D14D41"
            stroke-width="2"
            stroke-dasharray="6 3"
            opacity="0.7"
          />
        </svg>

        <!-- Text editor overlay (z:50) above SVG layer -->
        <TextEditor
          v-if="editingTextAnnotation"
          :annotation="editingTextAnnotation"
          :viewport-scale="viewport.scale.value"
          @commit="onTextCommit"
          @cancel="onTextCancel"
          @delete="onTextDelete"
          @resize="onTextResize"
          @lock-width="onTextLockWidth"
        />

        </div><!-- end crop-content -->

        <!-- Crop overlay (z:20) for manual crop tool — outside crop-content so it covers full image -->
        <CropOverlay
          v-if="activeTool === 'crop' && activeTab"
          :image-width="activeTab.imageWidth"
          :image-height="activeTab.imageHeight"
          :screen-to-image="screenToImage"
          :aspect-ratio="cropAspectRatio"
          @confirm="onCropConfirm"
          @cancel="onCropCancel"
          @update:pending="onCropPendingUpdate"
        />
      </div>

      <!-- Contextual property panel (z:30 in layer model) -->
      <ContextualPanel />

      <!-- Zoom indicator badge (click to fit-to-window) -->
      <button
        class="canvas-viewport__zoom-badge"
        aria-live="polite"
        title="Reset zoom to fit window"
        @click="callFitToWindow"
      >
        {{ zoomPercent }}%
      </button>
    </template>
    <template v-else>
      <EmptyClipboard />
    </template>
  </div>
</template>

<style scoped>
.canvas-viewport {
  flex: 1;
  overflow: hidden;
  position: relative;
  background: var(--surface-canvas);
}

.canvas-viewport__layers {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  will-change: transform;
}

.canvas-viewport__crop-content {
  position: relative;
}

.canvas-viewport__base-image {
  display: block;
  width: 100%;
  height: 100%;
  user-select: none;
  -webkit-user-drag: none;
}

.canvas-viewport__interaction-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 5;
  touch-action: none;
  /* cursor is set dynamically via :style binding */
}

.canvas-viewport__preview-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 6;
  pointer-events: none;
  overflow: visible;
}

.canvas-viewport__zoom-badge {
  position: absolute;
  bottom: 8px;
  right: 8px;
  padding: 2px 8px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
  background: var(--surface-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}

.canvas-viewport__zoom-badge:hover {
  background: var(--surface-panel);
  color: var(--text-primary);
}
</style>
