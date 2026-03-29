import { describe, test, expect } from "bun:test"
import { readFileSync } from "fs"
import { resolve } from "path"

const typesDir = resolve(__dirname, "../src/types")
const composablesDir = resolve(__dirname, "../src/composables")

describe("AspectRatioPreset type", () => {
  test("tools.ts exports AspectRatioPreset type", () => {
    const content = readFileSync(resolve(typesDir, "tools.ts"), "utf-8")
    expect(content).toContain("export type AspectRatioPreset")
    expect(content).toContain('"free"')
    expect(content).toContain('"original"')
    expect(content).toContain('"16:9"')
    expect(content).toContain('"4:3"')
    expect(content).toContain('"1:1"')
  })

  test("tools.ts exports CropToolSettings interface", () => {
    const content = readFileSync(resolve(typesDir, "tools.ts"), "utf-8")
    expect(content).toContain("export interface CropToolSettings")
    expect(content).toContain("aspectRatio: AspectRatioPreset")
  })

  test("crop is not in NoSettingsToolId", () => {
    const content = readFileSync(resolve(typesDir, "tools.ts"), "utf-8")
    const noSettingsLine = content
      .split("\n")
      .find((l) => l.includes("NoSettingsToolId"))
    expect(noSettingsLine).toBeDefined()
    expect(noSettingsLine).not.toContain('"crop"')
  })

  test("ToolSettingsMap maps crop to CropToolSettings", () => {
    const content = readFileSync(resolve(typesDir, "tools.ts"), "utf-8")
    expect(content).toContain("crop: CropToolSettings")
  })
})

describe("Tool store crop settings", () => {
  test("useToolStore exports getCropSettings and updateCropSettings", () => {
    const content = readFileSync(
      resolve(composablesDir, "useToolStore.ts"),
      "utf-8",
    )
    expect(content).toContain("getCropSettings")
    expect(content).toContain("updateCropSettings")
  })
})

describe("Aspect ratio constraint", () => {
  test("constrainToRatio returns correct dimensions for 16:9", () => {
    const { constrainToRatio } = require("../src/utils/cropRatio")
    const result = constrainToRatio(200, 200, 16 / 9)
    expect(result.width).toBe(200)
    expect(Math.round(result.height)).toBe(113)
  })

  test("constrainToRatio returns original dimensions for null ratio", () => {
    const { constrainToRatio } = require("../src/utils/cropRatio")
    const result = constrainToRatio(200, 150, null)
    expect(result.width).toBe(200)
    expect(result.height).toBe(150)
  })

  test("constrainToRatio handles 1:1", () => {
    const { constrainToRatio } = require("../src/utils/cropRatio")
    const result = constrainToRatio(300, 200, 1)
    expect(result.width).toBe(200)
    expect(result.height).toBe(200)
  })

  test("constrainToRatio handles 4:3", () => {
    const { constrainToRatio } = require("../src/utils/cropRatio")
    const result = constrainToRatio(400, 400, 4 / 3)
    expect(result.width).toBe(400)
    expect(result.height).toBe(300)
  })

  test("resolveAspectRatio maps presets to numeric ratios", () => {
    const { resolveAspectRatio } = require("../src/utils/cropRatio")
    expect(resolveAspectRatio("free", 800, 600)).toBeNull()
    expect(resolveAspectRatio("original", 800, 600)).toBeCloseTo(800 / 600)
    expect(resolveAspectRatio("16:9", 800, 600)).toBeCloseTo(16 / 9)
    expect(resolveAspectRatio("4:3", 800, 600)).toBeCloseTo(4 / 3)
    expect(resolveAspectRatio("1:1", 800, 600)).toBe(1)
  })
})
