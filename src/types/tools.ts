export type ToolId =
  | "select"
  | "pen"
  | "pencil"
  | "marker"
  | "eraser"
  | "arrow"
  | "line"
  | "rect"
  | "ellipse"
  | "callout"
  | "text"
  | "redact"
  | "crop"

export type FreehandToolId = "pen" | "pencil" | "marker" | "eraser"

export function isFreehandTool(tool: ToolId): tool is FreehandToolId {
  return (
    tool === "pen" ||
    tool === "pencil" ||
    tool === "marker" ||
    tool === "eraser"
  )
}
