<script setup lang="ts">
import { computed, nextTick, ref, watch, onMounted, onUnmounted } from "vue"
import { useTabStore } from "../composables/useTabStore"
import { useAnnotationStore } from "../composables/useAnnotationStore"
import { useTextEditing } from "../composables/useTextEditing"
import { createViewportContext } from "../composables/useZoom"
import { createSvgMutateCommand } from "../commands/SvgMutateCommand"
import type { TextAnnotation } from "../types/annotations"
import EmptyClipboard from "./EmptyClipboard.vue"
import RedactionCanvas from "./RedactionCanvas.vue"
import FreehandCanvas from "./FreehandCanvas.vue"
import SvgAnnotationLayer from "./SvgAnnotationLayer.vue"
import TextEditor from "./TextEditor.vue"
import ContextualPanel from "./ContextualPanel.vue"

const { activeTab } = useTabStore()

const hasImage = computed(() => activeTab.value?.imageUrl != null)

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

function onTextCommit(annotationId: string, newHtml: string): void {
  if (!annotationStore.value || !activeTab.value) return
  const session = commitEdit()
  if (!session) return

  const cmd = createSvgMutateCommand(
    annotationId,
    { htmlContent: session.previousHtml },
    { htmlContent: newHtml },
    annotationStore.value.updateAnnotation,
  )
  cmd.execute()
  activeTab.value.undoRedo.push(cmd)
}

function onTextCancel(_annotationId: string): void {
  cancelEdit()
}

function onTextDelete(annotationId: string): void {
  if (!annotationStore.value) return
  cancelEdit()
  annotationStore.value.removeAnnotation(annotationId)
}

// ── Viewport zoom/pan context ──────────────────────────────────────────────

const imageWidth = computed(() => activeTab.value?.imageWidth ?? 0)
const imageHeight = computed(() => activeTab.value?.imageHeight ?? 0)

const viewport = createViewportContext(imageWidth, imageHeight)

/** Delegate to viewport context for coordinate transforms */
function screenToImage(
  sx: number,
  sy: number,
): { x: number; y: number } {
  return viewport.screenToImage(sx, sy)
}

/** Zoom percentage for the indicator badge */
const zoomPercent = computed(() => Math.round(viewport.scale.value * 100))

// ── Viewport element ref & ResizeObserver ──────────────────────────────────

const viewportRef = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null

function callFitToWindow(): void {
  const el = viewportRef.value
  if (!el || el.clientWidth === 0 || el.clientHeight === 0) return
  viewport.fitToWindow(el.clientWidth, el.clientHeight)
}

onMounted(() => {
  const el = viewportRef.value
  if (!el) return

  resizeObserver = new ResizeObserver(() => {
    callFitToWindow()
  })
  resizeObserver.observe(el)

  callFitToWindow()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

// Re-fit when the active image changes (nextTick ensures DOM layout is settled)
watch(
  () => activeTab.value?.imageUrl,
  () => void nextTick(callFitToWindow),
)

// ── Scroll-wheel zoom (Ctrl/Meta + wheel) ──────────────────────────────────

const ZOOM_STEP = 0.1

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

  // Calculate new scale
  const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
  const newScale = viewport.scale.value + delta
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
        :style="{ transform: viewport.transformStyle.value }"
      >
        <img
          :src="activeTab.imageUrl!"
          :width="activeTab.imageWidth"
          :height="activeTab.imageHeight"
          class="canvas-viewport__base-image"
          alt="Clipboard image"
          draggable="false"
        />
        <!-- Redaction canvas stacks above base image (z:1 in layer model) -->
        <RedactionCanvas
          :redaction-state="activeTab.redactionState"
          :image-width="activeTab.imageWidth"
          :image-height="activeTab.imageHeight"
          :base-image-url="activeTab.imageUrl!"
        />
        <!-- Freehand canvas stacks above redaction (z:2 in layer model) -->
        <FreehandCanvas
          :drawing-state="activeTab.drawingState"
          :image-width="activeTab.imageWidth"
          :image-height="activeTab.imageHeight"
          :undo-redo-push="(cmd) => activeTab!.undoRedo.push(cmd)"
          :screen-to-image="screenToImage"
        />
        <!-- SVG annotation layer stacks above freehand (z:3 in layer model) -->
        <SvgAnnotationLayer
          v-if="annotationStore"
          :annotations="annotationStore.annotations.value"
          :image-width="activeTab.imageWidth"
          :image-height="activeTab.imageHeight"
          @start-text-editing="onStartTextEditing"
        />

        <!-- Text editor overlay (z:50) above SVG layer -->
        <TextEditor
          v-if="editingTextAnnotation"
          :annotation="editingTextAnnotation"
          @commit="onTextCommit"
          @cancel="onTextCancel"
          @delete="onTextDelete"
        />
      </div>

      <!-- Contextual property panel (z:30 in layer model) -->
      <ContextualPanel />

      <!-- Zoom indicator badge -->
      <div class="canvas-viewport__zoom-badge" aria-live="polite">
        {{ zoomPercent }}%
      </div>
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

.canvas-viewport__base-image {
  display: block;
  user-select: none;
  -webkit-user-drag: none;
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
  pointer-events: none;
  user-select: none;
}
</style>
