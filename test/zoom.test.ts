import { describe, test, expect } from "bun:test"
import { ref } from "vue"
import { createViewportContext } from "../src/composables/useZoom"

describe("Viewport Context / Zoom", () => {
  test("screenToImage at 1:1 scale with no pan", () => {
    const ctx = createViewportContext(ref(1920), ref(1080))
    ctx.scale.value = 1
    ctx.panX.value = 0
    ctx.panY.value = 0

    const result = ctx.screenToImage(100, 200)
    expect(result.x).toBe(100)
    expect(result.y).toBe(200)
  })

  test("screenToImage at 2x zoom", () => {
    const ctx = createViewportContext(ref(1920), ref(1080))
    ctx.scale.value = 2
    ctx.panX.value = 0
    ctx.panY.value = 0

    const result = ctx.screenToImage(200, 400)
    expect(result.x).toBe(100)
    expect(result.y).toBe(200)
  })

  test("screenToImage with pan offset", () => {
    const ctx = createViewportContext(ref(1920), ref(1080))
    ctx.scale.value = 1
    ctx.panX.value = 50
    ctx.panY.value = 100

    const result = ctx.screenToImage(150, 300)
    expect(result.x).toBe(100)
    expect(result.y).toBe(200)
  })

  test("screenToImage with zoom + pan", () => {
    const ctx = createViewportContext(ref(1920), ref(1080))
    ctx.scale.value = 2
    ctx.panX.value = 50
    ctx.panY.value = 100

    const result = ctx.screenToImage(250, 500)
    expect(result.x).toBe(100)
    expect(result.y).toBe(200)
  })

  test("imageToScreen is the inverse of screenToImage", () => {
    const ctx = createViewportContext(ref(1920), ref(1080))
    ctx.scale.value = 1.5
    ctx.panX.value = 30
    ctx.panY.value = 60

    const imagePoint = { x: 100, y: 200 }
    const screen = ctx.imageToScreen(imagePoint.x, imagePoint.y)
    const backToImage = ctx.screenToImage(screen.x, screen.y)

    expect(Math.abs(backToImage.x - imagePoint.x)).toBeLessThan(0.001)
    expect(Math.abs(backToImage.y - imagePoint.y)).toBeLessThan(0.001)
  })

  test("setZoom clamps to min/max range", () => {
    const ctx = createViewportContext(ref(1920), ref(1080))

    ctx.setZoom(0.01) // Below min 0.05
    expect(ctx.scale.value).toBe(0.05)

    ctx.setZoom(10) // Above max 8.0
    expect(ctx.scale.value).toBe(8)

    ctx.setZoom(2) // Within range
    expect(ctx.scale.value).toBe(2)
  })

  test("fitToWindow calculates correct scale", () => {
    const ctx = createViewportContext(ref(1920), ref(1080))
    ctx.fitToWindow(960, 540) // Half the image size

    expect(ctx.scale.value).toBe(0.5)
  })

  test("fitToWindow centers the image", () => {
    const ctx = createViewportContext(ref(1920), ref(1080))
    // Viewport is wider than image aspect ratio
    ctx.fitToWindow(1920, 540)

    // Scale should be limited by height: 540/1080 = 0.5
    expect(ctx.scale.value).toBe(0.5)
    // Scaled width = 1920 * 0.5 = 960, viewport = 1920, offset = (1920-960)/2 = 480
    expect(ctx.panX.value).toBe(480)
    expect(ctx.panY.value).toBe(0)
  })

  test("fitToWindow never zooms above 100%", () => {
    const ctx = createViewportContext(ref(400), ref(300))
    ctx.fitToWindow(1920, 1080) // Viewport much larger than image

    expect(ctx.scale.value).toBe(1) // Should cap at 1, not 4.8
  })

  test("fitToWindow handles zero dimensions", () => {
    const ctx = createViewportContext(ref(0), ref(0))
    ctx.fitToWindow(1920, 1080)

    expect(ctx.scale.value).toBe(1)
    expect(ctx.panX.value).toBe(0)
    expect(ctx.panY.value).toBe(0)
  })

  test("fitToWindow centers small image in large viewport", () => {
    const ctx = createViewportContext(ref(400), ref(300))
    ctx.fitToWindow(1920, 1080)

    // Scale capped at 1, image centered
    expect(ctx.scale.value).toBe(1)
    expect(ctx.panX.value).toBe((1920 - 400) / 2)
    expect(ctx.panY.value).toBe((1080 - 300) / 2)
  })

  test("transformStyle produces correct CSS", () => {
    const ctx = createViewportContext(ref(1920), ref(1080))
    ctx.scale.value = 1.5
    ctx.panX.value = 30
    ctx.panY.value = 60

    expect(ctx.transformStyle.value).toBe(
      "translate(30px, 60px) scale(1.5)",
    )
  })
})
