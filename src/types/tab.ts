import type { UndoRedoInstance } from "../composables/useUndoRedo"
import type { DrawingState } from "../composables/useDrawing"

export interface Tab {
  /** Unique tab identifier */
  readonly id: string
  /** Display name (timestamp or user-set) */
  name: string
  /** Tab type — clipboard tab is permanent, editing tabs are created on first edit */
  type: "clipboard" | "editing"
  /** Blob URL for the base image, null if no image */
  imageUrl: string | null
  /** Original image width in pixels */
  imageWidth: number
  /** Original image height in pixels */
  imageHeight: number
  /** Whether edits have been copied since last modification */
  copiedSinceLastEdit: boolean
  /** Undo/redo stack for this tab */
  undoRedo: UndoRedoInstance
  /** Per-tab freehand drawing state (strokes, checkpoint, replay) */
  drawingState: DrawingState
}
