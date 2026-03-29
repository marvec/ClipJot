import type { AspectRatioPreset } from "../types/tools"

/**
 * Resolve an aspect ratio preset to a numeric width/height ratio.
 * Returns null for "free" (no constraint).
 */
export function resolveAspectRatio(
  preset: AspectRatioPreset,
  imageWidth: number,
  imageHeight: number,
): number | null {
  switch (preset) {
    case "free":
      return null
    case "original":
      return imageWidth / imageHeight
    case "16:9":
      return 16 / 9
    case "4:3":
      return 4 / 3
    case "1:1":
      return 1
  }
}

/**
 * Constrain width/height to an aspect ratio.
 * If ratio is null, returns dimensions unchanged.
 * Shrinks the larger dimension to fit the ratio.
 */
export function constrainToRatio(
  width: number,
  height: number,
  ratio: number | null,
): { width: number; height: number } {
  if (ratio === null) return { width, height }

  const currentRatio = width / height
  if (currentRatio > ratio) {
    // Too wide — shrink width
    return { width: height * ratio, height }
  } else {
    // Too tall — shrink height
    return { width, height: width / ratio }
  }
}
