---
title: "feat: ClipJot v1 Full Implementation"
type: feat
status: active
date: 2026-03-21
origin: docs/brainstorms/ (8 requirements documents dated 2026-03-20)
---

# feat: ClipJot v1 Full Implementation

## Overview

Build ClipJot from the current Tauri v2 + Vue 3 scaffold template into a fully functional clipboard image annotation desktop app. The app reads images from the clipboard, provides freehand drawing tools, structured SVG annotation primitives (arrows, shapes, callouts, rich text), a dedicated redaction tool, auto-crop/smart trim, and copies the flattened result back to the clipboard. The architecture uses a fixed four-layer rendering stack (base image → redaction → freehand canvas → SVG annotations), a tab system with ephemeral-by-default philosophy, per-tool remembered settings, and system integration via global hotkey and system tray.

## Problem Frame

ClipJot's codebase is currently the stock Tauri scaffolding template. No application-specific features exist. Eight requirements documents define the complete product vision. This plan transforms those requirements into a phased, dependency-ordered implementation plan that delivers testable milestones, starting with the minimum viable clipboard round-trip and building outward to the full feature set.

## Requirements Trace

All requirements are sourced from the eight brainstorm documents in `docs/brainstorms/`:

- **Layer Architecture** (R1–R17): Fixed four-layer model, unified undo/redo, export flattening, tab interaction (see origin: `docs/brainstorms/2026-03-20-annotation-layer-architecture-requirements.md`)
- **Annotation Primitives** (R1–R25): Bendable arrow, line, rectangle, circle, numbered callout, rich text box (see origin: `docs/brainstorms/2026-03-20-annotation-primitives-requirements.md`)
- **Ephemeral-by-Default** (R1–R11): Clipboard round-trip, auto-copy on close, close-warning, tab "copied" indicator (see origin: `docs/brainstorms/2026-03-20-ephemeral-by-default-requirements.md`)
- **Auto-Crop / Smart Trim** (R1–R9): Border detection, trim overlay, crop-as-projection (see origin: `docs/brainstorms/2026-03-20-auto-crop-smart-trim-requirements.md`)
- **Dedicated Redaction** (R1–R13): Three redaction styles, non-destructive during session, destructive on export (see origin: `docs/brainstorms/2026-03-20-dedicated-redaction-requirements.md`)
- **Tool Configuration** (R1–R22): Per-tool remembered settings, inline sub-toolbar, color picker (see origin: `docs/brainstorms/2026-03-20-tool-configuration-requirements.md`)
- **Global Hotkey** (R1–R8): System-wide shortcut, instant window activation (see origin: `docs/brainstorms/2026-03-20-global-hotkey-requirements.md`)
- **Design System** (R1–R40): Flexoki semantic tokens, component inventory, layout architecture (see origin: `docs/brainstorms/2026-03-20-design-system-requirements.md`)

## Scope Boundaries

- **macOS primary, Windows secondary** — develop and test on macOS first; Windows is supported but not the primary development target
- **No mobile support** — desktop only per Tauri configuration
- **No SVG/vector export** — editability is internal only; export is always flattened raster
- **No session persistence** — tabs are ephemeral; no crash recovery or session restore
- **No collaborative editing** — single-user desktop app
- **No user-configurable layer ordering** — the four-layer stack is fixed
- **No freehand stroke selection/movement** — freehand is paint-and-forget
- **No auto-detect sensitive content** — redaction is always manually placed
- **No content-aware cropping** — only uniform-color border detection
- **No cross-session tool settings persistence** — settings reset on app restart

## Context & Research

### Relevant Code and Patterns

- **Tauri scaffold**: `src-tauri/src/lib.rs` has the plugin registration pattern. Currently registers `clipboard-manager`, `autostart`, and `opener` plugins
- **Vue entry**: `src/App.vue` is the template greeting demo. `src/main.ts` is the app entry point
- **Flexoki CSS**: `src/assets/flexoki.css` provides all color primitives as CSS custom properties (131 variables)
- **Capabilities**: `src-tauri/capabilities/default.json` grants `clipboard-manager:default`; `desktop.json` grants `autostart:default`
- **TypeScript**: Strict mode enabled, `noUnusedLocals`, `noUnusedParameters`
- **Build**: Bun for all commands per AGENTS.md

### External References

- **Tauri v2 Clipboard**: `readImage()` returns RGBA `Uint8Array` via `@tauri-apps/plugin-clipboard-manager`; `writeImage()` accepts raw pixel buffer
- **Tauri v2 Global Shortcut**: `register('CommandOrControl+Shift+J', handler)` via `@tauri-apps/plugin-global-shortcut`
- **Tauri v2 System Tray**: `TrayIcon.new({ menu, menuOnLeftClick })` via `@tauri-apps/api/tray`
- **foreignObject Research** (from prior session): SVG `<foreignObject>` has 56 open WebKit bugs — **do not use** for rich text in SVG. Use HTML overlay approach instead

### Institutional Learnings

No `docs/solutions/` directory exists yet. Clean slate.

## Key Technical Decisions

- **Hybrid rendering (Canvas + SVG + HTML overlay)**: Canvas for freehand drawing (paint-and-forget), SVG for structured annotations (individually manipulable), HTML overlay for rich text editing (avoids foreignObject WebKit bugs). Each technology plays to its strengths.

- **Layer compositing via stacked absolute-positioned elements**: The simplest DOM approach. A relative-positioned container holds: `<img>` (base) → `<canvas>` (redaction) → `<canvas>` (freehand) → `<svg>` (annotations) → `<div>` (text editing overlay). Z-index ordering matches the layer model.

- **Vue-native SVG components (no library)**: Vue 3's reactivity maps naturally to SVG elements. Each annotation type is a Vue component rendering SVG primitives. Reactivity handles updates. No need for SVG.js or similar.

- **Rich text via HTML overlay, NOT foreignObject**: The foreignObject research found 56 open WebKit bugs including broken transforms, stacking context issues, and pointer event failures in Safari. Since Tauri uses WebKit on macOS (the primary target), foreignObject is a non-starter. Instead: absolutely-position a `contenteditable` div over the SVG layer, synced to the annotation's viewport coordinates. On export, render the text content to an intermediate canvas for flattening.

- **Export flattening via offscreen canvas drawImage**: Draw each layer onto a single offscreen `<canvas>` in order. For the SVG layer: serialize with `XMLSerializer` → create `Image` from data URI → `drawImage()`. For text overlays: render to intermediate canvas first. Avoids html2canvas (taint issues).

- **Border detection in Rust backend**: More performant for large images (4K screenshots). The Rust side processes raw pixel data directly. Communication via Tauri IPC command returns the detected trim bounds as `{ top, right, bottom, left }`.

- **Per-channel RGB threshold for auto-trim**: `max(|r1-r2|, |g1-g2|, |b1-b2|) <= threshold`. Default threshold: 10. Handles JPEG artifacts without complex deltaE calculations.

- **Command pattern for undo/redo**: Each undoable action implements `execute()` and `undo()`. A single shared stack spans all layers. Actions are serializable objects stored in a per-tab history.

- **Vue composables for state (no Pinia)**: A `useTabStore()` composable manages the tab array. Each tab holds its layer state, undo history, and metadata. Pinia would add unnecessary abstraction at this scale.

- **Quadratic Bezier for arrows**: One control point is sufficient for annotation routing. Vue component renders SVG `<path>` with `Q` command. The control point is draggable.

- **Auto-renumber callouts on delete**: Scan all callout annotations in the current tab and reassign numbers sequentially. Simple and correct for the expected annotation density (5-30 objects).

## Open Questions

### Resolved During Planning

- **DOM compositing approach?** → Stacked absolute-positioned elements (simplest, well-understood)
- **Freehand strokes as path data or canvas bitmap?** → Canvas bitmap. Requirements say "paint-and-forget" — no need to store vector paths
- **SVG library vs. raw components?** → Vue-native SVG components. Vue's reactivity is the library
- **Rich text approach?** → HTML overlay (foreignObject is broken on WebKit/Safari)
- **Rasterization for export?** → Offscreen canvas `drawImage()` per layer
- **Border detection: frontend or Rust?** → Rust backend (faster, direct pixel access)
- **Color distance metric?** → Per-channel RGB threshold (simple, effective for screenshots)
- **Selection handles rendering?** → SVG overlay elements within the annotation SVG layer

### Deferred to Implementation

- **Exact default tool colors**: Need to test Flexoki colors for annotation visibility on typical screenshot backgrounds during implementation
- **Pixelation block size**: Requirements suggest 8-16px for typical DPI; exact default to be validated visually
- **Gaussian blur radius**: Requirements call for "strong enough to make text unreadable"; exact default to be validated visually
- **Titlebar approach**: Custom vs. native — start with native system titlebar; revisit if cross-platform consistency requires custom
- **Icon set**: Lucide icons recommended (MIT license, comprehensive, Vue component library available) — confirm during toolbar implementation
- **Clipboard image read latency**: If `readImage()` takes >100ms for 4K images, add a brief loading indicator. Test during Phase 1

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### Layer Stack DOM Structure

```
┌─────────────────────────────────────┐
│ <div class="canvas-viewport">       │  ← relative container, fills space
│   <img>                             │  ← base image (read-only)
│   <canvas id="redaction">           │  ← redaction layer (absolute)
│   <canvas id="freehand">            │  ← freehand drawing (absolute)
│   <svg id="annotations">            │  ← SVG annotation objects (absolute)
│     <g class="annotations">         │
│       <ArrowAnnotation />           │
│       <RectAnnotation />            │
│       <CalloutAnnotation />         │
│       ...                           │
│     </g>                            │
│     <g class="selection-handles">   │  ← handles for selected object
│       <circle /> <circle /> ...     │
│     </g>                            │
│   </svg>                            │
│   <div class="text-editing">        │  ← HTML overlay for active text box
│     <div contenteditable>           │
│   </div>                            │
│   <div class="trim-overlay">        │  ← auto-trim suggestion overlay
│   </div>                            │
│   <div class="crop-overlay">        │  ← crop tool overlay
│   </div>                            │
│ </div>                              │
└─────────────────────────────────────┘
```

### App Shell Layout

```
┌──────────────────────────────────────────┐
│ Tab Bar (multi-row when overflow)        │
├──────────────────────────────────────────┤
│ Toolbar (tools + actions)                │
├──────────────────────────────────────────┤
│ Sub-toolbar (active tool parameters)     │
├──────────────────────────────────────────┤
│                                          │
│          Canvas Viewport                 │
│       (image + all layers)               │
│                                          │
└──────────────────────────────────────────┘
```

### Export Flattening Pipeline

```
1. Create offscreen canvas (image dimensions, accounting for crop)
2. drawImage(baseImage, crop offset)
3. For each redaction region:
   - Read base image pixels at region bounds
   - Apply redaction effect (solid fill / pixelate / blur)
   - Write result to offscreen canvas (DESTRUCTIVE — original pixels replaced)
4. drawImage(freehandCanvas, crop offset)
5. Serialize SVG annotations → Image → drawImage()
6. Render text overlays → intermediate canvas → drawImage()
7. Extract final canvas as PNG blob
8. Write to clipboard via writeImage() or save to file
```

### Undo/Redo Architecture

```
TabState {
  undoStack: Action[]
  redoStack: Action[]
  
  execute(action) → push to undoStack, clear redoStack
  undo() → pop undoStack, call action.undo(), push to redoStack
  redo() → pop redoStack, call action.execute(), push to undoStack
}

Action types:
  - FreehandStrokeAction (stores canvas ImageData snapshot)
  - SvgAnnotationCreateAction (stores annotation data)
  - SvgAnnotationMutateAction (stores before/after state)
  - SvgAnnotationDeleteAction (stores annotation data for restore)
  - RedactionCreateAction (stores redaction region data)
  - RedactionMutateAction (stores before/after state)
  - CropAction (stores before/after crop bounds)
```

## Implementation Units

### Phase 1: Foundation — App Shell & Clipboard Round-Trip

- [ ] **Unit 1: Design Tokens & Base Styles**

  **Goal:** Replace the Tauri template styles with the Flexoki semantic token system and establish the visual foundation for all components.

  **Requirements:** Design System R1–R6

  **Dependencies:** None

  **Files:**
  - Create: `src/assets/tokens.css` (semantic token definitions for light + dark themes)
  - Modify: `src/assets/flexoki.css` (keep as-is, tokens.css references these primitives)
  - Modify: `src/App.vue` (remove template styles and greeting demo)
  - Modify: `src/main.ts` (import tokens.css)
  - Create: `src/assets/reset.css` (minimal CSS reset / base typography)
  - Test: `test/tokens.test.ts` (validate token definitions exist for both themes)

  **Approach:**
  - Define all semantic tokens from Design System R5 as CSS custom properties
  - Light theme is default (`:root`); dark theme via `.theme-dark` class on `:root`
  - Follow OS preference via `prefers-color-scheme` media query to set initial theme
  - All components will reference only semantic tokens, never Flexoki primitives

  **Patterns to follow:**
  - Flexoki CSS variable naming pattern already in `src/assets/flexoki.css`

  **Test scenarios:**
  - All semantic token categories (surfaces, text, borders, interactive, tabs, annotations, overlays, feedback, shadows) have values defined
  - Light and dark themes define different values for each token
  - No component CSS references Flexoki primitives directly (lint check)

  **Verification:**
  - App renders with warm Flexoki paper tones instead of Tauri template styles
  - Theme toggle switches all visual tokens simultaneously

- [ ] **Unit 2: App Shell Layout**

  **Goal:** Build the app shell with tab bar, toolbar, sub-toolbar, and canvas viewport areas. All areas are placeholder containers initially.

  **Requirements:** Design System R7–R11, R38–R40

  **Dependencies:** Unit 1

  **Files:**
  - Create: `src/components/AppShell.vue` (top-level layout container)
  - Create: `src/components/TabBar.vue` (tab bar container, placeholder)
  - Create: `src/components/Toolbar.vue` (toolbar container, placeholder)
  - Create: `src/components/SubToolbar.vue` (inline expandable sub-toolbar, placeholder)
  - Create: `src/components/CanvasViewport.vue` (canvas viewport container)
  - Modify: `src/App.vue` (use AppShell as root component)
  - Test: `test/app-shell.test.ts` (layout structure renders correctly)

  **Approach:**
  - CSS Grid or Flexbox for the vertical stack: tab bar → toolbar → sub-toolbar → canvas viewport
  - Tab bar and toolbar are `position: sticky` (do not scroll with canvas)
  - Canvas viewport fills remaining space with `flex: 1` / `overflow: auto`
  - Canvas viewport uses `--surface-canvas` background

  **Patterns to follow:**
  - Vue 3 `<script setup lang="ts">` single-file components
  - Semantic tokens from Unit 1

  **Test scenarios:**
  - AppShell renders all four sections in correct order
  - Canvas viewport fills available vertical space
  - Tab bar and toolbar remain fixed when canvas content overflows

  **Verification:**
  - App displays the four-section layout with correct visual hierarchy

- [ ] **Unit 3: Clipboard Integration & Base Image Display**

  **Goal:** Read clipboard images via Tauri plugin and display them in the canvas viewport. Implement the permanent clipboard tab with image/empty states.

  **Requirements:** Ephemeral-by-Default R7, R10; Layer Architecture R2

  **Dependencies:** Unit 2

  **Files:**
  - Create: `src/composables/useClipboard.ts` (clipboard read/write via Tauri plugin)
  - Create: `src/composables/useTabStore.ts` (tab state management)
  - Create: `src/types/tab.ts` (TypeScript types for tab, layer state, annotation data)
  - Modify: `src/components/CanvasViewport.vue` (render base image from active tab)
  - Modify: `src/components/TabBar.vue` (render clipboard tab + editing tabs)
  - Create: `src/components/TabItem.vue` (individual tab component)
  - Create: `src/components/EmptyClipboard.vue` (no-image-in-clipboard state)
  - Test: `test/clipboard.test.ts` (clipboard read/write composable)
  - Test: `test/tab-store.test.ts` (tab creation, switching, clipboard tab behavior)

  **Approach:**
  - `useClipboard()` wraps `readImage()` and `writeImage()` from `@tauri-apps/plugin-clipboard-manager`
  - `readImage()` returns RGBA `Uint8Array` — convert to Blob → `URL.createObjectURL()` for `<img>` display
  - `useTabStore()` manages an array of `Tab` objects. The clipboard tab is always at index 0 and cannot be closed
  - Each tab holds: `id`, `name`, `type` ('clipboard' | 'editing'), `imageUrl`, `layerState`, `undoHistory`, `copiedSinceLastEdit`
  - On app launch / hotkey activation: read clipboard, update clipboard tab's image

  **Patterns to follow:**
  - Vue 3 composable pattern (`use` prefix, returns reactive refs)
  - Tauri plugin import pattern from `@tauri-apps/plugin-clipboard-manager`

  **Test scenarios:**
  - `useClipboard().readImage()` converts RGBA data to displayable blob URL
  - `useClipboard().writeImage()` converts canvas data to clipboard-writable format
  - Tab store always has clipboard tab at index 0
  - Clipboard tab shows image when clipboard has one, empty state when not
  - Switching tabs updates the canvas viewport

  **Verification:**
  - Launch app → clipboard image (if any) appears in the canvas viewport
  - "No image in clipboard" message shows when clipboard has no image
  - Tab bar shows the clipboard tab

- [ ] **Unit 4: Tab System & Auto-Duplication**

  **Goal:** Implement the full tab system: creating editing tabs, auto-duplication when the clipboard tab is edited, tab switching, tab closing, and tab naming.

  **Requirements:** Layer Architecture R15–R20; Ephemeral-by-Default R3, R8, R11

  **Dependencies:** Unit 3

  **Files:**
  - Modify: `src/composables/useTabStore.ts` (tab creation, duplication, closing, renaming)
  - Modify: `src/components/TabBar.vue` (multi-row overflow, tab interactions)
  - Modify: `src/components/TabItem.vue` (close button, double-click rename, copied indicator)
  - Create: `src/components/TabNameEditor.vue` (inline text input for renaming)
  - Create: `src/components/CloseWarningDialog.vue` (Copy & Close / Discard / Cancel)
  - Test: `test/tab-store.test.ts` (extend with duplication, closing, renaming tests)
  - Test: `test/close-warning.test.ts` (dialog behavior)

  **Approach:**
  - Auto-duplication: when a tool is activated while the clipboard tab is focused, deep-copy the clipboard tab's image into a new editing tab and switch to it
  - Tab naming: default name is timestamp formatted per configurable pattern; double-click tab title to edit
  - Close behavior: if tab has edits since last copy, show CloseWarningDialog; else close directly
  - Multi-row tab bar: CSS `flex-wrap: wrap` on the tab container

  **Patterns to follow:**
  - Vue 3 `<Teleport>` for modal dialog
  - Semantic tokens for tab states (active, default, copied, clipboard)

  **Test scenarios:**
  - Activating a tool on clipboard tab creates a new editing tab with the image
  - Clipboard tab reverts to showing current clipboard content after duplication
  - Closing an unedited tab requires no confirmation
  - Closing an edited-since-last-copy tab shows the warning dialog
  - "Copy & Close" copies flattened image and closes the tab
  - "Discard" closes without copying
  - "Cancel" aborts the close
  - Tab renaming works via double-click and Enter to confirm
  - Tab bar wraps to multiple rows when tabs exceed one row

  **Verification:**
  - Full tab lifecycle works: create, switch, rename, duplicate, close with warning

- [ ] **Unit 5: Undo/Redo Infrastructure**

  **Goal:** Build the command-pattern undo/redo system that spans all layers with a single unified stack per tab.

  **Requirements:** Layer Architecture R10–R11

  **Dependencies:** Unit 4

  **Files:**
  - Create: `src/composables/useUndoRedo.ts` (undo/redo stack management)
  - Create: `src/types/actions.ts` (Action interface and concrete action types)
  - Test: `test/undo-redo.test.ts` (stack behavior, execute/undo/redo)

  **Approach:**
  - `Action` interface: `{ execute(): void; undo(): void; description: string }`
  - `useUndoRedo()` composable per tab: `undoStack`, `redoStack`, `canUndo`, `canRedo`
  - `execute(action)` pushes to undo stack and clears redo stack
  - `undo()` pops undo, calls `action.undo()`, pushes to redo
  - `redo()` pops redo, calls `action.execute()`, pushes to undo

  **Test scenarios:**
  - Execute pushes to undo stack
  - Undo reverses the last action and moves it to redo stack
  - Redo re-executes and moves back to undo
  - Execute after undo clears the redo stack (no redo branching)
  - Empty stacks return gracefully from undo/redo

  **Verification:**
  - Undo/redo composable passes all unit tests with mock actions

- [ ] **Unit 6: Basic Export (Copy to Clipboard)**

  **Goal:** Implement the basic copy-to-clipboard flow that flattens the base image (initially just the base image with no annotations) and writes it to the system clipboard.

  **Requirements:** Ephemeral-by-Default R1, R5–R6; Layer Architecture R12

  **Dependencies:** Unit 3

  **Files:**
  - Create: `src/composables/useExport.ts` (layer flattening and export)
  - Create: `src/components/ToastNotification.vue` (brief copy confirmation)
  - Modify: `src/composables/useTabStore.ts` (track `copiedSinceLastEdit` state)
  - Test: `test/export.test.ts` (flattening pipeline)

  **Approach:**
  - `useExport().copyToClipboard()`: creates offscreen canvas, draws base image, extracts as PNG, writes via `writeImage()`
  - Toast notification auto-dismisses after 1 second
  - Tab's "copied" indicator is set on successful copy, cleared on next edit
  - This unit starts simple (base image only); later phases add layers to the flattening pipeline

  **Test scenarios:**
  - Flattening a base-image-only tab produces a valid PNG blob
  - Copy success triggers toast and sets "copied" indicator
  - Subsequent edit clears the "copied" indicator

  **Verification:**
  - Can paste-in an image, then copy it back to clipboard with Cmd+C

### Phase 2: Freehand Drawing

- [ ] **Unit 7: Freehand Canvas Layer**

  **Goal:** Add the transparent freehand canvas overlay and implement the pen tool for basic freehand drawing.

  **Requirements:** Layer Architecture R4; Tool Configuration R8

  **Dependencies:** Unit 5, Unit 6

  **Files:**
  - Create: `src/components/FreehandCanvas.vue` (transparent canvas overlay, drawing logic)
  - Create: `src/composables/useDrawing.ts` (pointer event handling, stroke rendering)
  - Create: `src/types/tools.ts` (tool type definitions, tool state)
  - Create: `src/composables/useToolStore.ts` (active tool, per-tool settings)
  - Modify: `src/components/CanvasViewport.vue` (stack freehand canvas above base image)
  - Modify: `src/composables/useExport.ts` (add freehand canvas to flattening pipeline)
  - Test: `test/freehand.test.ts` (stroke creation, canvas integration)
  - Test: `test/tool-store.test.ts` (tool selection, per-tool settings)

  **Approach:**
  - Freehand canvas is a `<canvas>` element with `position: absolute`, same dimensions as base image
  - Pointer events (pointerdown, pointermove, pointerup) drive stroke rendering
  - Pen tool: `ctx.lineTo()` with `lineCap: 'round'`, `lineJoin: 'round'`
  - FreehandStrokeAction stores canvas `ImageData` snapshot before stroke for undo
  - Active tool state managed by `useToolStore()` composable

  **Execution note:** Start with a minimal pen tool that draws; add pencil/marker/eraser variants after the drawing pipeline is proven.

  **Test scenarios:**
  - Pointer down + move + up produces a visible stroke on the canvas
  - Stroke uses the pen tool's color and width settings
  - Undo removes the last stroke (restores previous canvas state)
  - Freehand canvas is included in the export flattening

  **Verification:**
  - Can draw freehand strokes on top of a clipboard image and copy the result

- [ ] **Unit 8: Pencil, Marker, and Eraser Tools**

  **Goal:** Add the remaining freehand tools with their distinct rendering characteristics.

  **Requirements:** Tool Configuration R9–R11; Layer Architecture R5

  **Dependencies:** Unit 7

  **Files:**
  - Modify: `src/composables/useDrawing.ts` (add pencil, marker, eraser rendering modes)
  - Modify: `src/composables/useToolStore.ts` (register pencil, marker, eraser with defaults)
  - Test: `test/freehand.test.ts` (extend with pencil, marker, eraser behavior)

  **Approach:**
  - Pencil: thinner default, sharper edge (no anti-aliasing or reduced `ctx.lineWidth`)
  - Marker: semi-transparent via `globalAlpha`, thicker default, `globalCompositeOperation: 'multiply'` or similar for highlighter effect
  - Eraser: uses `globalCompositeOperation: 'destination-out'` to erase canvas pixels
  - Each tool stores independent settings in the tool store

  **Test scenarios:**
  - Marker strokes are semi-transparent (alpha < 1)
  - Eraser removes previously drawn strokes
  - Switching between tools preserves each tool's independent color/width/opacity

  **Verification:**
  - All four freehand tools render with distinct visual characteristics

### Phase 3: Toolbar & Tool Configuration

- [ ] **Unit 9: Main Toolbar with Tool Buttons**

  **Goal:** Build the main toolbar with buttons for all 12 tools and action buttons (copy, save, undo, redo, duplicate, refresh).

  **Requirements:** Tool Configuration R1–R2; Design System R15–R16

  **Dependencies:** Unit 7

  **Files:**
  - Create: `src/components/ToolButton.vue` (individual tool button component)
  - Create: `src/components/ActionButton.vue` (action button component)
  - Modify: `src/components/Toolbar.vue` (populate with tool and action buttons)
  - Test: `test/toolbar.test.ts` (tool selection, active state, action triggers)

  **Approach:**
  - Tool buttons grouped by category: freehand (pen, pencil, marker, eraser), shapes (arrow, line, rectangle, circle), annotation (callout, text), special (redaction, crop)
  - Action buttons: copy to clipboard, save to file, duplicate tab, undo, redo. Clipboard tab additionally has refresh
  - Active tool is visually highlighted via `--interactive-active` token
  - Icon set: Lucide (install `lucide-vue-next` via Bun)

  **Test scenarios:**
  - Clicking a tool button activates that tool
  - Active tool button has distinct visual state
  - Only one tool is active at a time
  - Action buttons trigger their respective functions

  **Verification:**
  - Toolbar displays all tools and actions with clear active state indication

- [ ] **Unit 10: Inline Sub-Toolbar with Per-Tool Settings**

  **Goal:** Implement the expandable sub-toolbar that shows the active tool's configurable parameters (color, width, opacity, etc.).

  **Requirements:** Tool Configuration R3–R7, R8–R19

  **Dependencies:** Unit 9

  **Files:**
  - Modify: `src/components/SubToolbar.vue` (dynamic parameter rendering based on active tool)
  - Create: `src/components/ColorPicker.vue` (Flexoki swatches + arbitrary color picker)
  - Create: `src/components/StrokeWidthSelector.vue` (visual width options)
  - Create: `src/components/OpacitySlider.vue` (opacity slider for marker, fill)
  - Create: `src/components/FillToggle.vue` (on/off toggle for shape fill)
  - Modify: `src/composables/useToolStore.ts` (default values for all tools per R20)
  - Test: `test/sub-toolbar.test.ts` (parameter rendering per tool type)
  - Test: `test/color-picker.test.ts` (swatch selection, custom color, recent colors)

  **Approach:**
  - Sub-toolbar conditionally renders parameter components based on active tool type
  - Each tool type has a defined parameter schema (from R8–R19)
  - Color picker: grid of Flexoki swatches (8 colors + black/white) plus a custom color input, plus recent colors row
  - Settings are reactive — changing a parameter immediately affects the active tool
  - Sub-toolbar expands with CSS transition; does not block canvas interaction

  **Test scenarios:**
  - Pen sub-toolbar shows color and stroke width
  - Marker sub-toolbar shows color, stroke width, and opacity
  - Rectangle sub-toolbar shows color, stroke width, fill toggle, fill color, fill opacity
  - Changing pen color does not affect marker color
  - Color picker displays Flexoki swatches and allows custom color input
  - Recent colors accumulate across tool switches

  **Verification:**
  - Each tool shows its specific parameters in the sub-toolbar
  - Per-tool settings are remembered independently across tool switches within a session

### Phase 4: SVG Annotation Layer

- [ ] **Unit 11: SVG Layer & Selection System**

  **Goal:** Add the SVG annotation layer and implement the core selection/manipulation system (click to select, selection handles for resize/rotate, move via drag).

  **Requirements:** Layer Architecture R6–R7; Annotation Primitives R2, R23

  **Dependencies:** Unit 5

  **Files:**
  - Create: `src/components/SvgAnnotationLayer.vue` (SVG overlay, renders annotation components)
  - Create: `src/components/SelectionHandles.vue` (resize handles, rotation handle)
  - Create: `src/composables/useSelection.ts` (selection state, hit testing, transform logic)
  - Create: `src/composables/useAnnotationStore.ts` (annotation CRUD per tab)
  - Create: `src/types/annotations.ts` (annotation data types: position, size, rotation, style)
  - Modify: `src/components/CanvasViewport.vue` (stack SVG layer above freehand canvas)
  - Test: `test/selection.test.ts` (hit testing, drag, resize, rotate)
  - Test: `test/annotation-store.test.ts` (CRUD operations, undo integration)

  **Approach:**
  - SVG layer is `<svg>` with `position: absolute`, same viewBox as image dimensions
  - Each annotation is a Vue component rendering its SVG elements within this layer
  - Selection: click on annotation → show 8 resize handles + rotation handle above top center
  - Move: drag selected annotation (pointer delta applied to position)
  - Resize: drag handle (recalculate dimensions maintaining aspect ratio if Shift held)
  - Rotate: drag rotation handle (calculate angle from center)
  - All mutations create undo actions via the annotation store

  **Test scenarios:**
  - Adding an annotation renders its SVG element
  - Clicking an annotation selects it and shows handles
  - Clicking empty space deselects
  - Dragging a selected annotation moves it
  - Dragging a resize handle changes dimensions
  - All mutations are undoable

  **Verification:**
  - Annotations can be created, selected, moved, resized, and rotated

- [ ] **Unit 12: Rectangle & Circle/Ellipse Tools**

  **Goal:** Implement rectangle and circle/ellipse annotation tools with click-and-drag creation.

  **Requirements:** Annotation Primitives R9–R12

  **Dependencies:** Unit 11

  **Files:**
  - Create: `src/components/annotations/RectAnnotation.vue` (rectangle SVG component)
  - Create: `src/components/annotations/EllipseAnnotation.vue` (circle/ellipse SVG component)
  - Create: `src/composables/useShapeCreation.ts` (click-and-drag creation logic)
  - Modify: `src/composables/useAnnotationStore.ts` (integrate shape creation actions)
  - Modify: `src/composables/useExport.ts` (add SVG layer to flattening pipeline)
  - Test: `test/shapes.test.ts` (creation, rendering, manipulation)

  **Approach:**
  - Click-and-drag: pointerdown sets one corner, pointermove updates opposite corner, pointerup finalizes
  - Shift key constrains circle/ellipse to perfect circle and rectangle to square
  - Stroke color and width from active tool settings; fill optional (off by default)
  - SVG: `<rect>` for rectangles, `<ellipse>` for circles/ellipses
  - Export: serialize SVG → Image → drawImage on offscreen canvas

  **Test scenarios:**
  - Click-and-drag creates a rectangle with correct dimensions
  - Shift constrains ellipse to circle
  - Stroke and fill properties match tool settings
  - Created shapes are selectable and manipulable
  - SVG layer is correctly flattened into export

  **Verification:**
  - Can draw rectangles and circles, manipulate them, and export the result

- [ ] **Unit 13: Arrow & Line Tools**

  **Goal:** Implement the bendable arrow (quadratic Bezier) and straight line tools.

  **Requirements:** Annotation Primitives R3–R8

  **Dependencies:** Unit 11

  **Files:**
  - Create: `src/components/annotations/ArrowAnnotation.vue` (Bezier arrow SVG component)
  - Create: `src/components/annotations/LineAnnotation.vue` (straight line SVG component)
  - Modify: `src/components/SelectionHandles.vue` (add Bezier control point handle for arrows)
  - Test: `test/arrows.test.ts` (arrow creation, bending, arrowhead rendering)

  **Approach:**
  - Arrow: SVG `<path>` with quadratic Bezier `Q` command. Three control points: start, end, midpoint
  - Click-and-drag: sets start and end points. Midpoint defaults to center (straight arrow)
  - Midpoint handle is draggable to bend the arrow (perpendicular and along axis)
  - Arrowhead: SVG `<marker>` element or manually drawn triangle at the end point
  - Line: simple SVG `<line>` element, no arrowhead

  **Test scenarios:**
  - Arrow renders as straight line when midpoint is at center
  - Dragging midpoint handle creates a curved arrow
  - Arrowhead points in the correct direction even when curved
  - Line tool creates a simple line segment

  **Verification:**
  - Arrows can be drawn, bent, and maintain correct arrowhead orientation

- [ ] **Unit 14: Numbered Callout Tool**

  **Goal:** Implement numbered callouts that auto-increment on placement and auto-renumber on deletion.

  **Requirements:** Annotation Primitives R13–R16

  **Dependencies:** Unit 11

  **Files:**
  - Create: `src/components/annotations/CalloutAnnotation.vue` (callout SVG component)
  - Modify: `src/composables/useAnnotationStore.ts` (auto-increment counter, renumber on delete)
  - Test: `test/callouts.test.ts` (auto-increment, auto-renumber, contrast color)

  **Approach:**
  - Callout: SVG `<circle>` with `<text>` centered inside
  - Placed with single click at cursor position
  - Auto-increment: maintain a counter per tab; each click places the next number
  - Auto-renumber on delete: scan all remaining callouts, reassign numbers sequentially (1, 2, 3...)
  - Contrast color: calculate relative luminance of fill color; use white text on dark fills (luminance < 0.5), dark text on light fills

  **Test scenarios:**
  - Sequential clicks place callouts numbered 1, 2, 3
  - Deleting callout #2 renumbers #3 to #2
  - Number color contrasts with fill color (white on dark, dark on light)
  - Callouts are selectable, movable, and recolorable

  **Verification:**
  - Callout numbering stays sequential and gap-free after any combination of additions and deletions

### Phase 5: Rich Text Tool

- [ ] **Unit 15: Rich Text Box with HTML Overlay**

  **Goal:** Implement the rich text box tool using an HTML overlay approach (avoiding foreignObject due to WebKit bugs).

  **Requirements:** Annotation Primitives R17–R21

  **Dependencies:** Unit 11

  **Files:**
  - Create: `src/components/annotations/TextAnnotation.vue` (text box SVG placeholder + HTML overlay)
  - Create: `src/components/TextEditor.vue` (contenteditable div with basic rich text controls)
  - Create: `src/composables/useTextEditing.ts` (text editing state, formatting commands)
  - Modify: `src/components/CanvasViewport.vue` (add text editing overlay layer)
  - Modify: `src/composables/useExport.ts` (render text overlays to canvas for flattening)
  - Test: `test/text-tool.test.ts` (placement, editing, formatting, export)

  **Approach:**
  - Click to place: creates an SVG annotation object (rectangle placeholder with text icon) AND a positioned HTML overlay
  - The HTML overlay is a `<div contenteditable>` absolutely positioned to match the SVG annotation's viewport coordinates
  - Rich text formatting via `document.execCommand()` or the modern `inputType` API: bold, italic, underline, font size, color
  - Double-click the SVG placeholder to re-enter editing mode (show the HTML overlay)
  - On blur/deselect: hide the HTML overlay, update the SVG placeholder to show a static text preview
  - Export: render the HTML overlay to an intermediate canvas (create a temporary element, use canvas text rendering to replicate the styled text)
  - Optional background fill behind the text box

  **Test scenarios:**
  - Click places a text box and opens the editing overlay
  - Typing in the overlay produces visible text
  - Bold/italic/underline toggles work within the same text box
  - Different spans can have different styles
  - Double-click re-enters editing mode
  - Text box is movable and resizable via the SVG selection system
  - Text content is correctly flattened into export

  **Verification:**
  - Can place text with mixed formatting, manipulate the text box, and export the result

### Phase 6: Redaction Layer

- [ ] **Unit 16: Redaction Tool with Three Styles**

  **Goal:** Implement the dedicated redaction tool with solid fill, pixelation, and Gaussian blur styles. Non-destructive during session, destructive on export.

  **Requirements:** Dedicated Redaction R1–R13

  **Dependencies:** Unit 5, Unit 6

  **Files:**
  - Create: `src/components/RedactionCanvas.vue` (redaction layer canvas, renders redaction regions)
  - Create: `src/composables/useRedaction.ts` (redaction region management, style application)
  - Create: `src/types/redaction.ts` (redaction region data types)
  - Modify: `src/components/CanvasViewport.vue` (stack redaction canvas between base image and freehand)
  - Modify: `src/composables/useExport.ts` (apply destructive redaction during flattening — replace base image pixels)
  - Test: `test/redaction.test.ts` (creation, styles, destructive export verification)

  **Approach:**
  - Redaction canvas: `<canvas>` with `position: absolute`, between base image and freehand canvas
  - Drawing: click-and-drag to define rectangle region
  - During session: render redaction effects as overlays (solid color fill, pixelated blocks, or blurred region) by reading base image pixels and rendering the effect on the redaction canvas
  - Redaction regions are stored as data objects (position, size, style), re-rendered on demand
  - On export: apply redaction effects directly to the offscreen canvas BEFORE compositing freehand and SVG layers — original pixels are permanently replaced
  - Visual distinction from annotation rectangles: hatched border pattern or distinct icon overlay
  - Pixelation: read underlying pixels, average into blocks (8-16px default), draw blocks
  - Blur: apply Gaussian blur via `ctx.filter = 'blur(Npx)'` or manual convolution

  **Test scenarios:**
  - Redaction rectangle renders with the selected style (solid/pixelate/blur)
  - Redaction regions are selectable, movable, resizable, and style-changeable
  - Exported image has NO recoverable pixel data under redaction regions (verify by reading pixel values — they should match the redaction fill, not the original image)
  - Redaction create/move/resize/delete are undoable
  - Redaction regions are visually distinct from annotation rectangles

  **Verification:**
  - Raw pixel inspection of exported image confirms redacted regions contain only redaction fill data

### Phase 7: Auto-Crop & Crop Tool

- [ ] **Unit 17: Auto-Trim Detection (Rust Backend)**

  **Goal:** Implement the border detection algorithm in Rust for performance, exposed as a Tauri command.

  **Requirements:** Auto-Crop R1, R7

  **Dependencies:** Unit 3

  **Files:**
  - Modify: `src-tauri/src/lib.rs` (add auto-trim Tauri command)
  - Create: `src-tauri/src/trim.rs` (border detection algorithm)
  - Modify: `src-tauri/Cargo.toml` (add `image` crate if needed for pixel access)
  - Test: `test/trim-detection.test.ts` (integration test calling the Tauri command with test images)

  **Approach:**
  - Tauri command `detect_trim_bounds` accepts image bytes and threshold, returns `{ top, right, bottom, left }` pixel counts to trim
  - Algorithm: sample the corner pixel color as the "border color." Scan each edge inward, row by row (top/bottom) and column by column (left/right), checking if all pixels in the row/column are within the threshold of the border color
  - Per-channel threshold: `max(|r1-r2|, |g1-g2|, |b1-b2|) <= threshold`
  - Default threshold: 10 (handles JPEG artifacts)
  - Must complete within 50ms for typical screenshot sizes

  **Test scenarios:**
  - Image with uniform black border correctly detects all four border widths
  - Image with no border returns zero trim on all sides
  - Image with JPEG artifacts near border edges is handled by the threshold
  - Image with asymmetric borders (shadow on one side) detects per-edge trim
  - Performance: detection completes within 50ms for a 2560x1440 image

  **Verification:**
  - Rust command returns correct trim bounds for test images with various border types

- [ ] **Unit 18: Trim Overlay & Crop Tool**

  **Goal:** Implement the trim suggestion overlay, the "Trim" accept flow, the manual "Smart Trim" button, and the general-purpose crop tool.

  **Requirements:** Auto-Crop R1–R9; Layer Architecture R9

  **Dependencies:** Unit 17, Unit 5

  **Files:**
  - Create: `src/components/TrimOverlay.vue` (dimmed border overlay with "Trim" button)
  - Create: `src/components/CropOverlay.vue` (draggable crop region with handles)
  - Create: `src/composables/useCrop.ts` (crop-as-projection state management)
  - Modify: `src/composables/useExport.ts` (apply crop bounds during flattening)
  - Modify: `src/components/Toolbar.vue` (add "Smart Trim" action button)
  - Test: `test/crop.test.ts` (crop projection, trim overlay behavior)

  **Approach:**
  - Crop-as-projection: crop bounds are stored as metadata `{ x, y, width, height }` on the tab. All layers are rendered within this viewport. Changing crop does not modify any layer data
  - Trim overlay: when auto-trim detects borders, dim the border regions (dark overlay) and show the content region at full brightness with a floating "Trim" button
  - Accept trim: applies the detected bounds as a crop action (added to undo stack)
  - Cancel trim: starting to edit (activating a tool) dismisses the overlay
  - Crop tool: drag to define a region, handles to adjust, Enter to apply, Esc to cancel
  - "Smart Trim" button: manually invokes the auto-trim detection on the current tab

  **Test scenarios:**
  - Auto-trim overlay appears after pasting an image with detectable borders
  - Accepting trim updates the crop projection
  - Trim is undoable
  - Starting to edit cancels the trim suggestion
  - Crop tool allows manual region selection
  - Export respects the crop bounds

  **Verification:**
  - Trim suggestion correctly identifies and offers to remove uniform borders on common screenshots

### Phase 8: System Integration & Ephemeral UX

- [ ] **Unit 19: Global Hotkey & System Tray**

  **Goal:** Register a system-wide global hotkey and set up the system tray icon with context menu.

  **Requirements:** Global Hotkey R1–R8; Design System R36–R37

  **Dependencies:** Unit 3

  **Files:**
  - Modify: `src-tauri/Cargo.toml` (add `tauri-plugin-global-shortcut`)
  - Modify: `src-tauri/src/lib.rs` (register global shortcut plugin, system tray setup)
  - Modify: `src-tauri/capabilities/desktop.json` (add `global-shortcut:default` permission)
  - Modify: `package.json` (add `@tauri-apps/plugin-global-shortcut`)
  - Create: `src/composables/useGlobalHotkey.ts` (hotkey registration, handler)
  - Modify: `src/main.ts` (initialize global hotkey on app start)
  - Test: `test/hotkey.test.ts` (hotkey handler behavior)

  **Approach:**
  - Register `CommandOrControl+Shift+J` via `@tauri-apps/plugin-global-shortcut`
  - Handler: bring window to foreground, switch to clipboard tab, read and display current clipboard image
  - If already focused: re-read clipboard and refresh
  - If no image in clipboard: show empty state but still bring window to foreground
  - System tray: `TrayIcon.new()` with menu items: "Show ClipJot", "Settings", "Quit"
  - App starts in tray by default; global hotkey only works while app is running

  **Test scenarios:**
  - Hotkey handler reads clipboard and updates the clipboard tab
  - Re-pressing hotkey when focused refreshes the clipboard content
  - Hotkey with no clipboard image shows empty state
  - Tray menu "Show ClipJot" brings window to foreground
  - Tray menu "Quit" exits the app

  **Verification:**
  - Global hotkey activates ClipJot from any application context

- [ ] **Unit 20: Settings Dialog**

  **Goal:** Implement the settings dialog with all configurable options: global hotkey, auto-trim toggle, tab name format, theme toggle, auto-copy on close, auto-start.

  **Requirements:** Global Hotkey R3; Auto-Crop R2, R7; Design System R2; Ephemeral-by-Default R2

  **Dependencies:** Unit 19

  **Files:**
  - Create: `src/components/SettingsDialog.vue` (modal settings panel)
  - Create: `src/composables/useSettings.ts` (settings state, persistence to local storage or Tauri store)
  - Modify: `src/composables/useGlobalHotkey.ts` (dynamic re-registration when hotkey changes)
  - Test: `test/settings.test.ts` (settings persistence, hotkey re-registration)

  **Approach:**
  - Settings stored in a simple JSON file via Tauri's file system API or `localStorage` (lightweight, no database)
  - Sections: Hotkey (key combination input), Display (theme toggle), Behavior (auto-copy on close, auto-trim on paste), Advanced (trim threshold slider, tab name date format)
  - Theme toggle immediately applies `.theme-dark` or removes it from `:root`
  - Hotkey change: unregister old shortcut, register new one, all via the plugin API

  **Test scenarios:**
  - Changing theme toggles the CSS class and all tokens switch
  - Changing hotkey dynamically re-registers the shortcut
  - Disabling auto-trim prevents the trim overlay on paste
  - Settings persist across app restarts

  **Verification:**
  - All settings are configurable and take effect immediately

- [ ] **Unit 21: Ephemeral UX Polish**

  **Goal:** Implement the remaining ephemeral UX features: auto-copy on tab close, "copied" indicator, keyboard shortcuts, save-to-file.

  **Requirements:** Ephemeral-by-Default R1–R11

  **Dependencies:** Unit 4, Unit 6, Unit 20

  **Files:**
  - Modify: `src/composables/useTabStore.ts` (auto-copy on close behavior)
  - Modify: `src/components/TabItem.vue` (persistent "copied" indicator badge)
  - Create: `src/composables/useKeyboard.ts` (keyboard shortcut registration)
  - Modify: `src/composables/useExport.ts` (add save-to-file via Tauri dialog)
  - Modify: `src/components/Toolbar.vue` (wire save button)
  - Test: `test/keyboard.test.ts` (shortcut handling)
  - Test: `test/ephemeral.test.ts` (auto-copy, copied indicator lifecycle)

  **Approach:**
  - Keyboard shortcuts: Cmd+C (copy), Cmd+S (save), Cmd+W (close tab), Cmd+Z (undo), Cmd+Shift+Z (redo)
  - Cmd+C intercepts default browser copy to trigger the flattened image copy
  - Auto-copy on close: when closing a tab with `auto-copy` setting enabled and edits since last copy, copy before closing (skipping the warning dialog)
  - "Copied" indicator: small green badge on tab, cleared on next edit
  - Save-to-file: Tauri save dialog → write PNG/JPG to chosen path

  **Test scenarios:**
  - Cmd+C copies the flattened image (not browser selection)
  - Cmd+Z triggers undo
  - Auto-copy on close copies before closing when enabled
  - "Copied" badge appears after copy, disappears after next edit
  - Save-to-file writes a valid image to disk

  **Verification:**
  - Full ephemeral workflow works end-to-end: hotkey → view → draw → copy → close

### Phase 9: Final Integration & Polish

- [ ] **Unit 22: Full Export Pipeline**

  **Goal:** Complete the layer flattening pipeline to include all four layers plus text overlays, with proper redaction destruction and crop application.

  **Requirements:** Layer Architecture R12–R14; Dedicated Redaction R11

  **Dependencies:** Units 6, 7, 12, 15, 16, 18

  **Files:**
  - Modify: `src/composables/useExport.ts` (complete flattening pipeline: base → redaction → freehand → SVG → text)
  - Test: `test/export-full.test.ts` (multi-layer flattening, redaction verification, crop application)

  **Approach:**
  - Follow the export flattening pipeline from the technical design section
  - Critical ordering: redaction applied to base image BEFORE higher layers are composited
  - SVG serialization: `XMLSerializer.serializeToString()` → data URI → `Image` → `drawImage()`
  - Text overlays: render each text box's HTML content to an intermediate canvas positioned at the annotation's coordinates
  - Crop: offset all drawImage calls by the crop bounds

  **Test scenarios:**
  - Flattened image contains all layers in correct order
  - Redacted regions contain only redaction fill (no original pixel data)
  - Crop bounds are correctly applied to the output dimensions
  - Text content appears at the correct position in the export
  - Export produces a valid PNG blob

  **Verification:**
  - An image with annotations on all four layers plus text and crop exports as a correct single raster image

- [ ] **Unit 23: Contextual Property Panel**

  **Goal:** Add the contextual property panel that appears when an SVG annotation is selected, allowing recolor/restyle/fill changes inline.

  **Requirements:** Annotation Primitives R25; Design System R29

  **Dependencies:** Unit 11

  **Files:**
  - Create: `src/components/ContextualPanel.vue` (floating panel for selected annotation properties)
  - Modify: `src/composables/useSelection.ts` (expose selected annotation properties for editing)
  - Test: `test/contextual-panel.test.ts` (property editing, live preview)

  **Approach:**
  - Small floating panel positioned near the selected annotation
  - Shows: color swatch, stroke width, fill toggle (for shapes), opacity slider
  - Changes apply immediately (live preview) and are undoable
  - Panel auto-hides when selection is cleared

  **Test scenarios:**
  - Selecting a rectangle shows the panel with its current properties
  - Changing color updates the annotation in real-time
  - Changes are added to the undo stack
  - Panel positions itself near the annotation without obscuring it

  **Verification:**
  - Post-creation property editing works for all annotation types

- [ ] **Unit 24: End-to-End Integration Testing**

  **Goal:** Validate the complete user workflow from clipboard paste through annotation to export.

  **Requirements:** All success criteria across all 8 requirements documents

  **Dependencies:** All previous units

  **Files:**
  - Create: `test/integration/clipboard-round-trip.test.ts`
  - Create: `test/integration/annotation-workflow.test.ts`
  - Create: `test/integration/redaction-security.test.ts`

  **Approach:**
  - Test the full clipboard round-trip: read image → annotate → copy back → verify output
  - Test annotation workflow: create multiple annotation types → manipulate → export
  - Test redaction security: create redaction → export → verify pixel destruction

  **Test scenarios:**
  - Full round-trip: paste image → draw freehand → add arrow → add text → copy → verify all content in output
  - Tab lifecycle: create tab → edit → undo → redo → close with warning → copy & close
  - Redaction security: create solid + pixelate + blur redactions → export → read back pixels at redacted regions → confirm no original data

  **Verification:**
  - All success criteria from the 8 requirements documents pass

## System-Wide Impact

- **Interaction graph:** Tool activation triggers layer routing (freehand → canvas, shapes → SVG, redaction → redaction canvas). Clipboard read/write crosses the Rust/JS boundary via Tauri IPC. Global hotkey events propagate from OS → Tauri → Vue.
- **Error propagation:** Clipboard read failures should show a user-friendly empty state, not crash. Export failures should show an error toast. Hotkey registration failures should warn in settings.
- **State lifecycle risks:** Tab duplication must deep-copy canvas bitmap data (ImageData) and annotation objects. Undo/redo stack must not hold stale references to deleted annotations. Auto-copy on close must complete before the tab state is garbage-collected.
- **API surface parity:** All toolbar actions must be mirrored in the application menu bar (Tauri menu). All keyboard shortcuts must have toolbar button equivalents.
- **Integration coverage:** Unit tests cover individual components; the Phase 9 integration tests cover cross-layer scenarios that unit tests alone cannot prove (especially export flattening order and redaction destruction).

## Risks & Dependencies

- **WebKit rendering quirks on macOS**: Tauri uses WebKit (WKWebView) on macOS. Our foreignObject research identified 56 bugs. The HTML overlay approach for rich text avoids the worst, but other WebKit quirks (canvas compositing, SVG rendering) may surface. Mitigate: test frequently in the actual Tauri window, not just a browser.
- **Clipboard image format**: `readImage()` returns RGBA data, but the exact format and performance for large images (4K+) needs validation early in Phase 1. If slow, add a loading indicator.
- **Freehand undo memory**: Storing full canvas ImageData snapshots per stroke can use significant memory for large images. Mitigate: limit undo stack depth (e.g., 50 actions) or use incremental dirty-region snapshots.
- **SVG serialization for export**: `XMLSerializer` + Image approach may have issues with embedded fonts or complex SVG features. Mitigate: keep SVG annotations simple (basic shapes, paths, text) and test export early.
- **Global hotkey conflicts**: `Cmd+Shift+J` may conflict with other apps. Mitigate: make it configurable from the start (Phase 8).
- **Tauri plugin compatibility**: The plan assumes `tauri-plugin-global-shortcut` and system tray APIs are stable in Tauri v2. Verify during Phase 8 implementation.

## Phased Delivery

### Phase 1: Foundation (Units 1–6)
Delivers: app shell, design tokens, clipboard reading, image display, tab system, basic export. **Milestone: paste → view → copy-back works.**

### Phase 2: Freehand Drawing (Units 7–8)
Delivers: pen, pencil, marker, eraser tools on canvas layer. **Milestone: paste → draw → copy-back works.**

### Phase 3: Toolbar & Configuration (Units 9–10)
Delivers: full toolbar, sub-toolbar, per-tool settings, color picker. **Milestone: all tools accessible with configurable parameters.**

### Phase 4: SVG Annotations (Units 11–14)
Delivers: rectangle, circle, line, arrow, callout tools with full manipulation. **Milestone: structured annotations are fully functional.**

### Phase 5: Rich Text (Unit 15)
Delivers: rich text box with HTML overlay approach. **Milestone: text annotation works cross-browser.**

### Phase 6: Redaction (Unit 16)
Delivers: redaction tool with three styles, destructive export. **Milestone: redaction is provably destructive.**

### Phase 7: Auto-Crop (Units 17–18)
Delivers: auto-trim detection, trim overlay, crop tool. **Milestone: auto-trim works on common screenshots.**

### Phase 8: System Integration (Units 19–21)
Delivers: global hotkey, system tray, settings dialog, ephemeral UX. **Milestone: full system integration.**

### Phase 9: Polish (Units 22–24)
Delivers: complete export pipeline, contextual panel, integration tests. **Milestone: all success criteria pass.**

## Sources & References

- **Origin documents:** All 8 requirements documents in `docs/brainstorms/` (dated 2026-03-20)
- **foreignObject research:** Prior conversation session — 56 open WebKit bugs, recommendation to use HTML overlay
- **Tauri v2 Clipboard API:** https://v2.tauri.app/fr/reference/javascript/clipboard-manager — `readImage()`, `writeImage()`
- **Tauri v2 Global Shortcut:** https://v2.tauri.app/ko/plugin/global-shortcut — `register()` API
- **Tauri v2 System Tray:** https://v2.tauri.app/learn/system-tray — `TrayIcon.new()` API
- **Flexoki color scheme:** https://github.com/kepano/flexoki — all primitives in `src/assets/flexoki.css`
