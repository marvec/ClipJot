import { readImage, writeImage } from "@tauri-apps/plugin-clipboard-manager"
import { Image } from "@tauri-apps/api/image"

export interface ClipboardImage {
  url: string
  width: number
  height: number
}

/**
 * Read the current clipboard image.
 * Returns a blob URL for display plus dimensions, or null if no image.
 */
export async function readClipboardImage(): Promise<ClipboardImage | null> {
  try {
    const image = await readImage()
    const rgba = await image.rgba()
    const { width, height } = await image.size()

    // Convert RGBA Uint8Array to displayable blob URL via OffscreenCanvas
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext("2d")!
    const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height)
    ctx.putImageData(imageData, 0, 0)
    const blob = await canvas.convertToBlob({ type: "image/png" })
    const url = URL.createObjectURL(blob)

    return { url, width, height }
  } catch (err) {
    console.warn("[ClipJot] Clipboard read failed:", err)
    return null
  }
}

/**
 * Write image data to the clipboard.
 * Accepts raw RGBA Uint8Array with dimensions.
 */
export async function writeClipboardImage(
  rgba: Uint8Array,
  width: number,
  height: number,
): Promise<void> {
  const image = await Image.new(rgba, width, height)
  await writeImage(image)
}
