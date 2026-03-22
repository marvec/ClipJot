import { describe, test, expect } from "bun:test"
import { readFileSync } from "fs"
import { resolve } from "path"
import {
  serializeAnnotationsToSvg,
  resolveCssColor,
} from "../src/composables/useExport"
import type { Annotation } from "../src/types/annotations"

const exportFile = readFileSync(
  resolve(__dirname, "../src/composables/useExport.ts"),
  "utf-8",
)

// ── Layer ordering ──

describe("Layer ordering", () => {
  test("composites layers in correct order: base → redaction → freehand → SVG annotations", () => {
    // Verify the layer comments appear in order in the source
    const baseIdx = exportFile.indexOf("Layer 1: Base image")
    const redactionIdx = exportFile.indexOf("Layer 2: Destructive redaction")
    const freehandIdx = exportFile.indexOf("Layer 3: Freehand strokes")
    const svgIdx = exportFile.indexOf("Layer 4: SVG annotations")

    expect(baseIdx).toBeGreaterThan(-1)
    expect(redactionIdx).toBeGreaterThan(-1)
    expect(freehandIdx).toBeGreaterThan(-1)
    expect(svgIdx).toBeGreaterThan(-1)

    // Correct order
    expect(baseIdx).toBeLessThan(redactionIdx)
    expect(redactionIdx).toBeLessThan(freehandIdx)
    expect(freehandIdx).toBeLessThan(svgIdx)
  })

  test("redaction reads base pixels from separate canvas (destructive pattern)", () => {
    // The redaction section should create a base canvas for pixel reading
    const redactionSection = exportFile.slice(
      exportFile.indexOf("Layer 2"),
      exportFile.indexOf("Layer 3"),
    )
    expect(redactionSection).toContain("baseEl")
    expect(redactionSection).toContain("baseCtx")
    expect(redactionSection).toContain("renderRedactionRegion")
  })

  test("text annotations are batched into SVG render pass (B.8)", () => {
    // Text should NOT have its own separate rendering loop in flattenTab
    const flattenBody = exportFile.slice(
      exportFile.indexOf("async function flattenTab"),
      exportFile.indexOf("export async function copyTabToClipboard"),
    )

    // Should have ONE annotation render pass
    expect(flattenBody).toContain("renderAnnotationsToImage")

    // Should NOT have a separate text annotation loop
    expect(flattenBody).not.toContain("renderTextAnnotationToImage")
    expect(flattenBody).not.toContain("filter(\n")
  })
})

// ── Crop application ──

describe("Crop application", () => {
  test("flattenTab reads crop bounds from tab.cropState", () => {
    expect(exportFile).toContain("cropState.cropBounds.value")
  })

  test("export canvas uses crop dimensions when crop is set", () => {
    expect(exportFile).toContain("crop.width")
    expect(exportFile).toContain("crop.height")
  })

  test("crop uses drawImage source-region extraction", () => {
    // Should use the 9-argument drawImage form for crop extraction
    const cropSection = exportFile.slice(
      exportFile.indexOf("Crop extraction"),
    )
    expect(cropSection).toContain("crop.x")
    expect(cropSection).toContain("crop.y")
    expect(cropSection).toContain("crop.width")
    expect(cropSection).toContain("crop.height")
  })

  test("returns crop dimensions in ExportResult when crop is active", () => {
    expect(exportFile).toContain("width: crop.width, height: crop.height")
  })

  test("returns full image dimensions when no crop", () => {
    expect(exportFile).toContain("width: imgW, height: imgH")
  })
})

// ── CSS variable resolution (Appendix A.4) ──

describe("CSS variable resolution", () => {
  test("resolveCssColor passes through hex colors unchanged", () => {
    expect(resolveCssColor("#ff0000")).toBe("#ff0000")
    expect(resolveCssColor("#000")).toBe("#000")
    expect(resolveCssColor("rgb(255,0,0)")).toBe("rgb(255,0,0)")
  })

  test("resolveCssColor extracts fallback from var()", () => {
    expect(resolveCssColor("var(--accent-color, #ff0000)")).toBe("#ff0000")
    expect(resolveCssColor("var(--bg, rgb(0,0,0))")).toBe("rgb(0,0,0)")
  })

  test("resolveCssColor returns black for var() without fallback", () => {
    expect(resolveCssColor("var(--accent-color)")).toBe("#000000")
  })

  test("serializeAnnotationsToSvg applies color resolution to rect", () => {
    const annotations: Annotation[] = [
      {
        id: "r1",
        type: "rect",
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        rotation: 0,
        strokeColor: "var(--accent, #ff0000)",
        strokeWidth: 2,
        selected: false,
        fill: true,
        fillColor: "var(--bg, #00ff00)",
        fillOpacity: 0.5,
      },
    ]
    const svg = serializeAnnotationsToSvg(annotations, 200, 200)
    expect(svg).toContain('stroke="#ff0000"')
    expect(svg).toContain('fill="#00ff00"')
    expect(svg).not.toContain("var(")
  })

  test("serializeAnnotationsToSvg applies color resolution to ellipse", () => {
    const annotations: Annotation[] = [
      {
        id: "e1",
        type: "ellipse",
        x: 0,
        y: 0,
        width: 80,
        height: 40,
        rotation: 0,
        strokeColor: "var(--stroke, #0000ff)",
        strokeWidth: 1,
        selected: false,
        fill: false,
        fillColor: "#ccc",
        fillOpacity: 1,
      },
    ]
    const svg = serializeAnnotationsToSvg(annotations, 200, 200)
    expect(svg).toContain('stroke="#0000ff"')
    expect(svg).not.toContain("var(")
  })

  test("serializeAnnotationsToSvg applies color resolution to arrow", () => {
    const annotations: Annotation[] = [
      {
        id: "a1",
        type: "arrow",
        x: 0,
        y: 0,
        endX: 100,
        endY: 100,
        controlX: 0,
        controlY: 0,
        rotation: 0,
        strokeColor: "var(--arrow, #aabbcc)",
        strokeWidth: 2,
        selected: false,
      },
    ]
    const svg = serializeAnnotationsToSvg(annotations, 200, 200)
    expect(svg).toContain('stroke="#aabbcc"')
    expect(svg).not.toContain("var(")
  })

  test("serializeAnnotationsToSvg applies color resolution to line", () => {
    const annotations: Annotation[] = [
      {
        id: "l1",
        type: "line",
        x: 0,
        y: 0,
        endX: 50,
        endY: 50,
        rotation: 0,
        strokeColor: "var(--line, #112233)",
        strokeWidth: 1,
        selected: false,
      },
    ]
    const svg = serializeAnnotationsToSvg(annotations, 200, 200)
    expect(svg).toContain('stroke="#112233"')
    expect(svg).not.toContain("var(")
  })

  test("serializeAnnotationsToSvg applies color resolution to callout", () => {
    const annotations: Annotation[] = [
      {
        id: "c1",
        type: "callout",
        x: 50,
        y: 50,
        rotation: 0,
        strokeColor: "var(--callout-stroke, #443322)",
        strokeWidth: 2,
        selected: false,
        number: 1,
        radius: 16,
        fillColor: "var(--callout-fill, #eeddcc)",
      },
    ]
    const svg = serializeAnnotationsToSvg(annotations, 200, 200)
    expect(svg).toContain('fill="#eeddcc"')
    expect(svg).toContain('stroke="#443322"')
    expect(svg).not.toContain("var(")
  })

  test("serializeAnnotationsToSvg applies color resolution to text", () => {
    const annotations: Annotation[] = [
      {
        id: "t1",
        type: "text",
        x: 10,
        y: 10,
        width: 200,
        height: 50,
        rotation: 0,
        strokeColor: "var(--text-color, #223344)",
        strokeWidth: 0,
        selected: false,
        htmlContent: "Hello",
        fontFamily: "sans-serif",
        fontSize: 16,
        fill: true,
        fillColor: "var(--text-bg, #ffeedd)",
      },
    ]
    const svg = serializeAnnotationsToSvg(annotations, 400, 400)
    expect(svg).toContain("color: #223344")
    expect(svg).toContain("background-color: #ffeedd")
    expect(svg).not.toContain("var(")
  })

  test("resolveCssColor is exported and used in serializeAnnotationsToSvg", () => {
    expect(exportFile).toContain("export function resolveCssColor")
    // Verify it's called in the serialization function
    const serializeSection = exportFile.slice(
      exportFile.indexOf("function serializeAnnotationsToSvg"),
    )
    expect(serializeSection).toContain("resolveCssColor(")
  })
})

// ── Export atomicity (Appendix A.5) ──

describe("Export atomicity", () => {
  test("copyTabToClipboard flattens before touching clipboard", () => {
    const copyFn = exportFile.slice(
      exportFile.indexOf("async function copyTabToClipboard"),
      exportFile.indexOf("export async function saveTabToFile"),
    )
    const flattenIdx = copyFn.indexOf("flattenTab(tab)")
    const writeIdx = copyFn.indexOf("writeClipboardImage")
    expect(flattenIdx).toBeGreaterThan(-1)
    expect(writeIdx).toBeGreaterThan(-1)
    expect(flattenIdx).toBeLessThan(writeIdx)
  })

  test("convertToBlob happens before any clipboard operation", () => {
    const flattenIdx = exportFile.indexOf("convertToBlob")
    const writeIdx = exportFile.indexOf("writeClipboardImage")
    expect(flattenIdx).toBeGreaterThan(-1)
    expect(writeIdx).toBeGreaterThan(-1)
    expect(flattenIdx).toBeLessThan(writeIdx)
  })

  test("saveTabToFile flattens before writing to disk", () => {
    const saveFn = exportFile.slice(
      exportFile.indexOf("async function saveTabToFile"),
    )
    const flattenIdx = saveFn.indexOf("flattenTab(tab)")
    const writeIdx = saveFn.indexOf('invoke("write_file"')
    expect(flattenIdx).toBeGreaterThan(-1)
    expect(writeIdx).toBeGreaterThan(-1)
    expect(flattenIdx).toBeLessThan(writeIdx)
  })
})

// ── All layer types present ──

describe("All layer types", () => {
  test("flattenTab handles all 5 layer types", () => {
    const flattenBody = exportFile.slice(
      exportFile.indexOf("async function flattenTab"),
      exportFile.indexOf("export async function copyTabToClipboard"),
    )

    // Base image
    expect(flattenBody).toContain("drawImage(img")

    // Redaction
    expect(flattenBody).toContain("redactionState.regions")
    expect(flattenBody).toContain("renderRedactionRegion")

    // Freehand
    expect(flattenBody).toContain("drawingState.strokes")
    expect(flattenBody).toContain("redrawAll")

    // SVG annotations (includes text via foreignObject)
    expect(flattenBody).toContain("annotationState.annotations")
    expect(flattenBody).toContain("renderAnnotationsToImage")

    // Crop
    expect(flattenBody).toContain("cropState.cropBounds")
  })

  test("serializeAnnotationsToSvg handles all 6 annotation types", () => {
    const fn = exportFile.slice(
      exportFile.indexOf("function serializeAnnotationsToSvg"),
      exportFile.indexOf("async function renderAnnotationsToImage"),
    )

    expect(fn).toContain('case "rect"')
    expect(fn).toContain('case "ellipse"')
    expect(fn).toContain('case "arrow"')
    expect(fn).toContain('case "line"')
    expect(fn).toContain('case "callout"')
    expect(fn).toContain('case "text"')
  })

  test("serializes all annotation types into valid SVG", () => {
    const annotations: Annotation[] = [
      {
        id: "r1",
        type: "rect",
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        rotation: 0,
        strokeColor: "#ff0000",
        strokeWidth: 2,
        selected: false,
        fill: false,
        fillColor: "#000",
        fillOpacity: 1,
      },
      {
        id: "e1",
        type: "ellipse",
        x: 0,
        y: 0,
        width: 80,
        height: 40,
        rotation: 0,
        strokeColor: "#00ff00",
        strokeWidth: 1,
        selected: false,
        fill: true,
        fillColor: "#0000ff",
        fillOpacity: 0.5,
      },
      {
        id: "a1",
        type: "arrow",
        x: 0,
        y: 0,
        endX: 100,
        endY: 100,
        controlX: 10,
        controlY: -10,
        rotation: 0,
        strokeColor: "#aabb00",
        strokeWidth: 3,
        selected: false,
      },
      {
        id: "l1",
        type: "line",
        x: 0,
        y: 0,
        endX: 50,
        endY: 50,
        rotation: 0,
        strokeColor: "#ccddee",
        strokeWidth: 1,
        selected: false,
      },
      {
        id: "c1",
        type: "callout",
        x: 50,
        y: 50,
        rotation: 0,
        strokeColor: "#111111",
        strokeWidth: 2,
        selected: false,
        number: 1,
        radius: 16,
        fillColor: "#ffffff",
      },
      {
        id: "t1",
        type: "text",
        x: 10,
        y: 10,
        width: 200,
        height: 50,
        rotation: 0,
        strokeColor: "#333333",
        strokeWidth: 0,
        selected: false,
        htmlContent: "Test text",
        fontFamily: "sans-serif",
        fontSize: 14,
        fill: false,
        fillColor: "#000",
      },
    ]

    const svg = serializeAnnotationsToSvg(annotations, 400, 400)

    // Valid SVG wrapper
    expect(svg).toMatch(/^<svg xmlns/)
    expect(svg).toMatch(/<\/svg>$/)

    // All types present
    expect(svg).toContain("<rect")
    expect(svg).toContain("<ellipse")
    expect(svg).toContain("<path") // arrow
    expect(svg).toContain("<line")
    expect(svg).toContain("<circle") // callout
    expect(svg).toContain("<text") // callout number
    expect(svg).toContain("<foreignObject") // text annotation
    expect(svg).toContain("Test text")
  })
})

// ── Performance (Appendix B.7, B.8) ──

describe("Performance", () => {
  test("uses createImageBitmap instead of Image + onload (B.7)", () => {
    // Should NOT use the legacy Image() + onload pattern
    expect(exportFile).not.toContain("new Image()")
    expect(exportFile).not.toContain("img.onload")

    // Should use fetch + createImageBitmap
    expect(exportFile).toContain("loadImageBitmap")
    expect(exportFile).toContain("createImageBitmap(blob)")
  })

  test("closes ImageBitmap after use to free memory", () => {
    expect(exportFile).toContain("img.close()")
    expect(exportFile).toContain("svgBitmap.close()")
    expect(exportFile).toContain("bitmap.close()")
  })

  test("batches all annotations into single SVG render (B.8)", () => {
    const flattenBody = exportFile.slice(
      exportFile.indexOf("async function flattenTab"),
      exportFile.indexOf("export async function copyTabToClipboard"),
    )

    // Only ONE renderAnnotationsToImage call
    const matches = flattenBody.match(/renderAnnotationsToImage/g)
    expect(matches).toHaveLength(1)
  })
})

// ── saveTabToFile ──

describe("saveTabToFile", () => {
  test("function is exported", () => {
    expect(exportFile).toContain("export async function saveTabToFile")
  })

  test("accepts tab and filePath parameters", () => {
    expect(exportFile).toContain("tab: Tab")
    expect(exportFile).toContain("filePath: string")
  })

  test("invokes Tauri write_file command", () => {
    expect(exportFile).toContain('invoke("write_file"')
  })

  test("converts blob to byte array before writing", () => {
    const saveFn = exportFile.slice(
      exportFile.indexOf("async function saveTabToFile"),
    )
    expect(saveFn).toContain("arrayBuffer()")
    expect(saveFn).toContain("Uint8Array")
  })
})

// ── ExportResult interface ──

describe("ExportResult", () => {
  test("interface includes blob, width, height", () => {
    expect(exportFile).toContain("export interface ExportResult")
    expect(exportFile).toContain("blob: Blob")
    expect(exportFile).toContain("width: number")
    expect(exportFile).toContain("height: number")
  })
})

// ── No-image error ──

describe("Error handling", () => {
  test("flattenTab throws on missing image", () => {
    expect(exportFile).toContain("No image to export")
  })
})
