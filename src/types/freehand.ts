import type { StrokeOptions } from "perfect-freehand"

export interface FreehandStroke {
  /** Unique stroke ID */
  id: string
  /** Array of points: [x, y, pressure] */
  points: [number, number, number][]
  /** perfect-freehand options */
  options: StrokeOptions
  /** Stroke color (hex) */
  color: string
  /** Stroke opacity (0-1) */
  opacity: number
  /** Canvas composite operation */
  compositeOperation: GlobalCompositeOperation
  /** Cached Path2D — computed once, reused on replay */
  cachedPath?: Path2D
}

export interface FreehandCheckpoint {
  /** ImageData snapshot of all committed strokes up to strokeCount */
  imageData: ImageData
  /** Number of strokes baked into this checkpoint */
  strokeCount: number
}

/** Interval for creating intermediate checkpoints */
export const CHECKPOINT_INTERVAL = 10
