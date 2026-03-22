import { describe, test, expect, beforeEach } from "bun:test"
import { readFileSync, existsSync } from "fs"
import { resolve } from "path"
import type { RedactionRegion } from "../src/types/redaction"
import {
  BLUR_MIN,
  BLUR_DEFAULT,
  BLUR_MAX,
  PIXELATE_MIN,
  PIXELATE_DEFAULT,
  PIXELATE_MAX,
  SOLID_DEFAULT_COLOR,
  clampBlurRadius,
  clampBlockSize,
} from "../src/types/redaction"
import {
  createRedactionState,
  useRedactionStore,
} from "../src/composables/useRedaction"
import type { RedactionState } from "../src/composables/useRedaction"
import { createRedactionCreateCommand } from "../src/commands/RedactionCreateCommand"
import { createRedactionMutateCommand } from "../src/commands/RedactionMutateCommand"
import { createRedactionDeleteCommand } from "../src/commands/RedactionDeleteCommand"

function makeRegion(
  overrides?: Partial<RedactionRegion>,
): RedactionRegion {
  return {
    id: crypto.randomUUID(),
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    style: "solid",
    solidColor: SOLID_DEFAULT_COLOR,
    blockSize: PIXELATE_DEFAULT,
    blurRadius: BLUR_DEFAULT,
    ...overrides,
  }
}

describe("Redaction types", () => {
  test("RedactionRegion interface has all required fields", () => {
    const region = makeRegion()
    expect(region.id).toBeDefined()
    expect(region.x).toBe(10)
    expect(region.y).toBe(20)
    expect(region.width).toBe(100)
    expect(region.height).toBe(50)
    expect(region.style).toBe("solid")
    expect(region.solidColor).toBe("#000000")
    expect(region.blockSize).toBe(16)
    expect(region.blurRadius).toBe(40)
  })

  test("all three redaction styles are valid", () => {
    const solid = makeRegion({ style: "solid" })
    const pixelate = makeRegion({ style: "pixelate" })
    const blur = makeRegion({ style: "blur" })
    expect(solid.style).toBe("solid")
    expect(pixelate.style).toBe("pixelate")
    expect(blur.style).toBe("blur")
  })

  test("RedactStyle type is defined in tools.ts", () => {
    const toolsFile = readFileSync(
      resolve(__dirname, "../src/types/tools.ts"),
      "utf-8",
    )
    expect(toolsFile).toContain("RedactStyle")
    expect(toolsFile).toContain('"solid"')
    expect(toolsFile).toContain('"pixelate"')
    expect(toolsFile).toContain('"blur"')
  })
})

describe("Security minimums (Appendix C)", () => {
  test("blur minimum is 40px", () => {
    expect(BLUR_MIN).toBe(40)
  })

  test("blur default is 40px", () => {
    expect(BLUR_DEFAULT).toBe(40)
  })

  test("blur maximum is 50px", () => {
    expect(BLUR_MAX).toBe(50)
  })

  test("pixelation minimum is 12px", () => {
    expect(PIXELATE_MIN).toBe(12)
  })

  test("pixelation default is 16px", () => {
    expect(PIXELATE_DEFAULT).toBe(16)
  })

  test("pixelation maximum is 32px", () => {
    expect(PIXELATE_MAX).toBe(32)
  })

  test("clampBlurRadius enforces minimum", () => {
    expect(clampBlurRadius(10)).toBe(BLUR_MIN)
    expect(clampBlurRadius(20)).toBe(BLUR_MIN)
    expect(clampBlurRadius(39)).toBe(BLUR_MIN)
  })

  test("clampBlurRadius enforces maximum", () => {
    expect(clampBlurRadius(60)).toBe(BLUR_MAX)
    expect(clampBlurRadius(100)).toBe(BLUR_MAX)
  })

  test("clampBlurRadius preserves values in range", () => {
    expect(clampBlurRadius(40)).toBe(40)
    expect(clampBlurRadius(45)).toBe(45)
    expect(clampBlurRadius(50)).toBe(50)
  })

  test("clampBlockSize enforces minimum", () => {
    expect(clampBlockSize(5)).toBe(PIXELATE_MIN)
    expect(clampBlockSize(11)).toBe(PIXELATE_MIN)
  })

  test("clampBlockSize enforces maximum", () => {
    expect(clampBlockSize(40)).toBe(PIXELATE_MAX)
    expect(clampBlockSize(100)).toBe(PIXELATE_MAX)
  })

  test("clampBlockSize preserves values in range", () => {
    expect(clampBlockSize(12)).toBe(12)
    expect(clampBlockSize(20)).toBe(20)
    expect(clampBlockSize(32)).toBe(32)
  })
})

describe("Redaction state management", () => {
  test("createRedactionState returns state with empty regions", () => {
    const state = createRedactionState()
    expect(state.regions.value).toEqual([])
  })

  describe("useRedactionStore", () => {
    let state: RedactionState
    let store: ReturnType<typeof useRedactionStore>

    beforeEach(() => {
      state = createRedactionState()
      store = useRedactionStore(state)
    })

    test("addRegion appends to array", () => {
      const r = makeRegion()
      store.addRegion(r)
      expect(store.regions.value).toHaveLength(1)
      expect(store.regions.value[0].id).toBe(r.id)
    })

    test("removeRegion removes by id and returns it", () => {
      const r = makeRegion()
      store.addRegion(r)
      const removed = store.removeRegion(r.id)
      expect(removed).toBeDefined()
      expect(removed!.id).toBe(r.id)
      expect(store.regions.value).toHaveLength(0)
    })

    test("removeRegion returns undefined for missing id", () => {
      const removed = store.removeRegion("nonexistent")
      expect(removed).toBeUndefined()
    })

    test("updateRegion patches by id", () => {
      const r = makeRegion({ solidColor: "#000000" })
      store.addRegion(r)
      store.updateRegion(r.id, { solidColor: "#ff0000" })
      expect(store.regions.value[0].solidColor).toBe("#ff0000")
    })

    test("updateRegion does not affect other regions", () => {
      const r1 = makeRegion({ solidColor: "#000000" })
      const r2 = makeRegion({ solidColor: "#0000ff" })
      store.addRegion(r1)
      store.addRegion(r2)
      store.updateRegion(r1.id, { solidColor: "#ff0000" })
      expect(store.regions.value[1].solidColor).toBe("#0000ff")
    })

    test("insertRegion inserts at specific index", () => {
      const r1 = makeRegion()
      const r2 = makeRegion()
      const r3 = makeRegion()
      store.addRegion(r1)
      store.addRegion(r3)
      store.insertRegion(r2, 1)
      expect(store.regions.value[0].id).toBe(r1.id)
      expect(store.regions.value[1].id).toBe(r2.id)
      expect(store.regions.value[2].id).toBe(r3.id)
    })

    test("getRegion finds by id", () => {
      const r = makeRegion()
      store.addRegion(r)
      const found = store.getRegion(r.id)
      expect(found).toBeDefined()
      expect(found!.id).toBe(r.id)
    })

    test("getRegion returns undefined for missing id", () => {
      expect(store.getRegion("nonexistent")).toBeUndefined()
    })

    test("immutability: addRegion creates new array", () => {
      const r = makeRegion()
      const before = store.regions.value
      store.addRegion(r)
      expect(store.regions.value).not.toBe(before)
    })

    test("immutability: removeRegion creates new array", () => {
      const r = makeRegion()
      store.addRegion(r)
      const before = store.regions.value
      store.removeRegion(r.id)
      expect(store.regions.value).not.toBe(before)
    })

    test("immutability: updateRegion creates new array", () => {
      const r = makeRegion()
      store.addRegion(r)
      const before = store.regions.value
      store.updateRegion(r.id, { solidColor: "#fff" })
      expect(store.regions.value).not.toBe(before)
    })
  })
})

describe("Redaction commands", () => {
  let state: RedactionState
  let store: ReturnType<typeof useRedactionStore>

  beforeEach(() => {
    state = createRedactionState()
    store = useRedactionStore(state)
  })

  describe("RedactionCreateCommand", () => {
    test("execute adds region", () => {
      const r = makeRegion()
      const cmd = createRedactionCreateCommand(
        r,
        store.addRegion,
        (id) => store.removeRegion(id),
      )
      cmd.execute()
      expect(store.regions.value).toHaveLength(1)
    })

    test("undo removes region", () => {
      const r = makeRegion()
      const cmd = createRedactionCreateCommand(
        r,
        store.addRegion,
        (id) => store.removeRegion(id),
      )
      cmd.execute()
      cmd.undo()
      expect(store.regions.value).toHaveLength(0)
    })

    test("has correct label and layer", () => {
      const r = makeRegion({ style: "solid" })
      const cmd = createRedactionCreateCommand(
        r,
        store.addRegion,
        (id) => store.removeRegion(id),
      )
      expect(cmd.label).toBe("Create solid redaction")
      expect(cmd.layer).toBe("redaction")
    })

    test("label reflects redaction style", () => {
      const blur = makeRegion({ style: "blur" })
      const cmdBlur = createRedactionCreateCommand(
        blur,
        store.addRegion,
        (id) => store.removeRegion(id),
      )
      expect(cmdBlur.label).toBe("Create blur redaction")

      const pix = makeRegion({ style: "pixelate" })
      const cmdPix = createRedactionCreateCommand(
        pix,
        store.addRegion,
        (id) => store.removeRegion(id),
      )
      expect(cmdPix.label).toBe("Create pixelate redaction")
    })
  })

  describe("RedactionMutateCommand", () => {
    test("execute applies after patch", () => {
      const r = makeRegion({ solidColor: "#000000" })
      store.addRegion(r)
      const cmd = createRedactionMutateCommand(
        r.id,
        { solidColor: "#000000" },
        { solidColor: "#ff0000" },
        store.updateRegion,
      )
      cmd.execute()
      expect(store.regions.value[0].solidColor).toBe("#ff0000")
    })

    test("undo applies before patch", () => {
      const r = makeRegion({ solidColor: "#000000" })
      store.addRegion(r)
      const cmd = createRedactionMutateCommand(
        r.id,
        { solidColor: "#000000" },
        { solidColor: "#ff0000" },
        store.updateRegion,
      )
      cmd.execute()
      cmd.undo()
      expect(store.regions.value[0].solidColor).toBe("#000000")
    })

    test("has correct label and layer", () => {
      const cmd = createRedactionMutateCommand(
        "any-id",
        {},
        {},
        store.updateRegion,
      )
      expect(cmd.label).toBe("Update redaction")
      expect(cmd.layer).toBe("redaction")
    })
  })

  describe("RedactionDeleteCommand", () => {
    test("execute removes region", () => {
      const r = makeRegion()
      store.addRegion(r)
      const cmd = createRedactionDeleteCommand(
        r,
        0,
        (id) => store.removeRegion(id),
        store.insertRegion,
      )
      cmd.execute()
      expect(store.regions.value).toHaveLength(0)
    })

    test("undo restores region at original index", () => {
      const r1 = makeRegion()
      const r2 = makeRegion()
      const r3 = makeRegion()
      store.addRegion(r1)
      store.addRegion(r2)
      store.addRegion(r3)

      // Delete the middle one (index 1)
      const cmd = createRedactionDeleteCommand(
        r2,
        1,
        (id) => store.removeRegion(id),
        store.insertRegion,
      )
      cmd.execute()
      expect(store.regions.value).toHaveLength(2)

      cmd.undo()
      expect(store.regions.value).toHaveLength(3)
      expect(store.regions.value[1].id).toBe(r2.id)
    })

    test("has correct label and layer", () => {
      const r = makeRegion({ style: "pixelate" })
      const cmd = createRedactionDeleteCommand(
        r,
        0,
        (id) => store.removeRegion(id),
        store.insertRegion,
      )
      expect(cmd.label).toBe("Delete pixelate redaction")
      expect(cmd.layer).toBe("redaction")
    })
  })
})

describe("RedactionCanvas component", () => {
  test("component file exists", () => {
    expect(
      existsSync(
        resolve(__dirname, "../src/components/RedactionCanvas.vue"),
      ),
    ).toBe(true)
  })

  const componentFile = readFileSync(
    resolve(__dirname, "../src/components/RedactionCanvas.vue"),
    "utf-8",
  )

  test("uses <script setup lang=\"ts\">", () => {
    expect(componentFile).toContain('<script setup lang="ts">')
  })

  test("imports renderRedactionRegion", () => {
    expect(componentFile).toContain("renderRedactionRegion")
  })

  test("accepts redactionState prop", () => {
    expect(componentFile).toContain("redactionState")
  })

  test("accepts image dimension props", () => {
    expect(componentFile).toContain("imageWidth")
    expect(componentFile).toContain("imageHeight")
  })

  test("accepts base image URL prop", () => {
    expect(componentFile).toContain("baseImageUrl")
  })

  test("uses canvas element", () => {
    expect(componentFile).toContain("<canvas")
  })

  test("has absolute positioning for layer stacking", () => {
    expect(componentFile).toContain("position: absolute")
  })

  test("disables pointer events (pass-through to layers below)", () => {
    expect(componentFile).toContain("pointer-events: none")
  })
})

describe("CanvasViewport integration", () => {
  const viewportFile = readFileSync(
    resolve(__dirname, "../src/components/CanvasViewport.vue"),
    "utf-8",
  )

  test("imports RedactionCanvas", () => {
    expect(viewportFile).toContain("import RedactionCanvas")
  })

  test("includes RedactionCanvas component", () => {
    expect(viewportFile).toContain("<RedactionCanvas")
  })

  test("RedactionCanvas is placed before FreehandCanvas in template", () => {
    const redactionIndex = viewportFile.indexOf("<RedactionCanvas")
    const freehandIndex = viewportFile.indexOf("<FreehandCanvas")
    expect(redactionIndex).toBeGreaterThan(-1)
    expect(freehandIndex).toBeGreaterThan(-1)
    expect(redactionIndex).toBeLessThan(freehandIndex)
  })

  test("passes redaction state from activeTab", () => {
    expect(viewportFile).toContain("activeTab.redactionState")
  })
})

describe("Tab integration", () => {
  const tabFile = readFileSync(
    resolve(__dirname, "../src/types/tab.ts"),
    "utf-8",
  )

  test("Tab interface includes redactionState", () => {
    expect(tabFile).toContain("redactionState")
    expect(tabFile).toContain("RedactionState")
  })

  const tabStoreFile = readFileSync(
    resolve(__dirname, "../src/composables/useTabStore.ts"),
    "utf-8",
  )

  test("tab store imports createRedactionState", () => {
    expect(tabStoreFile).toContain("createRedactionState")
  })

  test("tab store initializes redactionState on tab creation", () => {
    // Should appear at least twice (clipboard tab + editing tab)
    const matches = tabStoreFile.match(/createRedactionState\(\)/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBeGreaterThanOrEqual(2)
  })
})

describe("Export integration", () => {
  const exportFile = readFileSync(
    resolve(__dirname, "../src/composables/useExport.ts"),
    "utf-8",
  )

  test("imports renderRedactionRegion", () => {
    expect(exportFile).toContain("renderRedactionRegion")
  })

  test("includes destructive redaction step", () => {
    expect(exportFile).toContain("redactionState")
    expect(exportFile).toContain("renderRedactionRegion")
  })

  test("redaction is applied before freehand strokes", () => {
    const redactionIndex = exportFile.indexOf("renderRedactionRegion")
    const freehandIndex = exportFile.indexOf("redrawAll")
    expect(redactionIndex).toBeGreaterThan(-1)
    expect(freehandIndex).toBeGreaterThan(-1)
    expect(redactionIndex).toBeLessThan(freehandIndex)
  })

  test("creates separate base canvas for pixel reading", () => {
    // The export should create a separate canvas for base pixel reads
    // to avoid reading already-redacted pixels
    const exportBody = exportFile.slice(
      exportFile.indexOf("Destructive redaction"),
    )
    expect(exportBody).toContain("baseEl")
    expect(exportBody).toContain("baseCtx")
  })
})

describe("Command type integration", () => {
  const commandsFile = readFileSync(
    resolve(__dirname, "../src/types/commands.ts"),
    "utf-8",
  )

  test("Command layer includes 'redaction'", () => {
    expect(commandsFile).toContain('"redaction"')
  })
})
