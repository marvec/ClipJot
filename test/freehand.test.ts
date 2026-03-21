import { describe, test, expect } from "bun:test"
import { readFileSync, existsSync } from "fs"
import { resolve } from "path"

const srcDir = resolve(__dirname, "../src")
const componentsDir = resolve(srcDir, "components")
const composablesDir = resolve(srcDir, "composables")
const typesDir = resolve(srcDir, "types")
const commandsDir = resolve(srcDir, "commands")

// ─── Freehand Types ──────────────────────────────────────────────────────────

describe("Freehand Types", () => {
  test("freehand.ts defines FreehandStroke interface", () => {
    const content = readFileSync(resolve(typesDir, "freehand.ts"), "utf-8")
    expect(content).toContain("export interface FreehandStroke")
    expect(content).toContain("id: string")
    expect(content).toContain("points: [number, number, number][]")
    expect(content).toContain("options: StrokeOptions")
    expect(content).toContain("color: string")
    expect(content).toContain("opacity: number")
    expect(content).toContain("compositeOperation: GlobalCompositeOperation")
    expect(content).toContain("cachedPath?: Path2D")
  })

  test("freehand.ts defines FreehandCheckpoint interface", () => {
    const content = readFileSync(resolve(typesDir, "freehand.ts"), "utf-8")
    expect(content).toContain("export interface FreehandCheckpoint")
    expect(content).toContain("imageData: ImageData")
    expect(content).toContain("strokeCount: number")
  })

  test("freehand.ts exports CHECKPOINT_INTERVAL = 10", () => {
    const content = readFileSync(resolve(typesDir, "freehand.ts"), "utf-8")
    expect(content).toContain("export const CHECKPOINT_INTERVAL = 10")
  })

  test("freehand.ts imports from perfect-freehand", () => {
    const content = readFileSync(resolve(typesDir, "freehand.ts"), "utf-8")
    expect(content).toContain('import type { StrokeOptions } from "perfect-freehand"')
  })
})

// ─── Tool Types ──────────────────────────────────────────────────────────────

describe("Tool Types", () => {
  test("tools.ts defines ToolId union type", () => {
    const content = readFileSync(resolve(typesDir, "tools.ts"), "utf-8")
    expect(content).toContain("export type ToolId")
    expect(content).toContain('"select"')
    expect(content).toContain('"pen"')
    expect(content).toContain('"pencil"')
    expect(content).toContain('"marker"')
    expect(content).toContain('"eraser"')
    expect(content).toContain('"arrow"')
    expect(content).toContain('"line"')
    expect(content).toContain('"rect"')
    expect(content).toContain('"ellipse"')
    expect(content).toContain('"callout"')
    expect(content).toContain('"text"')
    expect(content).toContain('"redact"')
    expect(content).toContain('"crop"')
  })

  test("tools.ts defines FreehandToolId type", () => {
    const content = readFileSync(resolve(typesDir, "tools.ts"), "utf-8")
    expect(content).toContain("export type FreehandToolId")
    expect(content).toContain('"pen" | "pencil" | "marker" | "eraser"')
  })

  test("tools.ts exports isFreehandTool type guard", () => {
    const content = readFileSync(resolve(typesDir, "tools.ts"), "utf-8")
    expect(content).toContain("export function isFreehandTool")
    expect(content).toContain("tool is FreehandToolId")
  })
})

describe("isFreehandTool runtime behavior", () => {
  test("isFreehandTool returns true for freehand tools", async () => {
    const { isFreehandTool } = await import("../src/types/tools")
    expect(isFreehandTool("pen")).toBe(true)
    expect(isFreehandTool("pencil")).toBe(true)
    expect(isFreehandTool("marker")).toBe(true)
    expect(isFreehandTool("eraser")).toBe(true)
  })

  test("isFreehandTool returns false for non-freehand tools", async () => {
    const { isFreehandTool } = await import("../src/types/tools")
    expect(isFreehandTool("select")).toBe(false)
    expect(isFreehandTool("arrow")).toBe(false)
    expect(isFreehandTool("line")).toBe(false)
    expect(isFreehandTool("rect")).toBe(false)
    expect(isFreehandTool("ellipse")).toBe(false)
    expect(isFreehandTool("callout")).toBe(false)
    expect(isFreehandTool("text")).toBe(false)
    expect(isFreehandTool("redact")).toBe(false)
    expect(isFreehandTool("crop")).toBe(false)
  })
})

// ─── Tool Store ──────────────────────────────────────────────────────────────

describe("Tool Store", () => {
  test("useToolStore.ts exports useToolStore", () => {
    const content = readFileSync(
      resolve(composablesDir, "useToolStore.ts"),
      "utf-8",
    )
    expect(content).toContain("export function useToolStore")
  })

  test("useToolStore.ts defaults activeTool to pen", () => {
    const content = readFileSync(
      resolve(composablesDir, "useToolStore.ts"),
      "utf-8",
    )
    expect(content).toContain('ref<ToolId>("pen")')
  })

  test("useToolStore.ts uses module-level singleton pattern", () => {
    const content = readFileSync(
      resolve(composablesDir, "useToolStore.ts"),
      "utf-8",
    )
    const toolIndex = content.indexOf("const activeTool = ref")
    const functionIndex = content.indexOf("export function useToolStore")
    expect(toolIndex).toBeGreaterThan(-1)
    expect(toolIndex).toBeLessThan(functionIndex)
  })

  test("useToolStore.ts exports setTool function", () => {
    const content = readFileSync(
      resolve(composablesDir, "useToolStore.ts"),
      "utf-8",
    )
    expect(content).toContain("setTool")
    expect(content).toContain("activeTool.value = tool")
  })
})

// ─── Drawing Composable ──────────────────────────────────────────────────────

describe("Drawing Composable", () => {
  test("useDrawing.ts exports createDrawingState", () => {
    const content = readFileSync(
      resolve(composablesDir, "useDrawing.ts"),
      "utf-8",
    )
    expect(content).toContain("export function createDrawingState")
  })

  test("useDrawing.ts exports DrawingState interface", () => {
    const content = readFileSync(
      resolve(composablesDir, "useDrawing.ts"),
      "utf-8",
    )
    expect(content).toContain("export interface DrawingState")
    expect(content).toContain("strokes: ShallowRef<FreehandStroke[]>")
    expect(content).toContain("checkpoint: FreehandCheckpoint | null")
    expect(content).toContain("redrawAll")
  })

  test("useDrawing.ts uses shallowRef for strokes", () => {
    const content = readFileSync(
      resolve(composablesDir, "useDrawing.ts"),
      "utf-8",
    )
    expect(content).toContain("shallowRef<FreehandStroke[]>([])")
  })

  test("useDrawing.ts exports PEN_DEFAULTS with correct values", () => {
    const content = readFileSync(
      resolve(composablesDir, "useDrawing.ts"),
      "utf-8",
    )
    expect(content).toContain("export const PEN_DEFAULTS")
    expect(content).toContain("size: 4")
    expect(content).toContain("thinning: 0.5")
    expect(content).toContain("smoothing: 0.5")
    expect(content).toContain("streamline: 0.5")
    expect(content).toContain("simulatePressure: true")
    expect(content).toContain('#D14D41')
    expect(content).toContain("opacity: 1")
  })

  test("useDrawing.ts exports getSvgPathFromStroke", () => {
    const content = readFileSync(
      resolve(composablesDir, "useDrawing.ts"),
      "utf-8",
    )
    expect(content).toContain("export function getSvgPathFromStroke")
  })

  test("useDrawing.ts implements rolling checkpoints (B2)", () => {
    const content = readFileSync(
      resolve(composablesDir, "useDrawing.ts"),
      "utf-8",
    )
    expect(content).toContain("CHECKPOINT_INTERVAL")
    expect(content).toContain("maybeCreateCheckpoint")
    expect(content).toContain("getImageData")
  })

  test("useDrawing.ts caches Path2D objects (B3)", () => {
    const content = readFileSync(
      resolve(composablesDir, "useDrawing.ts"),
      "utf-8",
    )
    expect(content).toContain("getOrCreatePath")
    expect(content).toContain("stroke.cachedPath")
    expect(content).toContain("new Path2D")
  })

  test("useDrawing.ts imports from perfect-freehand", () => {
    const content = readFileSync(
      resolve(composablesDir, "useDrawing.ts"),
      "utf-8",
    )
    expect(content).toContain('import { getStroke } from "perfect-freehand"')
  })
})

describe("getSvgPathFromStroke runtime behavior", () => {
  test("returns empty string for fewer than 4 points", async () => {
    const { getSvgPathFromStroke } = await import(
      "../src/composables/useDrawing"
    )
    expect(getSvgPathFromStroke([])).toBe("")
    expect(getSvgPathFromStroke([[0, 0]])).toBe("")
    expect(
      getSvgPathFromStroke([
        [0, 0],
        [1, 1],
        [2, 2],
      ]),
    ).toBe("")
  })

  test("returns valid SVG path for 4+ points", async () => {
    const { getSvgPathFromStroke } = await import(
      "../src/composables/useDrawing"
    )
    const points = [
      [0, 0],
      [10, 10],
      [20, 5],
      [30, 15],
    ]
    const path = getSvgPathFromStroke(points)
    expect(path).toMatch(/^M /)
    expect(path).toContain("Q ")
    expect(path).toMatch(/ Z$/)
  })
})

describe("createDrawingState runtime behavior", () => {
  test("returns correct structure", async () => {
    const { createDrawingState } = await import(
      "../src/composables/useDrawing"
    )
    const state = createDrawingState()
    expect(state.strokes).toBeDefined()
    expect(state.strokes.value).toEqual([])
    expect(state.checkpoint).toBeNull()
    expect(typeof state.redrawAll).toBe("function")
  })
})

// ─── FreehandStrokeCommand ───────────────────────────────────────────────────

describe("FreehandStrokeCommand", () => {
  test("FreehandStrokeCommand.ts exists", () => {
    expect(
      existsSync(resolve(commandsDir, "FreehandStrokeCommand.ts")),
    ).toBe(true)
  })

  test("FreehandStrokeCommand.ts exports createFreehandStrokeCommand", () => {
    const content = readFileSync(
      resolve(commandsDir, "FreehandStrokeCommand.ts"),
      "utf-8",
    )
    expect(content).toContain("export function createFreehandStrokeCommand")
  })

  test("FreehandStrokeCommand.ts implements Command interface", () => {
    const content = readFileSync(
      resolve(commandsDir, "FreehandStrokeCommand.ts"),
      "utf-8",
    )
    expect(content).toContain('import type { Command } from "../types/commands"')
    expect(content).toContain("execute()")
    expect(content).toContain("undo()")
    expect(content).toContain('layer: "freehand"')
  })

  test("FreehandStrokeCommand labels eraser strokes correctly", () => {
    const content = readFileSync(
      resolve(commandsDir, "FreehandStrokeCommand.ts"),
      "utf-8",
    )
    expect(content).toContain('"destination-out"')
    expect(content).toContain('"Erase"')
  })
})

describe("createFreehandStrokeCommand runtime behavior", () => {
  test("execute adds stroke, undo removes it", async () => {
    const { createFreehandStrokeCommand } = await import(
      "../src/commands/FreehandStrokeCommand"
    )
    const { shallowRef } = await import("vue")
    const strokes = shallowRef<
      import("../src/types/freehand").FreehandStroke[]
    >([])

    let redraws = 0
    const stroke: import("../src/types/freehand").FreehandStroke = {
      id: "test-id",
      points: [
        [0, 0, 0.5],
        [10, 10, 0.5],
      ],
      options: { size: 4 },
      color: "#D14D41",
      opacity: 1,
      compositeOperation: "source-over",
    }

    const cmd = createFreehandStrokeCommand(stroke, strokes, () => {
      redraws++
    })

    // execute adds stroke
    cmd.execute()
    expect(strokes.value).toHaveLength(1)
    expect(strokes.value[0].id).toBe("test-id")
    expect(redraws).toBe(1)

    // undo removes stroke
    cmd.undo()
    expect(strokes.value).toHaveLength(0)
    expect(redraws).toBe(2)

    // re-execute adds it back
    cmd.execute()
    expect(strokes.value).toHaveLength(1)
    expect(redraws).toBe(3)
  })

  test("command has correct metadata", async () => {
    const { createFreehandStrokeCommand } = await import(
      "../src/commands/FreehandStrokeCommand"
    )
    const { shallowRef } = await import("vue")
    const strokes = shallowRef<
      import("../src/types/freehand").FreehandStroke[]
    >([])

    const stroke: import("../src/types/freehand").FreehandStroke = {
      id: "meta-test",
      points: [[0, 0, 0.5]],
      options: {},
      color: "#FF0000",
      opacity: 1,
      compositeOperation: "source-over",
    }

    const cmd = createFreehandStrokeCommand(stroke, strokes, () => {})
    expect(cmd.id).toBe("meta-test")
    expect(cmd.label).toBe("Draw #FF0000")
    expect(cmd.layer).toBe("freehand")
  })

  test("eraser command labels as Erase", async () => {
    const { createFreehandStrokeCommand } = await import(
      "../src/commands/FreehandStrokeCommand"
    )
    const { shallowRef } = await import("vue")
    const strokes = shallowRef<
      import("../src/types/freehand").FreehandStroke[]
    >([])

    const stroke: import("../src/types/freehand").FreehandStroke = {
      id: "eraser-test",
      points: [[0, 0, 0.5]],
      options: {},
      color: "#000000",
      opacity: 1,
      compositeOperation: "destination-out",
    }

    const cmd = createFreehandStrokeCommand(stroke, strokes, () => {})
    expect(cmd.label).toBe("Erase")
  })
})

// ─── FreehandCanvas Component ────────────────────────────────────────────────

describe("FreehandCanvas Component", () => {
  test("FreehandCanvas.vue exists", () => {
    expect(existsSync(resolve(componentsDir, "FreehandCanvas.vue"))).toBe(true)
  })

  test("FreehandCanvas.vue uses script setup with TypeScript", () => {
    const content = readFileSync(
      resolve(componentsDir, "FreehandCanvas.vue"),
      "utf-8",
    )
    expect(content).toContain('<script setup lang="ts">')
  })

  test("FreehandCanvas.vue accepts correct props", () => {
    const content = readFileSync(
      resolve(componentsDir, "FreehandCanvas.vue"),
      "utf-8",
    )
    expect(content).toContain("drawingState: DrawingState")
    expect(content).toContain("imageWidth: number")
    expect(content).toContain("imageHeight: number")
    expect(content).toContain("undoRedoPush")
    expect(content).toContain("screenToImage")
  })

  test("FreehandCanvas.vue sets canvas buffer to image dimensions (B1)", () => {
    const content = readFileSync(
      resolve(componentsDir, "FreehandCanvas.vue"),
      "utf-8",
    )
    expect(content).toContain("canvas.width = props.imageWidth")
    expect(content).toContain("canvas.height = props.imageHeight")
    // Should NOT multiply by devicePixelRatio in actual code (comments OK)
    expect(content).not.toContain("* devicePixelRatio")
    expect(content).not.toContain("*devicePixelRatio")
  })

  test("FreehandCanvas.vue uses O(1) live stroke rendering (B4)", () => {
    const content = readFileSync(
      resolve(componentsDir, "FreehandCanvas.vue"),
      "utf-8",
    )
    expect(content).toContain("preStrokeSnapshot")
    expect(content).toContain("putImageData(preStrokeSnapshot")
    expect(content).toContain("getImageData")
  })

  test("FreehandCanvas.vue uses getCoalescedEvents (B5)", () => {
    const content = readFileSync(
      resolve(componentsDir, "FreehandCanvas.vue"),
      "utf-8",
    )
    expect(content).toContain("getCoalescedEvents")
  })

  test("FreehandCanvas.vue batches rendering via requestAnimationFrame", () => {
    const content = readFileSync(
      resolve(componentsDir, "FreehandCanvas.vue"),
      "utf-8",
    )
    expect(content).toContain("requestAnimationFrame")
    expect(content).toContain("cancelAnimationFrame")
  })

  test("FreehandCanvas.vue captures pointer on pointerdown", () => {
    const content = readFileSync(
      resolve(componentsDir, "FreehandCanvas.vue"),
      "utf-8",
    )
    expect(content).toContain("setPointerCapture")
  })

  test("FreehandCanvas.vue uses touch-action: none", () => {
    const content = readFileSync(
      resolve(componentsDir, "FreehandCanvas.vue"),
      "utf-8",
    )
    expect(content).toContain("touch-action: none")
  })

  test("FreehandCanvas.vue only draws on left click", () => {
    const content = readFileSync(
      resolve(componentsDir, "FreehandCanvas.vue"),
      "utf-8",
    )
    expect(content).toContain("e.button !== 0")
  })

  test("FreehandCanvas.vue creates FreehandStrokeCommand on pointerup", () => {
    const content = readFileSync(
      resolve(componentsDir, "FreehandCanvas.vue"),
      "utf-8",
    )
    expect(content).toContain("createFreehandStrokeCommand")
    expect(content).toContain("undoRedoPush")
  })

  test("FreehandCanvas.vue discards strokes shorter than 2 points", () => {
    const content = readFileSync(
      resolve(componentsDir, "FreehandCanvas.vue"),
      "utf-8",
    )
    expect(content).toContain("currentPoints.length < 2")
  })
})

// ─── CanvasViewport Integration ──────────────────────────────────────────────

describe("CanvasViewport FreehandCanvas Integration", () => {
  test("CanvasViewport.vue imports FreehandCanvas", () => {
    const content = readFileSync(
      resolve(componentsDir, "CanvasViewport.vue"),
      "utf-8",
    )
    expect(content).toContain("import FreehandCanvas")
    expect(content).toContain("FreehandCanvas.vue")
  })

  test("CanvasViewport.vue renders FreehandCanvas with correct props", () => {
    const content = readFileSync(
      resolve(componentsDir, "CanvasViewport.vue"),
      "utf-8",
    )
    expect(content).toContain("<FreehandCanvas")
    expect(content).toContain(":drawing-state")
    expect(content).toContain(":image-width")
    expect(content).toContain(":image-height")
    expect(content).toContain(":undo-redo-push")
    expect(content).toContain(":screen-to-image")
  })

  test("CanvasViewport.vue defines screenToImage function", () => {
    const content = readFileSync(
      resolve(componentsDir, "CanvasViewport.vue"),
      "utf-8",
    )
    expect(content).toContain("function screenToImage")
  })
})

// ─── Tab Integration ─────────────────────────────────────────────────────────

describe("Tab DrawingState Integration", () => {
  test("tab.ts includes drawingState field", () => {
    const content = readFileSync(resolve(typesDir, "tab.ts"), "utf-8")
    expect(content).toContain("drawingState: DrawingState")
    expect(content).toContain('import type { DrawingState } from "../composables/useDrawing"')
  })

  test("useTabStore.ts initializes drawingState for clipboard tab", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    const initStart = content.indexOf("function initClipboardTab")
    const initEnd = content.indexOf("}", initStart + 1)
    const initBody = content.slice(initStart, initEnd)
    expect(initBody).toContain("drawingState: createDrawingState()")
  })

  test("useTabStore.ts initializes drawingState for editing tabs", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    const createStart = content.indexOf("function createEditingTab")
    const returnIdx = content.indexOf("return tab", createStart)
    const createBody = content.slice(createStart, returnIdx)
    expect(createBody).toContain("drawingState: createDrawingState()")
  })

  test("useTabStore.ts imports createDrawingState", () => {
    const content = readFileSync(
      resolve(composablesDir, "useTabStore.ts"),
      "utf-8",
    )
    expect(content).toContain(
      'import { createDrawingState } from "./useDrawing"',
    )
  })
})

// ─── Export Integration ──────────────────────────────────────────────────────

describe("Export FreehandCanvas Integration", () => {
  test("useExport.ts includes freehand in flattening", () => {
    const content = readFileSync(
      resolve(composablesDir, "useExport.ts"),
      "utf-8",
    )
    expect(content).toContain("drawingState")
    expect(content).toContain("redrawAll")
    expect(content).toContain("freehandCanvas")
  })
})
