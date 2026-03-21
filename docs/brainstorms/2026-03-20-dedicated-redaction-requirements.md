---
date: 2026-03-20
topic: dedicated-redaction
---

# Dedicated Redaction Tool

## Problem Frame

Users frequently screenshot terminals, dashboards, browser pages, and config files that contain sensitive data: passwords, API keys, email addresses, IP addresses, personal information. A pen-drawn black rectangle or a translucent brush overlay is not redaction — the underlying pixels survive in the layer data. ClipJot needs a purpose-built redaction tool that guarantees the underlying pixel data is permanently destroyed on export, preventing recovery through level adjustment, layer inspection, or any other technique.

## Requirements

### Redaction Styles

- R1. Three redaction styles are available: **solid color fill** (default), **pixelation/mosaic**, and **Gaussian blur**.
- R2. Solid color fill uses an opaque rectangle of a configurable color (default: black).
- R3. Pixelation replaces the underlying region with a mosaic of large blocks. Block size is configurable (default: a reasonable level that obscures text at normal screenshot DPI).
- R4. Gaussian blur applies a strong blur to the underlying region. The blur radius is configurable (default: strong enough to make text unreadable).

### Drawing and Editing

- R5. Redaction regions are drawn as rectangles via click-and-drag.
- R6. No non-rectangular redaction shapes in v1 (no freeform, no circle).
- R7. After creation, redaction rectangles are selectable, movable, resizable, and style-changeable (switch between solid/pixelate/blur, change color for solid fill).
- R8. Redaction rectangles are deletable via selection + delete key or via undo.

### Layer Behavior

- R9. Redaction regions live on the redaction layer, which sits between the base image and the freehand canvas (per the layer architecture: base image -> redaction -> freehand -> SVG).
- R10. During the editing session, redaction is non-destructive — the underlying base image pixels are preserved, and the redaction is rendered as an overlay effect.
- R11. On export (copy to clipboard or save to file), redaction permanently destroys the underlying base image pixels in the exported raster. The redacted regions in the exported file contain only the redaction fill (solid color, pixelated blocks, or blurred pixels). There is no way to recover the original pixel data from the export.
- R12. All redaction operations (create, move, resize, style change, delete) are part of the unified undo/redo stack.

### Visual Distinction

- R13. Redaction rectangles must be visually distinct from regular annotation rectangles. They should have a clear visual indicator (e.g., hatched border, specific icon, or distinct styling) that communicates "this region is being redacted" rather than merely highlighted.

## Success Criteria

- A redacted region in an exported image contains zero recoverable information about the original pixels — verified by inspecting the raw pixel data of the export.
- Users can visually distinguish redaction regions from annotation rectangles at a glance.
- Redaction regions can be repositioned to fine-tune coverage before exporting.
- The redaction tool is discoverable and accessible from the toolbar and menu.

## Scope Boundaries

- **No auto-detection of sensitive content** (OCR/regex) — redaction regions are always manually placed.
- **No non-rectangular redaction shapes** in v1.
- **No redaction applied to annotation layers** — redaction only affects the base image. Annotations (freehand strokes, SVG objects) on top of a redacted region are exported as-is.

## Key Decisions

- **All three styles (solid, pixelate, blur):** Each has its use case. Solid is most secure. Pixelation is the convention in many screenshot tools. Blur looks cleaner but is technically less secure (high-contrast text may be partially recoverable from weak blur — hence a strong default radius).
- **Editable after creation:** Allows repositioning and resizing to get coverage right before export. This is more forgiving than fixed-once-placed and reduces reliance on undo for adjustments.
- **Rectangle only:** Covers 95%+ of redaction use cases (hiding text lines, form fields, status bars). Freeform selection adds significant complexity for marginal gain.
- **Non-destructive during session, destructive on export:** The best of both worlds — full editability during the session, guaranteed pixel destruction in the output.

## Dependencies / Assumptions

- Depends on the annotation layer architecture (brainstorm #1), specifically the redaction layer placement (R3) and export flattening (R12-R13).
- Pixelation and blur effects require access to the underlying base image pixel data at the redaction region's coordinates.
- The export flattening process must apply redaction effects before compositing higher layers (freehand, SVG) to ensure no information leaks through.

## Outstanding Questions

### Deferred to Planning

- [Affects R3][Needs research] What pixelation block size provides good obscurity at typical screenshot DPI (72-144 DPI)? Likely 8-16 pixels but should be validated.
- [Affects R4][Needs research] What Gaussian blur radius makes text unreadable at typical screenshot sizes? Need to test against common font sizes.
- [Affects R10-R11][Technical] During the session, how to render the redaction preview (non-destructive) efficiently? Apply the effect in real-time via canvas compositing, or pre-render the affected region?
- [Affects R11][Technical] At export time, what is the correct layer compositing order to guarantee pixel destruction? Needs to be: read base image pixels -> apply redaction effect -> write result -> composite higher layers on top.

## Next Steps

-> /ce:plan for structured implementation planning
