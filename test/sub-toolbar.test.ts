import { describe, test, expect } from "bun:test"
import { readFileSync, existsSync } from "fs"
import { resolve } from "path"

const componentsDir = resolve(__dirname, "../src/components")

function readComponent(name: string): string {
  return readFileSync(resolve(componentsDir, name), "utf-8")
}

describe("SubToolbar", () => {
  const subToolbar = readComponent("SubToolbar.vue")

  test("SubToolbar.vue exists", () => {
    expect(existsSync(resolve(componentsDir, "SubToolbar.vue"))).toBe(true)
  })

  test("imports useToolStore", () => {
    expect(subToolbar).toContain("useToolStore")
  })

  test("imports tool type guards", () => {
    expect(subToolbar).toContain("isFreehandTool")
    expect(subToolbar).toContain("isShapeTool")
    expect(subToolbar).toContain("isLineTool")
  })

  test("imports all sub-components", () => {
    expect(subToolbar).toContain("ColorPicker")
    expect(subToolbar).toContain("StrokeWidthSelector")
    expect(subToolbar).toContain("OpacitySlider")
    expect(subToolbar).toContain("FillToggle")
    expect(subToolbar).toContain("RedactStylePicker")
    expect(subToolbar).toContain("FontSizeSelector")
    expect(subToolbar).toContain("CalloutSizeSelector")
  })

  test("is always visible (no hidden class)", () => {
    expect(subToolbar).not.toContain("sub-toolbar--hidden")
    expect(subToolbar).not.toContain("isVisible")
  })

  test("has data-section attributes for each parameter type", () => {
    const sections = [
      "color",
      "width",
      "opacity",
      "fill",
      "fillColor",
      "fillOpacity",
      "calloutColor",
      "calloutSize",
      "fontSize",
      "redactStyle",
    ]
    for (const section of sections) {
      expect(subToolbar).toContain(`data-section="${section}"`)
    }
  })

  test("uses semantic tokens only, no Flexoki primitives", () => {
    expect(subToolbar).not.toMatch(/var\(--flexoki-/)
    expect(subToolbar).toContain("var(--surface-app)")
    expect(subToolbar).toContain("var(--border-subtle)")
    expect(subToolbar).toContain("var(--text-secondary)")
  })

  test("has ARIA toolbar role and label", () => {
    expect(subToolbar).toContain('role="toolbar"')
    expect(subToolbar).toContain('aria-label="Tool settings"')
  })

  test("shows copy/save counter on the right", () => {
    expect(subToolbar).toContain("sub-toolbar__counter")
    expect(subToolbar).toContain("sub-toolbar__counter-digit")
    expect(subToolbar).toContain("margin-left: auto")
    expect(subToolbar).toContain("counterDigits")
    expect(subToolbar).toContain("Copy and save counter")
    expect(subToolbar).toContain("% 100000")
  })
})

describe("SubToolbar — per-tool parameter visibility", () => {
  const subToolbar = readComponent("SubToolbar.vue")

  test("pen/pencil shows color and width (no opacity)", () => {
    // The showColor computed includes pen, pencil
    expect(subToolbar).toContain('tool === "pen"')
    expect(subToolbar).toContain('tool === "pencil"')
    // showOpacity only for marker
    expect(subToolbar).toContain('activeTool.value === "marker"')
  })

  test("marker shows color, width, and opacity", () => {
    // showColor, showWidth both include marker
    expect(subToolbar).toContain('tool === "marker"')
    // showOpacity specifically checks for marker
    expect(subToolbar).toMatch(/showOpacity[\s\S]*?marker/)
  })

  test("eraser shows width only (no color)", () => {
    // showWidth includes eraser but showColor does not
    const showColorBlock = subToolbar.slice(
      subToolbar.indexOf("const showColor"),
      subToolbar.indexOf("const showWidth"),
    )
    const showWidthBlock = subToolbar.slice(
      subToolbar.indexOf("const showWidth"),
      subToolbar.indexOf("const showOpacity"),
    )
    expect(showColorBlock).not.toContain('"eraser"')
    expect(showWidthBlock).toContain('"eraser"')
  })

  test("arrow/line shows color and width", () => {
    const showColorBlock = subToolbar.slice(
      subToolbar.indexOf("const showColor"),
      subToolbar.indexOf("const showWidth"),
    )
    expect(showColorBlock).toContain('"arrow"')
    expect(showColorBlock).toContain('"line"')
  })

  test("rect/ellipse shows color, width, fill toggle", () => {
    expect(subToolbar).toContain('"rect"')
    expect(subToolbar).toContain('"ellipse"')
    expect(subToolbar).toContain("isShapeTool(activeTool.value)")
  })

  test("callout shows fill color and size", () => {
    expect(subToolbar).toContain('activeTool.value === "callout"')
    expect(subToolbar).toContain("CalloutSizeSelector")
  })

  test("text shows font size and color", () => {
    expect(subToolbar).toContain('tool === "text"')
    expect(subToolbar).toContain("FontSizeSelector")
  })

  test("redact shows style picker", () => {
    expect(subToolbar).toContain('activeTool.value === "redact"')
    expect(subToolbar).toContain("RedactStylePicker")
  })
})

describe("SubToolbar — per-tool settings independence", () => {
  const subToolbar = readComponent("SubToolbar.vue")

  test("routes color changes through tool-specific updaters", () => {
    expect(subToolbar).toContain("updateToolSettings(tool, { color })")
    expect(subToolbar).toContain("updateShapeSettings(tool, { color })")
    expect(subToolbar).toContain("updateLineSettings(tool, { color })")
    expect(subToolbar).toContain("updateTextSettings({ color })")
  })

  test("routes width changes through tool-specific updaters", () => {
    expect(subToolbar).toContain("updateToolSettings(tool, { width })")
    expect(subToolbar).toContain("updateShapeSettings(tool, { width })")
    expect(subToolbar).toContain("updateLineSettings(tool, { width })")
  })

  test("opacity change is marker-specific", () => {
    expect(subToolbar).toContain(
      'updateToolSettings("marker", { opacity })',
    )
  })
})

describe("ColorPicker", () => {
  const colorPicker = readComponent("ColorPicker.vue")

  test("ColorPicker.vue exists", () => {
    expect(existsSync(resolve(componentsDir, "ColorPicker.vue"))).toBe(true)
  })

  test("defines 10 Flexoki annotation swatches", () => {
    const swatchLabels = [
      "Red",
      "Orange",
      "Yellow",
      "Green",
      "Cyan",
      "Blue",
      "Purple",
      "Magenta",
      "Black",
      "White",
    ]
    for (const label of swatchLabels) {
      expect(colorPicker).toContain(`label: "${label}"`)
    }
  })

  test("uses semantic annotation tokens for swatch display", () => {
    expect(colorPicker).toContain("--annotation-red")
    expect(colorPicker).toContain("--annotation-orange")
    expect(colorPicker).toContain("--annotation-yellow")
    expect(colorPicker).toContain("--annotation-green")
    expect(colorPicker).toContain("--annotation-cyan")
    expect(colorPicker).toContain("--annotation-blue")
    expect(colorPicker).toContain("--annotation-purple")
    expect(colorPicker).toContain("--annotation-magenta")
    expect(colorPicker).toContain("--annotation-black")
    expect(colorPicker).toContain("--annotation-white")
  })

  test("stores resolved hex values for canvas use", () => {
    expect(colorPicker).toContain("#D14D41")
    expect(colorPicker).toContain("#DA702C")
    expect(colorPicker).toContain("#D0A215")
    expect(colorPicker).toContain("#879A39")
    expect(colorPicker).toContain("#3AA99F")
    expect(colorPicker).toContain("#4385BE")
    expect(colorPicker).toContain("#8B7EC8")
    expect(colorPicker).toContain("#CE5D97")
    expect(colorPicker).toContain("#100F0F")
    expect(colorPicker).toContain("#FFFCF0")
  })

  test("includes native color input for custom colors", () => {
    expect(colorPicker).toContain('type="color"')
    expect(colorPicker).toContain("color-picker__custom-input")
  })

  test("has recent colors section with max 8", () => {
    expect(colorPicker).toContain("recentColors")
    expect(colorPicker).toContain("MAX_RECENT")
    expect(colorPicker).toContain("8")
    expect(colorPicker).toContain("color-picker__recent")
  })

  test("uses v-model pattern (modelValue + update:modelValue)", () => {
    expect(colorPicker).toContain("modelValue: string")
    expect(colorPicker).toContain('"update:modelValue": [color: string]')
  })

  test("has ARIA radiogroup for swatches", () => {
    expect(colorPicker).toContain('role="radiogroup"')
    expect(colorPicker).toContain('role="radio"')
    expect(colorPicker).toContain("aria-checked")
  })

  test("uses semantic tokens only in styles", () => {
    const styleBlock = colorPicker.slice(colorPicker.indexOf("<style"))
    expect(styleBlock).not.toMatch(/var\(--flexoki-/)
    expect(styleBlock).toContain("var(--border-strong)")
    expect(styleBlock).toContain("var(--interactive-default)")
    expect(styleBlock).toContain("var(--text-secondary)")
  })
})

describe("StrokeWidthSelector", () => {
  const component = readComponent("StrokeWidthSelector.vue")

  test("StrokeWidthSelector.vue exists", () => {
    expect(
      existsSync(resolve(componentsDir, "StrokeWidthSelector.vue")),
    ).toBe(true)
  })

  test("defines 3 width options (thin, medium, thick)", () => {
    expect(component).toContain('"Thin"')
    expect(component).toContain('"Medium"')
    expect(component).toContain('"Thick"')
  })

  test("renders visual dots with different sizes", () => {
    expect(component).toContain("stroke-width-selector__dot")
    expect(component).toContain("dotSize")
  })

  test("uses ARIA radiogroup", () => {
    expect(component).toContain('role="radiogroup"')
    expect(component).toContain('aria-label="Stroke width"')
  })

  test("uses semantic tokens only", () => {
    const styleBlock = component.slice(component.indexOf("<style"))
    expect(styleBlock).not.toMatch(/var\(--flexoki-/)
    expect(styleBlock).toContain("var(--text-primary)")
    expect(styleBlock).toContain("var(--interactive-default)")
  })
})

describe("OpacitySlider", () => {
  const component = readComponent("OpacitySlider.vue")

  test("OpacitySlider.vue exists", () => {
    expect(existsSync(resolve(componentsDir, "OpacitySlider.vue"))).toBe(true)
  })

  test("uses range input 0-100", () => {
    expect(component).toContain('type="range"')
    expect(component).toContain('min="0"')
    expect(component).toContain('max="100"')
  })

  test("converts between fraction (0-1) and percent (0-100)", () => {
    expect(component).toContain("modelValue * 100")
    expect(component).toContain("/ 100")
  })

  test("has preview swatch with opacity applied", () => {
    expect(component).toContain("opacity-slider__preview")
    expect(component).toContain("opacity: modelValue")
  })

  test("uses semantic tokens only", () => {
    const styleBlock = component.slice(component.indexOf("<style"))
    expect(styleBlock).not.toMatch(/var\(--flexoki-/)
    expect(styleBlock).toContain("var(--text-secondary)")
    expect(styleBlock).toContain("var(--interactive-default)")
  })
})

describe("FillToggle", () => {
  const component = readComponent("FillToggle.vue")

  test("FillToggle.vue exists", () => {
    expect(existsSync(resolve(componentsDir, "FillToggle.vue"))).toBe(true)
  })

  test("uses checkbox input", () => {
    expect(component).toContain('type="checkbox"')
    expect(component).toContain(":checked")
  })

  test("uses v-model pattern", () => {
    expect(component).toContain("modelValue: boolean")
    expect(component).toContain('"update:modelValue": [enabled: boolean]')
  })

  test("has Fill label", () => {
    expect(component).toContain("Fill")
    expect(component).toContain("fill-toggle__label")
  })

  test("uses semantic tokens only", () => {
    const styleBlock = component.slice(component.indexOf("<style"))
    expect(styleBlock).not.toMatch(/var\(--flexoki-/)
    expect(styleBlock).toContain("var(--interactive-default)")
    expect(styleBlock).toContain("var(--text-secondary)")
  })
})

describe("RedactStylePicker", () => {
  const component = readComponent("RedactStylePicker.vue")

  test("RedactStylePicker.vue exists", () => {
    expect(
      existsSync(resolve(componentsDir, "RedactStylePicker.vue")),
    ).toBe(true)
  })

  test("offers solid, pixelate, blur options", () => {
    expect(component).toContain('"solid"')
    expect(component).toContain('"pixelate"')
    expect(component).toContain('"blur"')
  })

  test("imports RedactStyle type", () => {
    expect(component).toContain("RedactStyle")
  })

  test("uses ARIA radiogroup", () => {
    expect(component).toContain('role="radiogroup"')
    expect(component).toContain('aria-label="Redaction style"')
  })

  test("uses semantic tokens only", () => {
    const styleBlock = component.slice(component.indexOf("<style"))
    expect(styleBlock).not.toMatch(/var\(--flexoki-/)
    expect(styleBlock).toContain("var(--border-subtle)")
    expect(styleBlock).toContain("var(--interactive-default)")
  })
})

describe("FontSizeSelector", () => {
  const component = readComponent("FontSizeSelector.vue")

  test("FontSizeSelector.vue exists", () => {
    expect(
      existsSync(resolve(componentsDir, "FontSizeSelector.vue")),
    ).toBe(true)
  })

  test("offers multiple size options", () => {
    expect(component).toContain("S")
    expect(component).toContain("M")
    expect(component).toContain("L")
    expect(component).toContain("XL")
  })

  test("uses semantic tokens only", () => {
    const styleBlock = component.slice(component.indexOf("<style"))
    expect(styleBlock).not.toMatch(/var\(--flexoki-/)
    expect(styleBlock).toContain("var(--interactive-default)")
  })
})

describe("CalloutSizeSelector", () => {
  const component = readComponent("CalloutSizeSelector.vue")

  test("CalloutSizeSelector.vue exists", () => {
    expect(
      existsSync(resolve(componentsDir, "CalloutSizeSelector.vue")),
    ).toBe(true)
  })

  test("offers size options for callout radius", () => {
    expect(component).toContain("S")
    expect(component).toContain("M")
    expect(component).toContain("L")
  })

  test("uses semantic tokens only", () => {
    const styleBlock = component.slice(component.indexOf("<style"))
    expect(styleBlock).not.toMatch(/var\(--flexoki-/)
    expect(styleBlock).toContain("var(--interactive-default)")
  })
})

describe("useToolStore — extended settings", () => {
  test("exports shape, line, callout, text, redact settings accessors", () => {
    const storeFile = readFileSync(
      resolve(__dirname, "../src/composables/useToolStore.ts"),
      "utf-8",
    )
    expect(storeFile).toContain("getShapeSettings")
    expect(storeFile).toContain("updateShapeSettings")
    expect(storeFile).toContain("getLineSettings")
    expect(storeFile).toContain("updateLineSettings")
    expect(storeFile).toContain("getCalloutSettings")
    expect(storeFile).toContain("updateCalloutSettings")
    expect(storeFile).toContain("getTextSettings")
    expect(storeFile).toContain("updateTextSettings")
    expect(storeFile).toContain("getRedactSettings")
    expect(storeFile).toContain("updateRedactSettings")
  })

  test("defines defaults for all non-freehand tools", () => {
    const storeFile = readFileSync(
      resolve(__dirname, "../src/composables/useToolStore.ts"),
      "utf-8",
    )
    expect(storeFile).toContain("SHAPE_DEFAULTS")
    expect(storeFile).toContain("LINE_DEFAULTS")
    expect(storeFile).toContain("CALLOUT_DEFAULTS")
    expect(storeFile).toContain("TEXT_DEFAULTS")
    expect(storeFile).toContain("REDACT_DEFAULTS")
  })
})

describe("Tool types — extended", () => {
  test("exports new type guards and settings interfaces", () => {
    const typesFile = readFileSync(
      resolve(__dirname, "../src/types/tools.ts"),
      "utf-8",
    )
    expect(typesFile).toContain("ShapeToolId")
    expect(typesFile).toContain("LineToolId")
    expect(typesFile).toContain("RedactStyle")
    expect(typesFile).toContain("isShapeTool")
    expect(typesFile).toContain("isLineTool")
    expect(typesFile).toContain("ShapeToolSettings")
    expect(typesFile).toContain("LineToolSettings")
    expect(typesFile).toContain("CalloutToolSettings")
    expect(typesFile).toContain("TextToolSettings")
    expect(typesFile).toContain("RedactToolSettings")
  })
})
