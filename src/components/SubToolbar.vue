<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from "vue"
import { useToolStore } from "../composables/useToolStore"
import { useSelection } from "../composables/useSelection"
import { useTabStore } from "../composables/useTabStore"
import { useAnnotationStore } from "../composables/useAnnotationStore"
import { createSvgMutateCommand } from "../commands/SvgMutateCommand"
import { isFreehandTool, isShapeTool, isLineTool } from "../types/tools"
import type { RedactStyle, RedactStrength, AspectRatioPreset } from "../types/tools"
import type {
  Annotation,
  TextAnnotation,
  RectAnnotation,
  EllipseAnnotation,
  CalloutAnnotation,
} from "../types/annotations"
import { useCopyStats } from "../composables/useCopyStats"
import ColorPicker from "./ColorPicker.vue"
import StrokeWidthSelector from "./StrokeWidthSelector.vue"
import OpacitySlider from "./OpacitySlider.vue"
import FillToggle from "./FillToggle.vue"
import RedactStylePicker from "./RedactStylePicker.vue"
import FontSizeSelector from "./FontSizeSelector.vue"
import CalloutSizeSelector from "./CalloutSizeSelector.vue"
import RedactStrengthSelector from "./RedactStrengthSelector.vue"
import AspectRatioSelector from "./AspectRatioSelector.vue"
import { Check, X } from "lucide-vue-next"
import SupportDialog from "./SupportDialog.vue"

const {
  activeTool,
  settingsVersion,
  getToolSettings,
  updateToolSettings,
  getShapeSettings,
  updateShapeSettings,
  getLineSettings,
  updateLineSettings,
  getCalloutSettings,
  updateCalloutSettings,
  getTextSettings,
  updateTextSettings,
  getRedactSettings,
  updateRedactSettings,
  getCropSettings,
  updateCropSettings,
} = useToolStore()

const { selectedIds } = useSelection()
const { activeTab } = useTabStore()

const annotationStore = computed(() =>
  activeTab.value ? useAnnotationStore(activeTab.value.annotationState) : null,
)

/** The single selected annotation when the select tool is active */
const selectedAnnotation = computed<Annotation | null>(() => {
  if (activeTool.value !== "select" || selectedIds.value.size !== 1) return null
  const id = [...selectedIds.value][0]
  return annotationStore.value?.getAnnotation(id) ?? null
})

/** Shorthand type checks on the selected annotation */
const selType = computed(() => selectedAnnotation.value?.type ?? null)
const selIsShape = computed(() => selType.value === "rect" || selType.value === "ellipse")
const selIsLine = computed(() => selType.value === "arrow" || selType.value === "line")
const selIsCallout = computed(() => selType.value === "callout")
const selIsText = computed(() => selType.value === "text")

const { count: copyCount } = useCopyStats()

const counterDigits = computed(() =>
  String(copyCount.value % 100000).padStart(5, "0").split(""),
)

const showSupport = ref(false)

watch(copyCount, (v) => {
  if (v === 30) showSupport.value = true
})

/** Which parameter sections to show for each tool */
const showColor = computed(() => {
  // Callout uses its own color section (showCalloutColor), not the generic one
  if (selIsCallout.value) return false
  if (selectedAnnotation.value) return true
  const tool = activeTool.value
  return (
    tool === "pen" ||
    tool === "pencil" ||
    tool === "marker" ||
    tool === "arrow" ||
    tool === "line" ||
    tool === "rect" ||
    tool === "ellipse" ||
    tool === "text"
  )
})

const showWidth = computed(() => {
  if (selIsShape.value || selIsLine.value) return true
  const tool = activeTool.value
  return (
    tool === "pen" ||
    tool === "pencil" ||
    tool === "marker" ||
    tool === "eraser" ||
    tool === "arrow" ||
    tool === "line" ||
    tool === "rect" ||
    tool === "ellipse"
  )
})

const showOpacity = computed(() => {
  return activeTool.value === "marker"
})

const showFill = computed(() => {
  if (selIsShape.value) return true
  return isShapeTool(activeTool.value)
})

const showFillColor = computed(() => {
  if (selIsShape.value) {
    const a = selectedAnnotation.value as RectAnnotation | EllipseAnnotation
    return a.fill
  }
  if (!isShapeTool(activeTool.value)) return false
  void settingsVersion.value
  return getShapeSettings(activeTool.value as "rect" | "ellipse").fill
})

const showFillOpacity = computed(() => {
  if (selIsShape.value) {
    const a = selectedAnnotation.value as RectAnnotation | EllipseAnnotation
    return a.fill
  }
  if (!isShapeTool(activeTool.value)) return false
  void settingsVersion.value
  return getShapeSettings(activeTool.value as "rect" | "ellipse").fill
})

const showCalloutColor = computed(() => selIsCallout.value || activeTool.value === "callout")
const showCalloutSize = computed(() => selIsCallout.value || activeTool.value === "callout")
const showFontSize = computed(
  () => activeTool.value === "text" || selIsText.value,
)
const showRedactStyle = computed(() => activeTool.value === "redact")
const showRedactStrength = computed(() => {
  if (activeTool.value !== "redact") return false
  void settingsVersion.value
  return getRedactSettings().style !== "solid"
})

// ── Reactive getters (touch settingsVersion for reactivity) ──

const currentColor = computed(() => {
  void settingsVersion.value
  const sel = selectedAnnotation.value
  if (sel) {
    // Callout uses fillColor as its primary color
    if (sel.type === "callout") return (sel as CalloutAnnotation).fillColor
    return sel.strokeColor
  }
  const tool = activeTool.value
  if (isFreehandTool(tool)) return getToolSettings(tool).color
  if (isShapeTool(tool)) return getShapeSettings(tool).color
  if (isLineTool(tool)) return getLineSettings(tool).color
  if (tool === "text") return getTextSettings().color
  return "#D14D41"
})

const currentWidth = computed(() => {
  void settingsVersion.value
  const sel = selectedAnnotation.value
  if (sel && (selIsShape.value || selIsLine.value)) return sel.strokeWidth
  const tool = activeTool.value
  if (isFreehandTool(tool)) return getToolSettings(tool).width
  if (isShapeTool(tool)) return getShapeSettings(tool).width
  if (isLineTool(tool)) return getLineSettings(tool).width
  return 4
})

const currentOpacity = computed(() => {
  void settingsVersion.value
  if (activeTool.value === "marker") return getToolSettings("marker").opacity
  return 1
})

const currentFill = computed(() => {
  void settingsVersion.value
  if (selIsShape.value) return (selectedAnnotation.value as RectAnnotation | EllipseAnnotation).fill
  const tool = activeTool.value
  if (isShapeTool(tool)) return getShapeSettings(tool).fill
  return false
})

const currentFillColor = computed(() => {
  void settingsVersion.value
  if (selIsShape.value) return (selectedAnnotation.value as RectAnnotation | EllipseAnnotation).fillColor
  const tool = activeTool.value
  if (isShapeTool(tool)) return getShapeSettings(tool).fillColor
  return "#D14D41"
})

const currentFillOpacity = computed(() => {
  void settingsVersion.value
  if (selIsShape.value) return (selectedAnnotation.value as RectAnnotation | EllipseAnnotation).fillOpacity
  const tool = activeTool.value
  if (isShapeTool(tool)) return getShapeSettings(tool).fillOpacity
  return 0.3
})

const currentCalloutColor = computed(() => {
  void settingsVersion.value
  if (selIsCallout.value) return (selectedAnnotation.value as CalloutAnnotation).fillColor
  return getCalloutSettings().fillColor
})

const currentCalloutSize = computed(() => {
  void settingsVersion.value
  if (selIsCallout.value) return (selectedAnnotation.value as CalloutAnnotation).radius
  return getCalloutSettings().radius
})

const currentFontSize = computed(() => {
  void settingsVersion.value
  if (selIsText.value) return (selectedAnnotation.value as TextAnnotation).fontSize
  return getTextSettings().fontSize
})

const currentRedactStyle = computed(() => {
  void settingsVersion.value
  return getRedactSettings().style
})

const currentRedactStrength = computed(() => {
  void settingsVersion.value
  return getRedactSettings().strength
})

// ── Update handlers ──

/** Commit a property change on the selected annotation with undo support */
function commitAnnotationChange(
  field: string,
  before: unknown,
  after: unknown,
): void {
  const sel = selectedAnnotation.value
  if (!sel || !annotationStore.value || !activeTab.value) return
  const cmd = createSvgMutateCommand(
    sel.id,
    { [field]: before } as Partial<Annotation>,
    { [field]: after } as Partial<Annotation>,
    annotationStore.value.updateAnnotation,
  )
  activeTab.value.undoRedo.push(cmd)
}

function onColorChange(color: string): void {
  const sel = selectedAnnotation.value
  if (sel) {
    // Callout uses fillColor as primary color
    if (sel.type === "callout") {
      commitAnnotationChange("fillColor", (sel as CalloutAnnotation).fillColor, color)
    } else {
      commitAnnotationChange("strokeColor", sel.strokeColor, color)
    }
    return
  }
  const tool = activeTool.value
  if (isFreehandTool(tool)) updateToolSettings(tool, { color })
  else if (isShapeTool(tool)) updateShapeSettings(tool, { color })
  else if (isLineTool(tool)) updateLineSettings(tool, { color })
  else if (tool === "text") updateTextSettings({ color })
}

function onWidthChange(width: number): void {
  const sel = selectedAnnotation.value
  if (sel && (selIsShape.value || selIsLine.value)) {
    commitAnnotationChange("strokeWidth", sel.strokeWidth, width)
    return
  }
  const tool = activeTool.value
  if (isFreehandTool(tool)) updateToolSettings(tool, { width })
  else if (isShapeTool(tool)) updateShapeSettings(tool, { width })
  else if (isLineTool(tool)) updateLineSettings(tool, { width })
}

function onOpacityChange(opacity: number): void {
  if (activeTool.value === "marker") updateToolSettings("marker", { opacity })
}

function onFillChange(fill: boolean): void {
  if (selIsShape.value) {
    commitAnnotationChange("fill", (selectedAnnotation.value as RectAnnotation | EllipseAnnotation).fill, fill)
    return
  }
  const tool = activeTool.value
  if (isShapeTool(tool)) updateShapeSettings(tool, { fill })
}

function onFillColorChange(fillColor: string): void {
  if (selIsShape.value) {
    commitAnnotationChange("fillColor", (selectedAnnotation.value as RectAnnotation | EllipseAnnotation).fillColor, fillColor)
    return
  }
  const tool = activeTool.value
  if (isShapeTool(tool)) updateShapeSettings(tool, { fillColor })
}

function onFillOpacityChange(fillOpacity: number): void {
  if (selIsShape.value) {
    commitAnnotationChange("fillOpacity", (selectedAnnotation.value as RectAnnotation | EllipseAnnotation).fillOpacity, fillOpacity)
    return
  }
  const tool = activeTool.value
  if (isShapeTool(tool)) updateShapeSettings(tool, { fillOpacity })
}

function onCalloutColorChange(fillColor: string): void {
  if (selIsCallout.value) {
    commitAnnotationChange("fillColor", (selectedAnnotation.value as CalloutAnnotation).fillColor, fillColor)
    return
  }
  updateCalloutSettings({ fillColor })
}

function onCalloutSizeChange(radius: number): void {
  if (selIsCallout.value) {
    commitAnnotationChange("radius", (selectedAnnotation.value as CalloutAnnotation).radius, radius)
    return
  }
  updateCalloutSettings({ radius })
}

function onFontSizeChange(fontSize: number): void {
  if (selIsText.value) {
    const sel = selectedAnnotation.value as TextAnnotation
    // Minimum height to show one line: fontSize * lineHeight(1.4) + top+bottom padding(4px each)
    const minHeight = Math.ceil(fontSize * 1.4) + 8
    const before: Partial<TextAnnotation> = { fontSize: sel.fontSize }
    const after: Partial<TextAnnotation> = { fontSize }
    if (sel.height < minHeight) {
      before.height = sel.height
      after.height = minHeight
    }
    const cmd = createSvgMutateCommand(
      sel.id,
      before as Partial<Annotation>,
      after as Partial<Annotation>,
      annotationStore.value!.updateAnnotation,
    )
    activeTab.value!.undoRedo.push(cmd)
    return
  }
  updateTextSettings({ fontSize })
}

function onRedactStyleChange(style: RedactStyle): void {
  updateRedactSettings({ style })
}

function onRedactStrengthChange(strength: RedactStrength): void {
  updateRedactSettings({ strength })
}

const showCrop = computed(() => activeTool.value === "crop")

const currentAspectRatio = computed(() => {
  void settingsVersion.value
  return getCropSettings().aspectRatio
})

function onAspectRatioChange(aspectRatio: AspectRatioPreset): void {
  updateCropSettings({ aspectRatio })
}

const cropPending = ref(false)

function onCropPendingChange(e: Event): void {
  cropPending.value = (e as CustomEvent).detail as boolean
}

function onCropApply(): void {
  window.dispatchEvent(new CustomEvent("crop-apply"))
}

function onCropCancel(): void {
  window.dispatchEvent(new CustomEvent("crop-cancel"))
}

onMounted(() => {
  window.addEventListener("crop-pending-change", onCropPendingChange)
})

onUnmounted(() => {
  window.removeEventListener("crop-pending-change", onCropPendingChange)
})
</script>

<template>
  <div
    class="sub-toolbar"
    role="toolbar"
    aria-label="Tool settings"
  >
      <!-- Color -->
      <div v-if="showColor" class="sub-toolbar__section" data-section="color">
        <span class="sub-toolbar__label">Color</span>
        <ColorPicker :model-value="currentColor" @update:model-value="onColorChange" />
      </div>

      <!-- Stroke width -->
      <div v-if="showWidth" class="sub-toolbar__section" data-section="width">
        <span class="sub-toolbar__label">Width</span>
        <StrokeWidthSelector :model-value="currentWidth" @update:model-value="onWidthChange" />
      </div>

      <!-- Opacity (marker) -->
      <div v-if="showOpacity" class="sub-toolbar__section" data-section="opacity">
        <span class="sub-toolbar__label">Opacity</span>
        <OpacitySlider :model-value="currentOpacity" @update:model-value="onOpacityChange" />
      </div>

      <!-- Fill toggle (shapes) -->
      <div v-if="showFill" class="sub-toolbar__section" data-section="fill">
        <FillToggle :model-value="currentFill" @update:model-value="onFillChange" />
      </div>

      <!-- Fill color (shapes, when fill enabled) -->
      <div v-if="showFillColor" class="sub-toolbar__section" data-section="fillColor">
        <span class="sub-toolbar__label">Fill</span>
        <ColorPicker :model-value="currentFillColor" @update:model-value="onFillColorChange" />
      </div>

      <!-- Fill opacity (shapes, when fill enabled) -->
      <div v-if="showFillOpacity" class="sub-toolbar__section" data-section="fillOpacity">
        <span class="sub-toolbar__label">Fill opacity</span>
        <OpacitySlider :model-value="currentFillOpacity" @update:model-value="onFillOpacityChange" />
      </div>

      <!-- Callout fill color -->
      <div v-if="showCalloutColor" class="sub-toolbar__section" data-section="calloutColor">
        <span class="sub-toolbar__label">Color</span>
        <ColorPicker :model-value="currentCalloutColor" @update:model-value="onCalloutColorChange" />
      </div>

      <!-- Callout size -->
      <div v-if="showCalloutSize" class="sub-toolbar__section" data-section="calloutSize">
        <span class="sub-toolbar__label">Size</span>
        <CalloutSizeSelector :model-value="currentCalloutSize" @update:model-value="onCalloutSizeChange" />
      </div>

      <!-- Font size (text) -->
      <div v-if="showFontSize" class="sub-toolbar__section" data-section="fontSize">
        <span class="sub-toolbar__label">Size</span>
        <FontSizeSelector :model-value="currentFontSize" @update:model-value="onFontSizeChange" />
      </div>

      <!-- Redact style -->
      <div v-if="showRedactStyle" class="sub-toolbar__section" data-section="redactStyle">
        <span class="sub-toolbar__label">Style</span>
        <RedactStylePicker :model-value="currentRedactStyle" @update:model-value="onRedactStyleChange" />
      </div>

      <!-- Redact strength (pixelate/blur only) -->
      <div v-if="showRedactStrength" class="sub-toolbar__section" data-section="redactStrength">
        <span class="sub-toolbar__label">Strength</span>
        <RedactStrengthSelector :model-value="currentRedactStrength" @update:model-value="onRedactStrengthChange" />
      </div>

      <!-- Crop aspect ratio -->
      <div v-if="showCrop" class="sub-toolbar__section" data-section="cropRatio">
        <span class="sub-toolbar__label">Ratio</span>
        <AspectRatioSelector
          :model-value="currentAspectRatio"
          @update:model-value="onAspectRatioChange"
        />
      </div>

      <!-- Crop apply/cancel -->
      <div v-if="showCrop && cropPending" class="sub-toolbar__section" data-section="cropActions">
        <button
          class="sub-toolbar__action-btn sub-toolbar__action-btn--apply"
          title="Apply crop (Enter)"
          type="button"
          @click="onCropApply"
        >
          <Check :size="14" />
          <span>Apply</span>
        </button>
        <button
          class="sub-toolbar__action-btn sub-toolbar__action-btn--cancel"
          title="Cancel crop (Esc)"
          type="button"
          @click="onCropCancel"
        >
          <X :size="14" />
          <span>Cancel</span>
        </button>
      </div>

      <!-- Copy/save counter -->
      <div
        class="sub-toolbar__counter"
        title="Copy and save counter — click to support ClipJot!"
        role="button"
        tabindex="0"
        @click="showSupport = true"
        @keydown.enter="showSupport = true"
        @keydown.space.prevent="showSupport = true"
      >
        <span
          v-for="(digit, i) in counterDigits"
          :key="i"
          class="sub-toolbar__counter-digit"
        >{{ digit }}</span>
      </div>
  </div>

  <SupportDialog v-if="showSupport" @close="showSupport = false" />
</template>

<style scoped>
.sub-toolbar {
  flex-shrink: 0;
  height: 36px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  gap: 12px;
  background: var(--surface-app);
  border-bottom: 1px solid var(--border-subtle);
  overflow-x: auto;
  overflow-y: hidden;
}

.sub-toolbar__section {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.sub-toolbar__section + .sub-toolbar__section {
  padding-left: 12px;
  border-left: 1px solid var(--border-subtle);
}

.sub-toolbar__label {
  font-size: 0.7rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  user-select: none;
  white-space: nowrap;
}

.sub-toolbar__action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border-radius: 4px;
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  transition: border-color 0.1s ease, background-color 0.1s ease, color 0.1s ease;
}

.sub-toolbar__action-btn:hover {
  border-color: var(--border-default);
  color: var(--text-primary);
}

.sub-toolbar__action-btn--apply {
  border-color: var(--interactive-default);
  color: var(--interactive-default);
}

.sub-toolbar__action-btn--apply:hover {
  background: var(--interactive-default);
  color: var(--text-inverse);
}

.sub-toolbar__action-btn--cancel:hover {
  border-color: var(--border-default);
}

.sub-toolbar__counter {
  margin-left: auto;
  flex-shrink: 0;
  display: flex;
  border: 1px solid var(--border-default);
  border-radius: 3px;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  transition: border-color 0.15s;
}

.sub-toolbar__counter:hover {
  border-color: var(--interactive-default);
}

.sub-toolbar__counter-digit {
  width: 14px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ui-monospace, monospace;
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
  background: var(--surface-panel);
  border-right: 1px solid var(--border-subtle);
}

.sub-toolbar__counter-digit:last-child {
  border-right: none;
}
</style>
