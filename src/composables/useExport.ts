import type { Tab } from "../types/tab"
import type { Annotation } from "../types/annotations"
import { renderRedactionRegion } from "./useRedaction"
import { sanitizeHtml } from "./useTextEditing"

export interface ExportResult {
  blob: Blob
  width: number
  height: number
}

/**
 * Resolve a color string, stripping any CSS `var()` wrapper.
 * Annotations should already store resolved hex (Appendix A.4), but this
 * guard prevents CSS variables from leaking into serialized SVG contexts
 * where `var()` references cannot be evaluated.
 */
export function resolveCssColor(color: string): string {
  if (!color.startsWith("var(")) return color
  // Extract fallback from var(--name, fallback)
  const match = color.match(/var\([^,]+,\s*(.+)\)/)
  if (match) return match[1].trim()
  // No fallback — return black as safe default
  return "#000000"
}

/**
 * Load an image from a URL using fetch + createImageBitmap (Appendix B.7).
 * Avoids the legacy Image() + onload pattern for better performance
 * and compatibility with OffscreenCanvas workflows.
 */
async function loadImageBitmap(src: string): Promise<ImageBitmap> {
  const response = await fetch(src)
  const blob = await response.blob()
  return createImageBitmap(blob)
}

/**
 * Flatten a tab's layers into a single PNG blob.
 *
 * Layer compositing order (Unit 23):
 *   1. Base image
 *   2. Redaction regions (destructive — permanently baked into pixels)
 *   3. Freehand strokes
 *   4. SVG annotations (rect, ellipse, arrow, line, callout, text)
 *
 * Text annotations are batched into the single SVG render pass (Appendix B.8)
 * via serializeAnnotationsToSvg, which handles all annotation types including
 * text via foreignObject. No separate text rendering pass is needed.
 *
 * If crop bounds are set, the export canvas is sized to the crop region
 * and only that portion of the composited image is exported.
 *
 * PNG metadata stripping is a known limitation deferred to v2.
 */
export async function flattenTab(tab: Tab): Promise<ExportResult> {
  if (!tab.imageUrl) {
    throw new Error("No image to export")
  }

  // Load the base image via fetch + createImageBitmap (B.7)
  const img = await loadImageBitmap(tab.imageUrl)
  const imgW = img.width
  const imgH = img.height

  // Create full-size working canvas — all layers render at original dimensions
  const canvas = new OffscreenCanvas(imgW, imgH)
  const ctx = canvas.getContext("2d")!

  // ── Layer 1: Base image ──
  ctx.drawImage(img, 0, 0)
  img.close()

  // ── Layer 2: Destructive redaction ──
  // Permanently flatten redaction regions onto the base pixels.
  // Use regular (non-offscreen) canvases because OffscreenCanvasRenderingContext2D
  // doesn't support ctx.filter in WebKit, breaking blur redaction.
  if (tab.redactionState.regions.value.length > 0) {
    // Base canvas for pixel reading (unmodified source for pixelate/blur)
    const baseEl = document.createElement("canvas")
    baseEl.width = imgW
    baseEl.height = imgH
    const baseCtx = baseEl.getContext("2d")!
    baseCtx.drawImage(canvas, 0, 0)

    // Redaction target — draw onto a regular canvas, then composite back
    const redactEl = document.createElement("canvas")
    redactEl.width = imgW
    redactEl.height = imgH
    const redactCtx = redactEl.getContext("2d")!
    redactCtx.drawImage(canvas, 0, 0)

    for (const region of tab.redactionState.regions.value) {
      renderRedactionRegion(redactCtx, region, baseCtx)
    }

    // Composite redacted result back to the offscreen export canvas
    ctx.clearRect(0, 0, imgW, imgH)
    ctx.drawImage(redactEl, 0, 0)
  }

  // ── Layer 3: Freehand strokes ──
  if (tab.drawingState.strokes.value.length > 0) {
    const freehandEl = document.createElement("canvas")
    freehandEl.width = imgW
    freehandEl.height = imgH
    const freehandCtx = freehandEl.getContext("2d")!
    tab.drawingState.redrawAll(freehandCtx, imgW, imgH)
    ctx.drawImage(freehandEl, 0, 0)
  }

  // ── Layer 4: SVG annotations (all types including text) ──
  // All annotation types (rect, ellipse, arrow, line, callout, text) are
  // batched into a single SVG and rasterized in one pass (Appendix B.8).
  if (tab.annotationState.annotations.value.length > 0) {
    const svgBitmap = await renderAnnotationsToImage(
      tab.annotationState.annotations.value,
      imgW,
      imgH,
    )
    ctx.drawImage(svgBitmap, 0, 0)
    svgBitmap.close()
  }

  // ── Crop extraction ──
  // If crop bounds are set, extract only the cropped region.
  // Otherwise export the full canvas.
  const crop = tab.cropState.cropBounds.value
  if (crop) {
    const exportCanvas = new OffscreenCanvas(crop.width, crop.height)
    const exportCtx = exportCanvas.getContext("2d")!
    exportCtx.drawImage(
      canvas,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height,
    )
    const blob = await exportCanvas.convertToBlob({ type: "image/png" })
    return { blob, width: crop.width, height: crop.height }
  }

  const blob = await canvas.convertToBlob({ type: "image/png" })
  return { blob, width: imgW, height: imgH }
}

/**
 * Copy the flattened image to the system clipboard.
 *
 * Follows atomic export pattern (Appendix A.5):
 *   1. Flatten to blob in memory — clipboard is UNTOUCHED
 *   2. Convert blob to RGBA for Tauri's clipboard API
 *   3. Write to clipboard — only now do we modify the clipboard
 *
 * If flatten fails (step 1), the clipboard is never cleared,
 * so the user never loses their current clipboard content.
 */
export async function copyTabToClipboard(tab: Tab): Promise<void> {
  // Step 1: Flatten to blob in memory (atomic — clipboard untouched)
  const { blob } = await flattenTab(tab)

  // Step 2: Convert PNG blob to RGBA for Tauri's clipboard API
  const bitmap = await createImageBitmap(blob)
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const rgba = new Uint8Array(imageData.data.buffer)

  // Step 3: Write to clipboard (only now do we touch the clipboard)
  const { writeClipboardImage } = await import("./useClipboard")
  await writeClipboardImage(rgba, canvas.width, canvas.height)
}

/**
 * Save the flattened image to a file on disk via Tauri's backend.
 *
 * Follows atomic export pattern (Appendix A.5):
 *   1. Flatten to blob in memory
 *   2. Convert blob to byte array
 *   3. Write bytes to file via Tauri invoke
 *
 * @param tab - Tab to export
 * @param filePath - Absolute path to write the PNG file to
 */
export async function saveTabToFile(
  tab: Tab,
  filePath: string,
): Promise<void> {
  // Step 1: Flatten to blob in memory
  const { blob } = await flattenTab(tab)

  // Step 2: Convert blob to byte array
  const arrayBuffer = await blob.arrayBuffer()
  const data = Array.from(new Uint8Array(arrayBuffer))

  // Step 3: Write to file via Tauri backend
  const { invoke } = await import("@tauri-apps/api/core")
  await invoke("write_file", { path: filePath, data })
}

/**
 * Serialize annotations into an SVG string with resolved hex colors.
 *
 * All color values are passed through resolveCssColor() to guard against
 * CSS `var()` references leaking into serialized SVG (Appendix A.4).
 * Annotation data SHOULD already store resolved hex, but this is a safety net.
 *
 * Text annotations are included via foreignObject (Appendix B.8: batch all
 * text into a single SVG for a single rasterization pass).
 */
export function serializeAnnotationsToSvg(
  annotations: Annotation[],
  width: number,
  height: number,
): string {
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  ]

  for (const a of annotations) {
    switch (a.type) {
      case "rect": {
        const stroke = resolveCssColor(a.strokeColor)
        const fillColor = resolveCssColor(a.fillColor)
        const fill = a.fill
          ? `fill="${fillColor}" fill-opacity="${a.fillOpacity}"`
          : 'fill="none"'
        parts.push(
          `<rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" stroke="${stroke}" stroke-width="${a.strokeWidth}" ${fill}/>`,
        )
        break
      }
      case "ellipse": {
        const stroke = resolveCssColor(a.strokeColor)
        const fillColor = resolveCssColor(a.fillColor)
        const cx = a.x + a.width / 2
        const cy = a.y + a.height / 2
        const rx = a.width / 2
        const ry = a.height / 2
        const fill = a.fill
          ? `fill="${fillColor}" fill-opacity="${a.fillOpacity}"`
          : 'fill="none"'
        parts.push(
          `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" stroke="${stroke}" stroke-width="${a.strokeWidth}" ${fill}/>`,
        )
        break
      }
      case "arrow": {
        const stroke = resolveCssColor(a.strokeColor)
        const midX = (a.x + a.endX) / 2
        const midY = (a.y + a.endY) / 2
        const cpX = midX + a.controlX
        const cpY = midY + a.controlY
        parts.push(
          `<path d="M ${a.x} ${a.y} Q ${cpX} ${cpY} ${a.endX} ${a.endY}" fill="none" stroke="${stroke}" stroke-width="${a.strokeWidth}" stroke-linecap="round"/>`,
        )
        break
      }
      case "line": {
        const stroke = resolveCssColor(a.strokeColor)
        parts.push(
          `<line x1="${a.x}" y1="${a.y}" x2="${a.endX}" y2="${a.endY}" stroke="${stroke}" stroke-width="${a.strokeWidth}" stroke-linecap="round"/>`,
        )
        break
      }
      case "callout": {
        const stroke = resolveCssColor(a.strokeColor)
        const fillColor = resolveCssColor(a.fillColor)
        parts.push(
          `<circle cx="${a.x}" cy="${a.y}" r="${a.radius}" fill="${fillColor}" stroke="${stroke}" stroke-width="${a.strokeWidth}"/>`,
        )
        parts.push(
          `<text x="${a.x}" y="${a.y}" text-anchor="middle" dominant-baseline="central" fill="${stroke}" font-size="${a.radius}" font-family="sans-serif">${a.number}</text>`,
        )
        break
      }
      case "text": {
        const stroke = resolveCssColor(a.strokeColor)
        const fillColor = resolveCssColor(a.fillColor)
        const bgFill = a.fill ? `background-color: ${fillColor};` : ""
        const borderStyle =
          a.strokeWidth > 0
            ? `border: ${a.strokeWidth}px solid ${stroke};`
            : ""
        const safeHtml = sanitizeHtml(a.htmlContent)
        parts.push(
          `<foreignObject x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}">` +
            `<div xmlns="http://www.w3.org/1999/xhtml" style="` +
            `font-family: ${a.fontFamily}; font-size: ${a.fontSize}px; ` +
            `color: ${stroke}; ${bgFill} ${borderStyle} ` +
            `width: ${a.width}px; height: ${a.height}px; ` +
            `padding: 4px; box-sizing: border-box; ` +
            `word-wrap: break-word; white-space: pre-wrap; line-height: 1.4; ` +
            `overflow: hidden;">` +
            safeHtml +
            `</div>` +
            `</foreignObject>`,
        )
        break
      }
    }
  }

  parts.push("</svg>")
  return parts.join("")
}

/**
 * Render annotations to an ImageBitmap for compositing onto the export canvas.
 * Builds SVG from annotation data (resolved hex colors), then rasterizes
 * via Blob + createImageBitmap.
 */
async function renderAnnotationsToImage(
  annotations: Annotation[],
  width: number,
  height: number,
): Promise<ImageBitmap> {
  const svgString = serializeAnnotationsToSvg(annotations, width, height)
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" })
  return createImageBitmap(blob)
}
