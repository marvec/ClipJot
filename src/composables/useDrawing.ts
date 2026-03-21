import { shallowRef } from "vue"
import type { ShallowRef } from "vue"
import { getStroke } from "perfect-freehand"
import type { StrokeOptions } from "perfect-freehand"
import type { FreehandStroke, FreehandCheckpoint } from "../types/freehand"
import { CHECKPOINT_INTERVAL } from "../types/freehand"

/**
 * Convert perfect-freehand outline points to SVG path data for Path2D.
 * Uses quadratic bezier curves for smooth stroke edges.
 */
export function getSvgPathFromStroke(points: number[][]): string {
  if (points.length < 4) return ""

  const avg = (a: number, b: number): number => (a + b) / 2

  let d = `M ${points[0][0]} ${points[0][1]}`
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]
    const [x1, y1] = points[i]
    d += ` Q ${x0} ${y0} ${avg(x0, x1)} ${avg(y0, y1)}`
  }
  d += " Z"

  return d
}

/**
 * Get or create a cached Path2D for a stroke.
 * Computes getStroke + Path2D on first call, caches on stroke object (B3).
 */
function getOrCreatePath(stroke: FreehandStroke): Path2D | null {
  if (!stroke.cachedPath) {
    const outline = getStroke(stroke.points, stroke.options)
    if (outline.length < 4) return null
    stroke.cachedPath = new Path2D(getSvgPathFromStroke(outline))
  }
  return stroke.cachedPath
}

/** Render a single stroke onto a canvas context. */
function renderStroke(
  ctx: CanvasRenderingContext2D,
  stroke: FreehandStroke,
): void {
  const path = getOrCreatePath(stroke)
  if (!path) return

  ctx.save()
  ctx.globalAlpha = stroke.opacity
  ctx.globalCompositeOperation = stroke.compositeOperation
  ctx.fillStyle = stroke.color
  ctx.fill(path)
  ctx.restore()
}

export interface DrawingState {
  /** Committed strokes array (shallowRef for reactivity) */
  strokes: ShallowRef<FreehandStroke[]>
  /** Current checkpoint (or null) */
  checkpoint: FreehandCheckpoint | null
  /** Clear canvas and redraw all strokes from checkpoint (B2) */
  redrawAll: (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => void
}

/**
 * Create per-tab drawing state.
 * Manages stroke array, checkpoint, and replay rendering.
 */
export function createDrawingState(): DrawingState {
  const strokes = shallowRef<FreehandStroke[]>([])
  let checkpoint: FreehandCheckpoint | null = null

  function redrawAll(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void {
    ctx.clearRect(0, 0, width, height)

    // Restore from checkpoint if available (B2)
    if (checkpoint) {
      ctx.putImageData(checkpoint.imageData, 0, 0)
    }

    // Replay strokes after checkpoint
    const start = checkpoint?.strokeCount ?? 0
    for (let i = start; i < strokes.value.length; i++) {
      renderStroke(ctx, strokes.value[i])
    }

    // Create checkpoint if needed (every CHECKPOINT_INTERVAL strokes)
    maybeCreateCheckpoint(ctx, width, height)
  }

  function maybeCreateCheckpoint(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void {
    const checkpointIndex = checkpoint?.strokeCount ?? 0
    const strokesSinceCheckpoint = strokes.value.length - checkpointIndex
    if (strokesSinceCheckpoint >= CHECKPOINT_INTERVAL) {
      checkpoint = {
        imageData: ctx.getImageData(0, 0, width, height),
        strokeCount: strokes.value.length,
      }
    }
  }

  const state: DrawingState = {
    strokes,
    get checkpoint() {
      return checkpoint
    },
    set checkpoint(v: FreehandCheckpoint | null) {
      checkpoint = v
    },
    redrawAll,
  }

  return state
}

/** Default stroke options for the pen tool */
export const PEN_DEFAULTS: StrokeOptions & {
  color: string
  opacity: number
} = {
  size: 4,
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
  simulatePressure: true,
  color: "#D14D41",
  opacity: 1,
}
