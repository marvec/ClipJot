import { ref, computed } from "vue"
import type { ComputedRef, InjectionKey, Ref } from "vue"

export interface ViewportContext {
  /** Current zoom scale (1.0 = 100%) */
  scale: Ref<number>
  /** Pan offset X in screen pixels */
  panX: Ref<number>
  /** Pan offset Y in screen pixels */
  panY: Ref<number>
  /** Image dimensions */
  imageWidth: Ref<number>
  imageHeight: Ref<number>
  /** Convert screen coordinates to image-space coordinates */
  screenToImage: (screenX: number, screenY: number) => { x: number; y: number }
  /** Convert image coordinates to screen-space coordinates */
  imageToScreen: (imageX: number, imageY: number) => { x: number; y: number }
  /** Set zoom level (clamped to range) */
  setZoom: (newScale: number) => void
  /** Fit the image to the viewport */
  fitToWindow: (viewportWidth: number, viewportHeight: number) => void
  /** CSS transform string for the layer container */
  transformStyle: ComputedRef<string>
}

export const VIEWPORT_KEY: InjectionKey<ViewportContext> =
  Symbol("viewport-context")

const MIN_ZOOM = 0.05
const MAX_ZOOM = 8.0

/**
 * Creates a viewport context for a tab.
 * Manages zoom/pan state and coordinate transforms.
 *
 * CSS transform order: translate(panX, panY) scale(scale)
 * with transform-origin: 0 0 (scale first around top-left, then translate).
 */
export function createViewportContext(
  imageWidth: Ref<number>,
  imageHeight: Ref<number>,
): ViewportContext {
  const scale = ref(1)
  const panX = ref(0)
  const panY = ref(0)

  function screenToImage(
    screenX: number,
    screenY: number,
  ): { x: number; y: number } {
    // Inverse of: screen = image * scale + pan
    return {
      x: (screenX - panX.value) / scale.value,
      y: (screenY - panY.value) / scale.value,
    }
  }

  function imageToScreen(
    imageX: number,
    imageY: number,
  ): { x: number; y: number } {
    return {
      x: imageX * scale.value + panX.value,
      y: imageY * scale.value + panY.value,
    }
  }

  function setZoom(newScale: number): void {
    scale.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale))
  }

  function fitToWindow(
    viewportWidth: number,
    viewportHeight: number,
  ): void {
    if (imageWidth.value === 0 || imageHeight.value === 0) {
      scale.value = 1
      panX.value = 0
      panY.value = 0
      return
    }

    const scaleX = viewportWidth / imageWidth.value
    const scaleY = viewportHeight / imageHeight.value
    // Never zoom above 100% for fit-to-window
    const fitScale = Math.min(scaleX, scaleY, 1)

    setZoom(fitScale)

    // Center the image in the viewport
    const scaledWidth = imageWidth.value * fitScale
    const scaledHeight = imageHeight.value * fitScale
    panX.value = (viewportWidth - scaledWidth) / 2
    panY.value = (viewportHeight - scaledHeight) / 2
  }

  const transformStyle = computed(
    () =>
      `translate(${panX.value}px, ${panY.value}px) scale(${scale.value})`,
  )

  return {
    scale,
    panX,
    panY,
    imageWidth,
    imageHeight,
    screenToImage,
    imageToScreen,
    setZoom,
    fitToWindow,
    transformStyle,
  }
}
