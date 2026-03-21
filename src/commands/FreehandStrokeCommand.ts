import type { Command } from "../types/commands"
import type { FreehandStroke } from "../types/freehand"

export function createFreehandStrokeCommand(
  stroke: FreehandStroke,
  strokes: { value: FreehandStroke[] },
  redrawFn: () => void,
): Command {
  return {
    id: stroke.id,
    label:
      stroke.compositeOperation === "destination-out"
        ? "Erase"
        : `Draw ${stroke.color}`,
    layer: "freehand",
    execute() {
      strokes.value = [...strokes.value, stroke]
      redrawFn()
    },
    undo() {
      strokes.value = strokes.value.filter((s) => s.id !== stroke.id)
      redrawFn()
    },
  }
}
