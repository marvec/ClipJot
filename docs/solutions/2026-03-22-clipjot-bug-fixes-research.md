---
title: "ClipJot Bug Fixes — Post-Implementation Research Summary"
date: 2026-03-22
category: debugging-patterns
tags: [tauri-v2, vue3, canvas, clipboard, retina, shallowRef, css-transform, pointer-events]
---

# ClipJot Bug Fixes — Post-Implementation Research Summary

After completing the 26-unit implementation of ClipJot (Tauri v2 + Vue 3 clipboard image editor), 13 fix commits addressed bugs discovered during manual testing. This document categorizes each fix by root cause, documents the debugging methodology, and extracts reusable lessons.

## Overview

| # | Commit | Category | Severity |
|---|--------|----------|----------|
| 1 | `7e5b81d` | Wiring | Critical |
| 2 | `be0ade6` | Vue Reactivity | Critical |
| 3 | `78a96ff` | Coordinates / Wiring | High |
| 4 | `8c83df0` | Wiring / Permissions | High |
| 5 | `a00f62b` | Timing | Medium |
| 6 | `73a0c8b` | Wiring / WebKit | High |
| 7 | `ecf343f` | CSS Transform | High |
| 8 | `c79662b` | CSS Transform | High |
| 9 | `94b4f9f` | Platform API | Medium |
| 10 | `3384fdc` | CSS / Browser Layout | High |
| 11 | `cfa3fc1` | CSS / Sizing Model | Critical |
| 12 | `b1ca033` | CSS / Layer Sizing | Critical |
| 13 | `9c32225` | UX / Cursor | Low |

---

## Fix 1: No clipboard read on launch, toolbar events disconnected

**Commit:** `7e5b81d`
**Symptom:** App always showed "No image in clipboard" even when an image was in the clipboard. Toolbar buttons (Refresh, Copy, Save, etc.) did nothing when clicked.
**Root cause:** Two independent wiring omissions:
1. `main.ts` initialized the tab store (creating a clipboard tab with `imageUrl: null`) but never called `readClipboardImage()` to populate it.
2. `AppShell.vue` rendered `<Toolbar />` but did not bind any `@event` handlers. All 7 emitted events (`copy`, `save`, `undo`, `redo`, `refresh`, `trim`, `duplicate`) were silently ignored.

**Fix:** Added `readClipboardImage()` call in `main.ts` after app mount. Wired all toolbar events in `AppShell.vue` with handler functions for copy, save, undo, redo, refresh, trim, and duplicate.

**Lesson:** Subagent-generated components may have correct internal logic but missing wiring at the integration layer. Always verify event flow end-to-end after assembling components from parallel agents.

---

## Fix 2: shallowRef reactivity — mutating objects in place

**Commit:** `be0ade6`
**Symptom:** Clipboard image was read successfully (confirmed via console logs) but the UI never updated from the "No image" empty state.
**Root cause:** `useTabStore` used `shallowRef<Tab[]>` for the tabs array. `updateClipboardImage()` mutated the tab object's properties in place (`clipboard.imageUrl = url`) and called `triggerRef(tabs)`. However, `shallowRef` only tracks reference changes — not deep property mutations. The `activeTab` computed (which calls `tabs.value.find(...)`) returned the **same object reference** (just mutated), so Vue's computed caching did not detect the change. The downstream `hasImage` computed (`activeTab.value?.imageUrl != null`) never re-evaluated.

**Fix:** Changed all tab-mutating functions (`updateClipboardImage`, `renameTab`, `markTabEdited`, `markTabCopied`) to use immutable updates: `tabs.value = tabs.value.map(t => t.id === id ? { ...t, ...patch } : t)`. This produces a new array with a new tab object, ensuring the `shallowRef` change propagates through the entire computed chain. Removed `triggerRef` import (no longer needed).

**Lesson:** `shallowRef` + `triggerRef` is unreliable for triggering downstream computed properties that depend on object identity. Prefer immutable array replacement (`map` + spread) when using `shallowRef` for state that feeds computed chains. This is a fundamental Vue 3 reactivity footgun.

---

## Fix 3: Image centering and freehand cursor offset

**Commit:** `78a96ff`
**Symptom:** Image was aligned to top-left instead of centered. Freehand drawing strokes were offset from the mouse cursor position.
**Root cause:**
1. **Centering:** `fitToWindow()` was called on mount, but the viewport element might not have had layout dimensions yet. The `ResizeObserver` callback would eventually fire with correct dimensions, but the initial call could compute with stale sizes.
2. **Cursor offset:** `FreehandCanvas` used `e.offsetX / e.offsetY` (relative to the canvas element) but the canvas was inside a CSS-transformed container (zoom/pan). `offsetX/offsetY` don't account for ancestor CSS transforms.

**Fix:**
1. Added guard in `callFitToWindow()` to skip when viewport has zero dimensions. Added `nextTick` delay on the image URL watcher.
2. Changed `FreehandCanvas` to use `e.clientX - viewportRect.left` (relative to the viewport container's bounding rect), then pass through `screenToImage()` for coordinate transform.

**Lesson:** Never use `offsetX/offsetY` on elements inside CSS-transformed containers. Always convert from `clientX/clientY` relative to a stable ancestor, then apply the inverse transform.

---

## Fix 4: SVG tools, auto-duplication, undo buttons, save permissions, duplicate

**Commit:** `8c83df0`
**Symptom:** Six separate issues reported together:
1. SVG vector tools (rect, ellipse, arrow, line, callout, text) had no action when used
2. Clipboard debug messages cluttered the console
3. New tab was not created when editing the clipboard tab
4. Undo/Redo buttons were always enabled even with empty stack
5. Save button showed dialog but wrote no file
6. Duplicate only copied the base image, not editing state

**Root causes:**
1. No pointer event routing existed for non-freehand tools. `FreehandCanvas` handled freehand tools but nothing handled shape creation, callout placement, etc.
2. Debug `console.log` statements left from investigation.
3. Auto-duplication trigger was missing from the pointer event flow.
4. Toolbar didn't receive `canUndo`/`canRedo` props.
5. Missing `dialog:allow-save` permission in Tauri capabilities — the dialog plugin call was silently denied.
6. `duplicateClipboardTab()` only created a new tab with the same base image, discarding all layer state.

**Fixes:**
1. Added interaction overlay div in `CanvasViewport` with `onOverlayPointerDown` routing events by active tool. `FreehandCanvas` sets `pointer-events: none` when non-freehand tool is active.
2. Removed debug messages.
3. Added `ensureEditingTab()` check before any tool action.
4. Added `canUndo`/`canRedo` props to Toolbar, bound from AppShell.
5. Added `dialog:allow-save` and `dialog:default` permissions to `capabilities/default.json`.
6. Renamed to `duplicateActiveTab()` — deep-copies strokes, annotations, redaction regions, and crop bounds.

**Lesson:** Tauri permissions are silently denied without errors in the console. Always verify capability permissions when plugin API calls appear to do nothing.

---

## Fix 5: Clipboard read timing on startup

**Commit:** `a00f62b`
**Symptom:** After removing debug console.log statements, clipboard reading stopped working on app launch.
**Root cause:** The silent `catch` block in `readClipboardImage()` swallowed errors. The Tauri clipboard plugin may not be fully initialized when the webview loads, causing the initial read to fail. The debug version happened to work because the extra `console.log` calls introduced enough delay for the plugin to initialize.

**Fix:** Restored `console.warn` for clipboard read errors. Added retry with backoff (3 attempts at 200ms, 400ms, 600ms intervals) for the initial clipboard read at startup.

**Lesson:** Never silently swallow errors with empty `catch` blocks, especially for platform API calls that may have initialization timing dependencies. Always log at minimum `console.warn` level. Platform plugins may need a brief delay after webview load.

---

## Fix 6: Six more issues — first stroke, tab naming, crop, drawing bounds, save, redaction

**Commit:** `73a0c8b`
**Symptom:** Six issues discovered during continued testing:
1. First drawing stroke on clipboard tab was silently consumed (tab duplicated but stroke lost)
2. Tab naming pattern from settings was ignored
3. No manual crop tool existed
4. Drawing was possible outside the image boundaries
5. Save dialog appeared but no file was written
6. Redaction pixelate showed black boxes, blur did nothing

**Root causes:**
1. `FreehandCanvas` called `duplicateActiveTab()` then `return` — the pointerdown was consumed without recording the stroke. This is actually correct behavior (component needs to re-render with new tab's props).
2. `createEditingTab()` hardcoded `HH:mm:ss` instead of reading `tabNamePattern` from `useSettings()`.
3. `CropOverlay.vue` component had not been created.
4. No visual clipping on the layers container.
5. `flattenTab()` used `OffscreenCanvasRenderingContext2D` which WebKit doesn't fully support.
6. **Critical WebKit bug:** `OffscreenCanvasRenderingContext2D` does not support `ctx.filter` property in WebKit (Tauri's macOS rendering engine). The blur redaction relied on `ctx.filter = 'blur(40px)'` which silently did nothing. Pixelation failed because `getImageData()` on the offscreen context returned incorrect data.

**Fixes:**
1. Documented as expected UX — first click duplicates, second click draws.
2. Added `formatTabName()` helper reading pattern from `useSettings()`.
3. Created `CropOverlay.vue` with drag-to-select, resize handles, confirm/cancel.
4. (Attempted `overflow: hidden` on layers div — later reverted as it broke transforms.)
5. Changed export pipeline to use `document.createElement('canvas')` instead of `OffscreenCanvas`.
6. Changed `RedactionCanvas.vue` and export pipeline to use regular DOM canvas elements for any context needing `filter` or `getImageData`.

**Lesson:** `OffscreenCanvasRenderingContext2D` in WebKit (Safari/Tauri macOS) has significant limitations compared to regular `CanvasRenderingContext2D`. The `filter` property is not supported, and `getImageData` may behave differently. Always use regular DOM canvases (even hidden ones) when you need `filter`, `clip`, or pixel manipulation on macOS/Tauri.

---

## Fixes 7–12: The image sizing saga

**Commits:** `ecf343f`, `c79662b`, `94b4f9f`, `3384fdc`, `cfa3fc1`, `b1ca033`

This sequence of six commits tackled a single fundamental problem that manifested differently depending on the approach tried. The core challenge: **making the base image, freehand canvas, SVG layer, redaction canvas, and interaction overlay all render at exactly the same visual size inside a CSS-transformed container, across both regular and Retina displays, for images both smaller and larger than the viewport.**

### The problem space

The layers div uses `transform: translate(panX, panY) scale(zoom)` to position and zoom the image. Inside it, multiple elements must overlay perfectly:
- `<img>` — the base image
- `<canvas>` — freehand drawing (buffer resolution = image pixel dimensions)
- `<canvas>` — redaction
- `<svg>` — annotation overlays
- `<div>` — interaction overlay for pointer events

Each of these elements can have its size determined by:
- HTML `width`/`height` attributes
- CSS `width`/`height` properties
- Intrinsic/natural dimensions (for `<img>` and `<canvas>`)
- Parent container sizing with `width: 100%`

On Retina (2× DPR), these interact non-obviously with CSS transforms.

### Approaches tried and their failures

| Attempt | Approach | Failure |
|---------|----------|---------|
| `ecf343f` | Remove `overflow: hidden` from layers div, remove `<img>` width/height attributes | Image renders at natural size — browser auto-scales it to fit container BEFORE CSS transform applies, causing double-scaling |
| `c79662b` | Set CSS `style="width: Xpx; height: Ypx"` on `<img>` | Aspect ratio broke because `image.size()` from Tauri clipboard returned logical (point) dimensions on Retina while the PNG blob encoded at physical pixel dimensions |
| `94b4f9f` | Verify blob dimensions via `createImageBitmap()` after PNG creation | Fixed the dimension mismatch but didn't solve the sizing itself |
| `3384fdc` | Use HTML `width`/`height` attributes on `<img>` | Browser still auto-scaled the image within its container, causing distortion for large images |
| `cfa3fc1` | Set explicit pixel dimensions on the **layers container div**, use `width: 100%; height: 100%` on `<img>` | Correct aspect ratio, but canvas layers still had their own explicit pixel sizes causing mismatch |
| `b1ca033` | **All layers** use `width: 100%; height: 100%` from parent | **Working solution** |

### The final architecture

```
.canvas-viewport (flex: 1, overflow: hidden, position: relative)
  └── .canvas-viewport__layers (position: absolute, width: Wpx, height: Hpx, transform: translate scale)
      ├── <img>            (width: 100%, height: 100%)
      ├── <canvas> redact  (width: 100%, height: 100%, buffer: W×H)
      ├── <canvas> freehand(width: 100%, height: 100%, buffer: W×H)
      ├── <svg> annotations(width: 100%, height: 100%, viewBox: 0 0 W H)
      └── <div> interaction(width: 100%, height: 100%)
```

**Key principles:**
1. The **layers div** is the single source of truth for pixel dimensions (set via inline style from `imageWidth`/`imageHeight` in tab store).
2. **All child layers** use `width: 100%; height: 100%` CSS to fill the parent — no explicit pixel sizes on children.
3. Canvas **buffer** dimensions (`canvas.width/height`) are set to image pixel dimensions in JavaScript — this controls the drawing resolution, separate from CSS display size.
4. The CSS `transform: translate(pan) scale(zoom)` on the layers div is the **sole control** for visual sizing and positioning.
5. `imageWidth`/`imageHeight` in the tab store are verified against the actual PNG blob dimensions via `createImageBitmap()` in `readClipboardImage()`.

**Lesson:** In a multi-layer canvas/SVG/HTML stack inside a CSS-transformed container, establish a single parent element as the dimension authority. All children should inherit sizing via `100%`, never set their own pixel dimensions in CSS. Canvas buffer dimensions (for drawing resolution) are independent of CSS display dimensions and must be set separately in JavaScript.

---

## Fix 13: Select tool cursor

**Commit:** `9c32225`
**Symptom:** The select tool displayed a crosshair cursor. When switching from select to pen, the cursor showed the selection arrow and behaved like the select tool.
**Root cause:** The interaction overlay had `cursor: crosshair` hardcoded in CSS, applied regardless of the active tool. When the select tool was active, the overlay captured pointer events (correct) but showed crosshair (wrong). The apparent "tool swap" behavior was because `FreehandCanvas` and the interaction overlay alternated which one had `pointer-events: auto` based on the tool, but the cursor styles didn't match.

**Fix:** Made the cursor dynamic via computed property: `default` for select, `text` for text/callout, `crosshair` for drawing tools. Removed the hardcoded CSS cursor.

**Lesson:** When pointer events are routed between different overlay elements based on state, cursor styles must also be dynamically managed on each overlay to match the active behavior.

---

## Cross-Cutting Themes

### 1. Parallel agent assembly requires integration verification
Fixes 1 and 4 both involved components that worked correctly in isolation but were not wired together at the integration layer. When using parallel subagents, each agent validates its own unit but cannot verify cross-component wiring.

### 2. Vue shallowRef is a reactivity footgun
Fix 2 revealed that `shallowRef` + `triggerRef` doesn't reliably propagate through computed chains that compare object identity. Prefer immutable updates (`map` + spread) over mutation + `triggerRef`.

### 3. WebKit OffscreenCanvas limitations
Fix 6 discovered that `OffscreenCanvasRenderingContext2D` in WebKit (Safari/Tauri macOS) doesn't support `ctx.filter`. This is not documented prominently. Use regular DOM canvases for any filter, clip, or pixel manipulation on macOS.

### 4. CSS transforms and multi-layer sizing
Fixes 7–12 demonstrated that sizing elements inside a CSS-transformed container is subtle. The principle: one parent sets explicit dimensions, all children inherit via `100%`, the CSS transform is the sole visual size control.

### 5. Tauri permission failures are silent
Fix 4 (save button) showed that missing Tauri capability permissions cause API calls to silently fail — no errors, no console warnings. Always audit permissions when plugin APIs appear non-functional.

### 6. Platform API timing
Fix 5 showed that Tauri plugins may not be ready when the webview first loads. Retry with backoff is necessary for startup-critical API calls.
