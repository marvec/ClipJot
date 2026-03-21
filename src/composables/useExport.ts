import type { Tab } from "../types/tab"

export interface ExportResult {
  blob: Blob
  width: number
  height: number
}

/**
 * Flatten a tab's layers into a single PNG blob.
 * Draws base image, then freehand strokes on top.
 * Will be extended as more layers (SVG, redaction) are implemented.
 */
export async function flattenTab(tab: Tab): Promise<ExportResult> {
  if (!tab.imageUrl) {
    throw new Error("No image to export")
  }

  // Load the base image
  const img = await loadImage(tab.imageUrl)

  // Create offscreen canvas at image dimensions
  const canvas = new OffscreenCanvas(img.width, img.height)
  const ctx = canvas.getContext("2d")!

  // Draw base image
  ctx.drawImage(img, 0, 0)

  // Future: draw redaction layer (destructive)

  // Draw freehand strokes onto a temporary canvas, then composite
  if (tab.drawingState.strokes.value.length > 0) {
    const freehandCanvas = new OffscreenCanvas(img.width, img.height)
    const freehandCtx = freehandCanvas.getContext("2d")!
    tab.drawingState.redrawAll(
      freehandCtx as unknown as CanvasRenderingContext2D,
      img.width,
      img.height,
    )
    ctx.drawImage(freehandCanvas, 0, 0)
  }

  // Future: draw SVG annotations
  // Future: draw text overlays

  // Export as PNG
  const blob = await canvas.convertToBlob({ type: "image/png" })

  return {
    blob,
    width: img.width,
    height: img.height,
  }
}

/**
 * Copy the flattened image to the system clipboard.
 * Follows atomic export pattern: flatten FIRST, then write.
 * Never clears clipboard before the blob is ready.
 */
export async function copyTabToClipboard(tab: Tab): Promise<void> {
  // Step 1: Flatten to blob in memory (atomic — clipboard untouched)
  const { blob } = await flattenTab(tab);

  // Step 2: Convert PNG blob to RGBA for Tauri's clipboard API
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const rgba = new Uint8Array(imageData.data.buffer);

  // Step 3: Write to clipboard (only now do we touch the clipboard)
  const { writeClipboardImage } = await import("./useClipboard");
  await writeClipboardImage(rgba, canvas.width, canvas.height);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}
