---
date: 2026-03-20
topic: annotation-layer-architecture
---

# Annotation Layer Architecture

## Problem Frame

ClipJot needs a rendering architecture that supports multiple annotation types (freehand drawing, structured shapes, text, redaction) on top of clipboard images. The architecture must allow structured annotations to be individually selectable, movable, resizable, rotatable, and recolorable after creation, while freehand drawing remains simple paint-and-forget. The redaction tool must be destructive on export (pixels permanently gone) but undoable during a session. The crop tool must be a non-destructive viewport projection.

This is a foundational decision that affects every feature built on top of it: tools, undo/redo, export, tabs, and the data model.

## Requirements

### Layer Model

- R1. The rendering stack uses a fixed four-layer model, bottom to top: **base image -> redaction layer -> freehand canvas -> SVG annotation layer**.
- R2. The base image is the original clipboard image rendered as a read-only raster element. It is never modified directly by any tool.
- R3. The redaction layer sits above the base image. Redaction regions are undoable during the session but permanently destroy underlying pixel data on export (copy to clipboard or save to file).
- R4. The freehand canvas is a transparent overlay canvas for pen, pencil, and marker strokes. Strokes are paint-and-forget -- they cannot be selected or moved as objects.
- R5. The eraser tool operates on the freehand canvas at the pixel level.
- R6. The SVG annotation layer is the topmost layer. Structured annotations (arrows, rectangles, circles, numbered callouts, text) live here as individual SVG elements.
- R7. SVG annotations are individually selectable, movable, resizable, rotatable, recolorable, and deletable after creation.
- R8. The layer order is fixed and not user-configurable.

### Crop

- R9. The crop tool operates as a viewport projection of the entire layer stack. Cropping does not modify any layer's content -- it changes the visible region. All layers are cropped together as a unit.

### Undo/Redo

- R10. A single unified undo/redo stack spans all layers. Undo pops the most recent action regardless of which layer it affected.
- R11. Undoable actions include: freehand stroke creation, SVG object creation/move/resize/rotate/recolor/delete, redaction region creation, and crop changes.

### Export

- R12. All exports (copy to clipboard, save as PNG/JPG) produce a single flattened raster image.
- R13. On export, the redaction layer permanently replaces underlying base image pixels with the redaction fill (solid color, pixelation, or blur). There is no way to recover redacted pixels from the exported image.
- R14. There is no SVG or vector export. Editability exists only within ClipJot's internal tab state while the tab is open.

### Tab Interaction

- R15. Each tab holds its own independent instance of the four-layer stack plus its own undo/redo history.
- R16. Tab duplication creates a deep copy of all layers and the undo history. A "Duplicate" button is available in every tab's toolbar.
- R17. When the clipboard tab is edited, the layer stack is duplicated into a new tab and editing continues there. The clipboard tab reverts to showing the current clipboard content.

### Tab Naming and Display

- R18. Each tab has a user-editable name. The user can rename a tab by double-clicking the tab title.
- R19. The default tab name is the date and time of creation, formatted according to a configurable pattern in settings (e.g., "YYYY-MM-DD HH:mm"). The clipboard tab's name is always "Clipboard."
- R20. When there are more tabs than fit in a single row, the tab bar stacks into multiple rows rather than scrolling or truncating.

## Success Criteria

- Structured annotations (arrows, shapes, text) can be created, then selected and moved/resized/rotated/recolored at any later point during the editing session.
- Freehand strokes render smoothly during drawing and are erasable at the pixel level.
- Redacted regions are visually obvious, undoable in-session, and provably destructive in exported files (no pixel recovery possible).
- Undo/redo works intuitively across all layers in creation order.
- Export produces a clean flattened image indistinguishable from a single-layer bitmap.
- The architecture supports the full tool set described in the ClipJot spec without requiring architectural changes.

## Scope Boundaries

- **No SVG/vector export** -- editability is internal only.
- **No user-configurable layer ordering** -- the four-layer stack is fixed.
- **No freehand stroke selection/movement** -- freehand is paint-and-forget.
- **No inter-layer interactions** -- annotations don't clip to or mask other layers.
- **No collaborative editing or real-time sync** -- single-user desktop app.
- **No session persistence beyond tab lifetime** -- when a tab is closed, its layer state is gone (consistent with ephemeral-by-default philosophy).

## Key Decisions

- **Hybrid rendering (Canvas + SVG):** SVG for structured annotations that need post-creation manipulation; Canvas for freehand drawing that is paint-and-forget. This plays to each technology's strengths rather than forcing one to do everything.
- **Fixed layer order:** Simplifies the mental model and implementation. Users don't need to think about layers -- they just draw and annotate.
- **Redaction as a separate layer:** Allows undo during session while guaranteeing destruction on export. Sitting between base image and freehand means redaction visually appears beneath annotations.
- **Unified undo stack:** Single Cmd+Z works predictably regardless of which tool was used. No layer-awareness required from the user.
- **No vector export:** Keeps the export path simple (flatten and rasterize). Internal editability provides the value without the complexity of a portable vector format.
- **Crop as projection:** Non-destructive crop means uncropping is trivially undo. The crop region is metadata, not a pixel operation.

## Dependencies / Assumptions

- The Tauri v2 webview (WebKit on macOS, WebView2 on Windows) supports both HTML5 Canvas 2D and inline SVG with full interaction (pointer events, transforms).
- SVG rendering performance is adequate for the expected annotation density (typically 5-30 objects per image, not hundreds).
- Canvas 2D context provides sufficient freehand drawing performance for typical screenshot dimensions (up to ~4K).

## Outstanding Questions

### Deferred to Planning

- [Affects R1][Needs research] What is the best way to composite the four layers in the DOM? Options include: stacked absolute-positioned elements, a single parent with CSS layers, or rendering canvas layers offscreen and compositing them.
- [Affects R4][Needs research] Should freehand strokes be stored as path data (for potential future features) even though they render on canvas, or purely as canvas bitmap state?
- [Affects R6][Needs research] Should SVG annotations use raw SVG elements or a lightweight library (e.g., SVG.js, or Vue-native SVG components)?
- [Affects R12][Technical] What rasterization approach should be used for flattening? Options: render all layers to a single offscreen canvas via drawImage, or use html2canvas/dom-to-image, or Rust-side compositing.
- [Affects R7][Technical] How should selection handles, rotation handles, and resize grips be rendered? Overlay SVG elements? Separate UI layer?
- [Affects R16][Technical] What is the most efficient deep-copy strategy for duplicating the layer stack (especially the freehand canvas bitmap)?

## Next Steps

-> /ce:plan for structured implementation planning
