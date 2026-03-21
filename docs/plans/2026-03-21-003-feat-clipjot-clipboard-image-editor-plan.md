---
title: "feat: ClipJot Clipboard Image Editor — Full Implementation"
type: feat
status: active
date: 2026-03-21
origin:
  - docs/brainstorms/2026-03-20-annotation-layer-architecture-requirements.md
  - docs/brainstorms/2026-03-20-ephemeral-by-default-requirements.md
  - docs/brainstorms/2026-03-20-annotation-primitives-requirements.md
  - docs/brainstorms/2026-03-20-auto-crop-smart-trim-requirements.md
  - docs/brainstorms/2026-03-20-dedicated-redaction-requirements.md
  - docs/brainstorms/2026-03-20-tool-configuration-requirements.md
  - docs/brainstorms/2026-03-20-global-hotkey-requirements.md
  - docs/brainstorms/2026-03-20-design-system-requirements.md
supersedes:
  - docs/plans/2026-03-21-001-feat-clipjot-v1-full-implementation-beta-plan.md
  - docs/plans/2026-03-21-002-feat-unified-undo-redo-system-plan.md
---

# feat: ClipJot Clipboard Image Editor — Full Implementation

## Enhancement Summary

**Deepened on:** 2026-03-21
**Agents used:** architecture-strategist, performance-oracle, security-sentinel, best-practices-researcher (Vue 3), framework-docs-researcher (Tauri v2), code-simplicity-reviewer
**Sections enhanced:** All major sections

### Critical Fixes Required Before Implementation

1. **CSP must be configured** — `"csp": null` enables XSS → Tauri IPC escalation. Set restrictive CSP immediately.
2. **Move zoom coordinate transforms to Phase 1** — building tools without image-space coords means retrofitting 6+ composables later.
3. **Specify per-tab composable scoping** — module-level singletons vs per-tab instances is unresolved and affects every composable.
4. **Fix CSS transform order** — `scale() translate()` applies right-to-left; current order is wrong for pan behavior.
5. **Resolve SVG CSS variable export bug** — CSS custom properties don't serialize; annotations will be invisible in exports.
6. **Fix export atomicity** — clearing clipboard before flattening loses clipboard content on failure; clear only right before write.

### Key Performance Corrections

- **Memory per tab: ~28 MB at 1080p, ~105 MB at 4K** (plan said 5–10 MB — 3–10× underestimate)
- **Canvas buffers must match image resolution, NOT image × DPR** (saves ~200 MB/tab at 4K Retina)
- **Rolling checkpoints every 10 strokes** needed to meet 16ms replay budget (plan only checkpoints on prune)
- **Auto-trim IPC: subsample 4× before sending** to Rust (33 MB → 2 MB transfer, 55–145ms → 15–35ms)
- **Virtualize inactive tab canvases** (10 tabs at 4K: 1050 MB → 170 MB)

### Security Findings

- **HIGH:** XSS chain via contenteditable → v-html → CSP null → Tauri IPC. Sanitize pasted HTML.
- **HIGH:** Gaussian blur at 20px is reversible (Revelio 2025: 95.9% face re-identification). Raise to 40px + add noise.
- **MEDIUM:** Pixelation minimum 4px too low (Bishop Fox Unredacter). Raise to 12px minimum.
- **MEDIUM:** PNG exports may contain metadata (creation time, software). Strip ancillary chunks.

### Simplification Opportunities (from code-simplicity review)

Consider for v1 scope reduction (total savings ~1,650–2,150 LOC):
- Ship plain text instead of rich text (defer B/I/U to v2)
- Ship straight arrows (defer Bezier bending to v2)
- Flatten-to-image for tab duplication (skip undo history cloning)
- Reuse sub-toolbar for property editing (kill contextual panel, Unit 24)
- Defer menu bar (Unit 25) — shortcuts + toolbar are sufficient
- Collapse 10 command types → 4 (FreehandStroke, Annotation, Crop, Compound)

### Vue 3 / TypeScript Patterns

- Use `shallowRef` for ImageData, stroke arrays, and command stacks (avoid deep reactivity on large data)
- Use provide/inject for viewport context (zoom, image dimensions) — direct import for everything else
- Discriminated unions on `annotation.type` with `assertNever` exhaustiveness checking
- Cache `Path2D` objects on stroke data to avoid recomputing on replay
- Use `getCoalescedEvents()` in pointer handlers for smooth strokes on 120Hz+ displays

### Tauri v2 Production Patterns

- Use `tauri::ipc::Response` for binary data (not JSON serialization)
- Use `tokio::task::spawn_blocking` for CPU-bound Rust commands
- Keep event loop alive for tray: `api.prevent_exit()` in `RunEvent::ExitRequested`
- Consider adding `tauri-plugin-updater` for auto-updates (~3 hrs setup)
- Register desktop-only plugins in `setup()` via `app.handle().plugin()` for proper error handling

---

## Overview

Build ClipJot from the current Tauri v2 + Vue 3 scaffold into a fully functional desktop clipboard image annotation app. The core loop: **paste image from clipboard → annotate with freehand drawing, shapes, text, callouts → copy flattened result back to clipboard**. The architecture uses a fixed four-layer rendering stack, a tab system with ephemeral-by-default philosophy, per-tool remembered settings, and system integration via global hotkey and system tray.

This plan supersedes the beta plan (001) and undo/redo plan (002) by incorporating SpecFlow gap analysis (88 findings), concrete external research on Tauri v2 APIs and Canvas/SVG hybrid patterns, and resolved technical decisions for all 33 open questions from the brainstorm documents.

## Problem Statement

ClipJot's codebase is the stock Tauri v2 scaffolding template. No application-specific features exist. Eight requirements documents (148 total requirements) define the complete product vision. Four Penpot design pages define the visual language. This plan transforms those into a phased, dependency-ordered implementation delivering testable milestones from minimum viable clipboard round-trip through to the full feature set.

## Requirements Trace

All requirements sourced from eight brainstorm documents in `docs/brainstorms/`:

| Document | Requirements | Key Decisions |
|----------|-------------|---------------|
| **Layer Architecture** | R1–R20 | Fixed 4-layer stack, hybrid Canvas+SVG, unified undo, crop-as-projection (see origin: `docs/brainstorms/2026-03-20-annotation-layer-architecture-requirements.md`) |
| **Ephemeral-by-Default** | R1–R11 | Clipboard round-trip, auto-copy on close, no session persistence (see origin: `docs/brainstorms/2026-03-20-ephemeral-by-default-requirements.md`) |
| **Annotation Primitives** | R1–R25 | Bezier arrows, auto-renumber callouts, rich text, SVG shapes (see origin: `docs/brainstorms/2026-03-20-annotation-primitives-requirements.md`) |
| **Auto-Crop / Smart Trim** | R1–R9 | Border detection, overlay preview, crop-as-projection (see origin: `docs/brainstorms/2026-03-20-auto-crop-smart-trim-requirements.md`) |
| **Dedicated Redaction** | R1–R13 | Three styles, non-destructive during session, destructive on export (see origin: `docs/brainstorms/2026-03-20-dedicated-redaction-requirements.md`) |
| **Tool Configuration** | R1–R22 | Per-tool remembered settings, inline sub-toolbar, Flexoki palette (see origin: `docs/brainstorms/2026-03-20-tool-configuration-requirements.md`) |
| **Global Hotkey** | R1–R8 | Cmd+Shift+J, system tray, instant activation (see origin: `docs/brainstorms/2026-03-20-global-hotkey-requirements.md`) |
| **Design System** | R1–R40 | Flexoki semantic tokens, light/dark themes, 37+ components (see origin: `docs/brainstorms/2026-03-20-design-system-requirements.md`) |

## Scope Boundaries

**In scope:**
- macOS primary, Windows secondary — develop and test on macOS first
- Desktop only (no mobile) per Tauri configuration
- Raster export only (PNG, JPG) — no SVG/vector export
- Ephemeral tabs — no crash recovery or session restore
- Single-user — no collaborative editing

**Out of scope (explicitly rejected in ideation or deferred per brainstorms):**
- Event-sourced document model (rejected as "architecture astronautics")
- Clipboard history (reinventing a solved problem)
- OffscreenCanvas / Web Workers (premature optimization)
- Content-aware cropping (only uniform-color border detection)
- Cross-session tool settings persistence (settings reset on restart)
- User-configurable layer ordering (4-layer stack is fixed)
- Freehand stroke selection/movement (freehand is paint-and-forget)
- Auto-detect sensitive content for redaction (always manual)
- No speech bubbles, connector lines, freeform polygon, or custom arrowhead styles (see origin: annotation-primitives scope)
- No grouping, alignment/distribute, or snap-to-grid for annotations (see origin: annotation-primitives scope)
- No text alignment controls, lists, or tables in rich text (see origin: annotation-primitives R19)
- No non-rectangular redaction shapes (see origin: dedicated-redaction scope)
- No redaction applied to annotation layers (only base image) (see origin: dedicated-redaction scope)
- No inter-layer interactions beyond compositing order (see origin: layer-architecture scope)
- No batch trim or content-aware trim (see origin: auto-crop scope)
- No animation specifications or typography specification beyond font family (see origin: design-system scope)
- No drag-out or URL sharing of images (see origin: ephemeral scope)
- No custom tool creation or tool-specific keyboard shortcuts for parameter changes (see origin: tool-configuration scope)
- Enter key reserved for text input — never used for copy/close actions (see origin: ephemeral R8)

## Proposed Solution

### Key Technical Decisions (All Resolved)

These resolve the 33 open technical questions from the brainstorm documents, informed by external research on Tauri v2 APIs and Canvas/SVG rendering patterns.

#### Rendering Architecture

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **DOM compositing** | Stacked absolute-positioned elements in a relative container | Simplest approach; proven by Excalidraw and tldraw. Pointer events captured on container and routed by active tool. |
| **Freehand stroke storage** | Path data (array of `[x, y, pressure]` points) via `perfect-freehand` library | Enables non-destructive undo via replay, scales to any resolution. ~3KB library, zero deps. (see origin: annotation-layer-architecture R4–R5) |
| **SVG approach** | Vue-native SVG components (no SVG.js) | Vue 3 has first-class SVG support. Reactivity maps naturally to SVG attributes. Libraries fight Vue's reactivity model. (see origin: annotation-primitives R2) |
| **Rich text approach** | Absolutely-positioned `contenteditable` div over SVG layer | foreignObject has 56 open WebKit bugs (Safari = Tauri's macOS engine). HTML overlay avoids all of them. Display via foreignObject is acceptable; editing via HTML overlay. (see origin: annotation-primitives R17–R21) |
| **Export flattening** | Sequential `drawImage()` to offscreen canvas | Base → redaction (destructive) → freehand → SVG (serialized via XMLSerializer → Image) → text (rendered to intermediate canvas). Produces PNG blob for clipboard or file. (see origin: layer-architecture R12–R14) |
| **Border detection** | Rust backend via Tauri IPC command | More performant for large images; direct pixel access. Returns `{ top, right, bottom, left }` trim bounds. (see origin: auto-crop R1) |
| **Color distance metric** | Per-channel RGB threshold: `max(\|r1-r2\|, \|g1-g2\|, \|b1-b2\|) <= threshold` | Simple, effective for screenshots with JPEG artifacts. Default threshold: 10. (see origin: auto-crop R7) |
| **Undo/redo** | Command pattern with compositing stroke replay for freehand + checkpoint model | Each action implements `execute()` / `undo()`. Eraser = stroke with `destination-out`. Pruned strokes baked into checkpoint ImageData. ~940x memory improvement vs naive snapshots at 4K. (see origin: layer-architecture R10–R11) |
| **State management** | Vue composables (no Pinia) | `useTabStore()`, `useToolStore()`, `useUndoRedo()`, etc. Pinia unnecessary at this scale. |
| **Titlebar** | Native system titlebar | Start native; revisit only if cross-platform consistency demands custom. |
| **Icon set** | Lucide (`lucide-vue-next`) | MIT license, comprehensive, Vue component library available. |
| **Color picker** | Custom component: Flexoki swatches grid + native `<input type="color">` for arbitrary | No external library needed. |
| **Marker blending** | `source-over` with `globalAlpha: 0.4` | `multiply` is invisible on white backgrounds. Reduced-opacity `source-over` works universally. Each stroke rendered as a single filled shape (via `perfect-freehand`) so opacity is uniform — no overlap darkening within a stroke. |

#### Tauri v2 Integration

| Decision | Choice | Details |
|----------|--------|---------|
| **Clipboard read** | `readImage()` from `@tauri-apps/plugin-clipboard-manager` | Returns `Image` object; call `.rgba()` for `Uint8Array`. Convert to Blob → `URL.createObjectURL()` for display. |
| **Clipboard write** | `writeImage(uint8Array)` | Accepts raw RGBA pixel buffer. Extract from export canvas via `getImageData()`. |
| **Global shortcut** | `register('CommandOrControl+Shift+J', handler)` from `@tauri-apps/plugin-global-shortcut` | Callback has `event.state` — always check `=== 'Pressed'`. Use `CommandOrControl` for cross-platform. |
| **System tray** | Rust-side `TrayIconBuilder` in `setup()` | Requires `tray-icon` Cargo feature. Menu: Show / Settings / Quit. Left-click = show window. |
| **Window management** | `getCurrentWindow()` from `@tauri-apps/api/window` | `show()`, `hide()`, `setFocus()`. `onCloseRequested()` for close intercept. |
| **Close confirmation** | `@tauri-apps/plugin-dialog` for native dialogs OR custom Vue modal | Custom Vue modal preferred for design consistency (CloseWarningDialog from Penpot designs). |
| **Autostart** | `@tauri-apps/plugin-autostart` (already wired) | Toggle via settings. |

#### SpecFlow Gap Resolutions

These address the critical and important gaps identified by the SpecFlow analysis:

| Gap | Resolution |
|-----|-----------|
| **C1: Zoom/Pan unspecified** | Default: fit-to-window. Controls: Cmd+/- and scroll wheel (with Ctrl/Cmd). Range: 25%–800%. All tools operate in image-space coordinates (pointer events transformed by zoom factor). Export always produces full-resolution image regardless of zoom. |
| **C2: Blur reversibility** | Minimum Gaussian blur radius: 20px. Add subtle informational text in redaction sub-toolbar: "Solid fill is the most secure option." No modal warning — just education. |
| **C3: Redaction export atomicity** | Export pipeline: (1) clear clipboard first, (2) flatten all layers, (3) write result. If any step fails, show error toast. Clipboard never contains partially-redacted image. |
| **C4: No accessibility** | v1 baseline: keyboard navigation for all tools (1-9 hotkeys), ARIA labels on all interactive elements, visible focus indicators, theme-aware contrast ratios meet WCAG AA. Full screen reader support deferred to v2. |
| **C5: Image formats undefined** | Accept whatever Tauri's clipboard-manager provides (platform-dependent RGBA). Preserve alpha channel; show checkerboard behind transparency. Animated images: use first frame. No explicit format filtering. |
| **C6: Error display** | Error toast component (same pattern as success toast but red/warning semantic tokens). Error messages for: clipboard read/write failure, save-to-file failure, hotkey registration failure. Auto-dismiss after 3 seconds. |
| **I1: Auto-copy + close-warning matrix** | `auto-copy ON + edits since copy → copy silently and close (no dialog)`. `auto-copy ON + no edits → close directly`. `auto-copy OFF + edits since copy → show warning dialog`. `auto-copy OFF + no edits → close directly`. |
| **I2: Quit with multiple unsaved tabs** | Single aggregate dialog: "N tabs have uncopied edits. Copy All & Quit / Discard All & Quit / Cancel." |
| **I3: Auto-duplication trigger** | Trigger on first stroke/click on canvas (not tool selection). Selecting a tool without drawing does not create a tab. |
| **I4: Select tool spec** | Selects SVG annotations and redaction rectangles. Click to single-select. Shift+click for multi-select. Click on empty space deselects. Delete key removes selected. No drag-to-select box in v1. Clicking freehand strokes does nothing (paint-and-forget). |
| **I5: Minimum shape size** | Shapes below 5px in any dimension are discarded on pointerup. |
| **I6: Overlapping annotation selection** | Top-most (last-created) wins. Tab key cycles through overlapping annotations at click point. |
| **I7: Annotations vs. crop** | Annotations outside crop are visually clipped but preserved in data. Undo crop restores visibility. Export clips to crop bounds. |
| **I8: Retina/HiDPI** | Canvas uses `devicePixelRatio` for rendering (CSS size vs canvas buffer size). All coordinate calculations account for DPI. Export uses original image dimensions. |
| **I9: Rich text export fidelity** | Render text via foreignObject-in-SVG → Image → drawImage approach. If artifacts, fall back to canvas `fillText()` for plain text, foreignObject for styled. |
| **I10: Marker blending** | `source-over` with `globalAlpha: 0.4` (see Rendering Architecture table above). |
| **I11: Menu bar** | File (Copy to Clipboard, Save, Save As, Close Tab, Quit), Edit (Undo, Redo, Copy, Delete, Select All, Duplicate Tab), View (Zoom In/Out, Fit to Window, Actual Size, Theme), Tools (all 12), Window (tab list). |
| **I12: Window close platform behavior** | macOS: window close → hide to tray (Cmd+Q to quit). Windows: window close → hide to tray (tray → Quit to exit). |
| **I13: Clipboard monitoring** | No background polling. Clipboard tab updates on: app launch, global hotkey activation, manual refresh button click. |
| **I14: Tab limit** | No hard limit. Document expected memory: ~5–10MB per tab at 1080p (image + layers + 50 undo steps). System memory is the natural limit. |

## Technical Approach

### Architecture

```
┌──────────────────────────────────────────────────┐
│                   App Window                      │
│  ┌──────────────────────────────────────────────┐│
│  │ Tab Bar (flex-wrap for multi-row overflow)    ││
│  ├──────────────────────────────────────────────┤│
│  │ Toolbar (12 tools + 7 action buttons)        ││
│  ├──────────────────────────────────────────────┤│
│  │ Sub-toolbar (per-tool parameters, collapsible)││
│  ├──────────────────────────────────────────────┤│
│  │              Canvas Viewport                  ││
│  │  ┌────────────────────────────────────────┐  ││
│  │  │ z:0  <img>     Base image              │  ││
│  │  │ z:1  <canvas>  Redaction layer         │  ││
│  │  │ z:2  <canvas>  Freehand (perfect-freehand)│││
│  │  │ z:3  <svg>     SVG annotations (Vue)   │  ││
│  │  │ z:10 <div>     Text editor overlay     │  ││
│  │  │ z:20 <div>     Trim/crop overlays      │  ││
│  │  └────────────────────────────────────────┘  ││
│  └──────────────────────────────────────────────┘│
│  System Tray (background, always running)         │
└──────────────────────────────────────────────────┘
```

**Pointer event routing:** All pointer events captured on the canvas viewport container (`pointer-events: none` on all layers except an invisible interaction overlay at the top). Events routed to the appropriate layer handler based on the active tool. This prevents z-index pointer event conflicts.

**Zoom/pan model:** The canvas viewport applies CSS `transform: scale(N) translate(X, Y)` to the layer container. All pointer coordinates are transformed to image-space via `getScreenCTM()` inverse. Zoom controls: Cmd+/-, scroll wheel (with Cmd/Ctrl), pinch gesture. Default: fit-to-window.

### Export Flattening Pipeline

```
1. Create offscreen canvas at image dimensions (accounting for crop)
2. drawImage(baseImage, crop offset)
3. For each redaction region:
   a. Read base image pixels at region bounds
   b. Apply redaction effect (solid fill / pixelate / blur)
   c. Write result to offscreen canvas — DESTRUCTIVE
4. drawImage(freehandCanvas, crop offset)
5. Clone SVG, remove interactive elements (handles, selection)
6. Serialize SVG → Blob URL → Image → drawImage()
7. Render text overlays → intermediate canvas → drawImage()
8. canvas.toBlob('image/png') → result
9. Write to clipboard via writeImage() or save to file
```

**Redaction security:** Clear clipboard before step 1. If any step fails, show error toast and abort — clipboard remains empty. Never write a partially-flattened image.

### Undo/Redo Architecture

Command pattern with per-tab independent stacks. Max depth: 50.

| Layer | Strategy | Data per Command | Undo Cost |
|-------|----------|-----------------|-----------|
| SVG Annotations | Object mutation | Before/after snapshot | O(1) |
| Redaction | Object mutation | Before/after region+style | O(1) |
| Freehand Canvas | Compositing stroke replay | Stroke path data (`[x,y,pressure][]`) | O(n) from checkpoint |
| Crop | Metadata swap | Previous/new viewport rect | O(1) |

**Eraser = compositing stroke** with `globalCompositeOperation: 'destination-out'`. All freehand strokes replayed in order. Undo = remove stroke + replay remaining. No canvas snapshots needed.

**Checkpoint model:** When strokes are pruned from history (cap exceeded), they're baked into a single ImageData checkpoint. Replay starts from checkpoint, not stroke #1. Memory: ~1.7MB per tab at 4K (vs ~1.6GB with naive snapshots).

**`savedAtIndex` tracking:** Cursor position saved on copy/export. `isEdited = cursor !== savedAtIndex`. Full undo back to save point → no close warning.

**Two-tier text undo:** When rich text box has focus, Cmd+Z does text-level undo. On blur, entire text session committed as single `SvgMutateCommand`.

### File Structure

```
src/
├── App.vue
├── main.ts
├── assets/
│   ├── flexoki.css          (existing — Flexoki primitives)
│   ├── tokens.css           (semantic tokens, light/dark)
│   └── reset.css            (base reset + typography)
├── components/
│   ├── AppShell.vue
│   ├── TabBar.vue
│   ├── TabItem.vue
│   ├── TabNameEditor.vue
│   ├── Toolbar.vue
│   ├── ToolButton.vue
│   ├── ActionButton.vue
│   ├── SubToolbar.vue
│   ├── CanvasViewport.vue
│   ├── FreehandCanvas.vue
│   ├── SvgAnnotationLayer.vue
│   ├── RedactionCanvas.vue
│   ├── SelectionHandles.vue
│   ├── ContextualPanel.vue
│   ├── ColorPicker.vue
│   ├── StrokeWidthSelector.vue
│   ├── OpacitySlider.vue
│   ├── FillToggle.vue
│   ├── FontSelector.vue
│   ├── FontSizeSelector.vue
│   ├── TextEditor.vue
│   ├── TrimOverlay.vue
│   ├── CropOverlay.vue
│   ├── EmptyClipboard.vue
│   ├── ToastNotification.vue
│   ├── CloseWarningDialog.vue
│   ├── QuitWarningDialog.vue
│   ├── SettingsDialog.vue
│   └── annotations/
│       ├── RectAnnotation.vue
│       ├── EllipseAnnotation.vue
│       ├── ArrowAnnotation.vue
│       ├── LineAnnotation.vue
│       ├── CalloutAnnotation.vue
│       └── TextAnnotation.vue
├── composables/
│   ├── useClipboard.ts
│   ├── useTabStore.ts
│   ├── useToolStore.ts
│   ├── useUndoRedo.ts
│   ├── useAnnotationStore.ts
│   ├── useDrawing.ts
│   ├── useRedaction.ts
│   ├── useSelection.ts
│   ├── useShapeCreation.ts
│   ├── useTextEditing.ts
│   ├── useExport.ts
│   ├── useCrop.ts
│   ├── useZoom.ts
│   ├── usePointerRouter.ts
│   ├── useGlobalHotkey.ts
│   ├── useSettings.ts
│   └── useKeyboard.ts
├── commands/
│   ├── FreehandStrokeCommand.ts
│   ├── SvgCreateCommand.ts
│   ├── SvgMutateCommand.ts
│   ├── SvgDeleteCommand.ts
│   ├── RedactionCreateCommand.ts
│   ├── RedactionMutateCommand.ts
│   ├── RedactionDeleteCommand.ts
│   ├── CalloutDeleteCommand.ts
│   ├── CropCommand.ts
│   └── CompoundCommand.ts
└── types/
    ├── tab.ts
    ├── tools.ts
    ├── annotations.ts
    ├── freehand.ts
    ├── redaction.ts
    └── commands.ts

src-tauri/
├── src/
│   ├── lib.rs               (plugin registration, tray setup, commands)
│   ├── main.rs              (entry point)
│   └── trim.rs              (border detection algorithm)
├── Cargo.toml               (add global-shortcut, dialog, tray-icon feature)
├── capabilities/
│   ├── default.json          (clipboard, window, tray, dialog permissions)
│   └── desktop.json          (autostart, global-shortcut permissions)
└── tauri.conf.json           (window size, CSP)

test/
├── tokens.test.ts
├── app-shell.test.ts
├── clipboard.test.ts
├── tab-store.test.ts
├── close-warning.test.ts
├── undo-redo.test.ts
├── freehand.test.ts
├── tool-store.test.ts
├── toolbar.test.ts
├── sub-toolbar.test.ts
├── color-picker.test.ts
├── selection.test.ts
├── annotation-store.test.ts
├── shapes.test.ts
├── arrows.test.ts
├── callouts.test.ts
├── text-tool.test.ts
├── redaction.test.ts
├── crop.test.ts
├── export.test.ts
├── export-full.test.ts
├── hotkey.test.ts
├── settings.test.ts
├── keyboard.test.ts
├── ephemeral.test.ts
├── zoom.test.ts
├── mocks.ts
└── integration/
    ├── clipboard-round-trip.test.ts
    ├── annotation-workflow.test.ts
    └── redaction-security.test.ts
```

### Dependencies to Install

**JavaScript (bun add):**
```
perfect-freehand            # ~3KB, pressure-sensitive freehand strokes
lucide-vue-next             # Icon library
@tauri-apps/plugin-global-shortcut  # Global keyboard shortcut
@tauri-apps/plugin-dialog   # Native dialogs (save file)
```

**Rust (Cargo.toml):**
```toml
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-global-shortcut = "2"
tauri-plugin-dialog = "2"
# Already present: tauri-plugin-clipboard-manager, tauri-plugin-autostart, tauri-plugin-opener
```

**Capability permissions to add:**
```json
{
  "permissions": [
    "clipboard-manager:allow-read-image",
    "clipboard-manager:allow-write-image",
    "clipboard-manager:allow-clear",
    "global-shortcut:allow-register",
    "global-shortcut:allow-unregister",
    "global-shortcut:allow-is-registered",
    "core:tray:default",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-set-focus",
    "core:window:allow-minimize",
    "core:window:allow-unminimize",
    "dialog:allow-save"
  ]
}
```

## Implementation Phases

### Phase 1: Foundation — App Shell & Clipboard Round-Trip

**Milestone: Paste image → view in app → copy back to clipboard works.**

#### Unit 1: Design Tokens & Base Styles

**Goal:** Replace Tauri template with Flexoki semantic token system.
**Requirements:** Design System R1–R6
**Dependencies:** None

**Files:**
- Create: `src/assets/tokens.css` — semantic tokens for light + dark themes
- Create: `src/assets/reset.css` — minimal reset + base typography
- Modify: `src/App.vue` — remove template demo
- Modify: `src/main.ts` — import tokens.css and reset.css
- Test: `test/tokens.test.ts`

**Approach:**
- Semantic tokens as CSS custom properties referencing Flexoki primitives
- Light theme: `:root` default. Dark theme: `.theme-dark` on `:root`
- OS preference via `prefers-color-scheme` sets initial theme
- Components reference only semantic tokens, never Flexoki primitives

**Acceptance:**
- [ ] All token categories defined (surfaces, text, borders, interactive, tabs, annotations, overlays, feedback, shadows)
- [ ] Light and dark themes have distinct values
- [ ] App renders with warm Flexoki tones

#### Unit 2: App Shell Layout

**Goal:** Build the 4-section layout: tab bar → toolbar → sub-toolbar → canvas viewport.
**Requirements:** Design System R7–R11, R38–R40
**Dependencies:** Unit 1

**Files:**
- Create: `src/components/AppShell.vue` — CSS Flexbox vertical stack
- Create: `src/components/TabBar.vue` — placeholder
- Create: `src/components/Toolbar.vue` — placeholder
- Create: `src/components/SubToolbar.vue` — placeholder
- Create: `src/components/CanvasViewport.vue` — fills remaining space
- Modify: `src/App.vue` — mount AppShell
- Test: `test/app-shell.test.ts`

**Approach:**
- Tab bar, toolbar, sub-toolbar: fixed height, `flex-shrink: 0`
- Canvas viewport: `flex: 1`, `overflow: hidden`, `position: relative`
- Minimum window size: 800×500 (set in `tauri.conf.json`)

**Acceptance:**
- [ ] Four sections render in correct order
- [ ] Canvas viewport fills remaining space
- [ ] Fixed sections don't scroll with canvas

#### Unit 3: Clipboard Integration & Base Image Display

**Goal:** Read clipboard images and display them. Implement the permanent clipboard tab.
**Requirements:** Ephemeral R7, R10; Layer Architecture R2
**Dependencies:** Unit 2

**Files:**
- Create: `src/composables/useClipboard.ts` — wraps Tauri clipboard plugin
- Create: `src/composables/useTabStore.ts` — tab state management
- Create: `src/types/tab.ts` — Tab, LayerState types
- Create: `src/components/EmptyClipboard.vue` — no-image state
- Modify: `src/components/CanvasViewport.vue` — render base image
- Modify: `src/components/TabBar.vue` — render clipboard tab
- Create: `src/components/TabItem.vue` — individual tab
- Test: `test/clipboard.test.ts`, `test/tab-store.test.ts`

**Approach:**
- `readImage()` → `.rgba()` → `Uint8Array` → create `ImageData` → draw to temp canvas → `toBlob()` → `URL.createObjectURL()` for `<img>` display
- Clipboard tab always at index 0, cannot be closed
- Each tab: `{ id, name, type, imageUrl, imageWidth, imageHeight, layerState, undoHistory, copiedSinceLastEdit }`
- Handle clipboard with no image: show `EmptyClipboard.vue` with instruction text

**Edge cases (from SpecFlow):**
- Non-image clipboard content → show empty state
- Very large images (>16384px) → scale down to max canvas size, show info toast
- Alpha channel images → preserve alpha, show checkerboard background
- Clipboard read failure → show error toast

**Acceptance:**
- [ ] App displays clipboard image on launch
- [ ] Empty state shows when no image in clipboard
- [ ] Tab bar shows clipboard tab
- [ ] Large images handled gracefully

#### Unit 4: Tab System & Auto-Duplication

**Goal:** Full tab lifecycle: create, switch, close, rename, auto-duplicate on first edit of clipboard tab.
**Requirements:** Layer Architecture R15–R20; Ephemeral R3, R8, R11
**Dependencies:** Unit 3

**Files:**
- Modify: `src/composables/useTabStore.ts` — duplication, closing, renaming
- Modify: `src/components/TabBar.vue` — multi-row overflow (flex-wrap)
- Modify: `src/components/TabItem.vue` — close button, double-click rename, copied badge
- Create: `src/components/TabNameEditor.vue` — inline text input
- Create: `src/components/CloseWarningDialog.vue` — Copy & Close / Discard / Cancel
- Create: `src/components/QuitWarningDialog.vue` — aggregate for app quit
- Test: `test/tab-store.test.ts`, `test/close-warning.test.ts`

**Approach:**
- **Auto-duplication trigger: first stroke/click on canvas** (not tool selection) while clipboard tab is active. Deep-copy image into new editing tab, switch focus. Clipboard tab reverts to showing current clipboard.
- Tab naming: configurable timestamp pattern (default: `HH:mm:ss`). Double-click to rename.
- **Auto-copy + close-warning matrix** (resolved SpecFlow I1):
  - Auto-copy ON + edits since copy → copy silently, close
  - Auto-copy ON + no edits → close directly
  - Auto-copy OFF + edits since copy → show warning dialog
  - Auto-copy OFF + no edits → close directly
- App quit with unsaved tabs → single aggregate dialog
- Tab bar: `display: flex; flex-wrap: wrap` — wraps to multiple rows

**Acceptance:**
- [ ] First canvas interaction on clipboard tab creates editing tab
- [ ] Clipboard tab reverts to current clipboard after duplication
- [ ] Close-warning matrix works correctly for all 4 scenarios
- [ ] App quit shows aggregate dialog when multiple tabs have edits
- [ ] Tab renaming via double-click
- [ ] Multi-row tab bar wraps correctly

#### Unit 5: Undo/Redo Infrastructure

**Goal:** Command-pattern undo/redo spanning all layers, per-tab stacks.
**Requirements:** Layer Architecture R10–R11
**Dependencies:** Unit 4

**Files:**
- Create: `src/composables/useUndoRedo.ts` — stack management with `push`, `undo`, `redo`, `clone`
- Create: `src/types/commands.ts` — `Command`, `CompoundCommand` interfaces
- Test: `test/undo-redo.test.ts`

**Approach:**
- Cursor-based stack (not separate undo/redo arrays). Cursor points to last executed command.
- `push()` truncates redo branch, appends, executes. `undo()` calls `.undo()`, decrements. `redo()` increments, calls `.execute()`.
- `isOperationInProgress` flag prevents undo during active draw/drag.
- `savedAtIndex` for edited-state detection.
- `onCommandPruned` callback for freehand checkpoint creation.
- `clone(newContext)` for tab duplication.
- Max depth: 50.

**Acceptance:**
- [ ] Push/undo/redo work correctly
- [ ] Redo branch cleared on new action
- [ ] History cap with pruning callback
- [ ] `isEdited` correctly tracks save state
- [ ] `clone()` produces independent copy

#### Unit 6: Basic Export & Toast

**Goal:** Copy flattened image (base only initially) to clipboard. Toast notification.
**Requirements:** Ephemeral R1, R5–R6; Layer Architecture R12
**Dependencies:** Unit 3

**Files:**
- Create: `src/composables/useExport.ts` — flattening pipeline
- Create: `src/components/ToastNotification.vue` — success + error toast
- Modify: `src/composables/useTabStore.ts` — track `copiedSinceLastEdit`
- Test: `test/export.test.ts`

**Approach:**
- `copyToClipboard()`: offscreen canvas → drawImage(base) → toBlob → writeImage()
- Toast: auto-dismiss 1s for success, 3s for errors. Use semantic tokens for coloring.
- Tab "copied" badge set on success, cleared on next edit.
- Error toast for clipboard write failure.
- **Redaction security:** clear clipboard before flattening begins.

**Acceptance:**
- [ ] Paste in → copy back works end-to-end
- [ ] Success toast shows on copy
- [ ] Error toast shows on failure
- [ ] "Copied" badge lifecycle works

### Phase 2: Freehand Drawing

**Milestone: Paste → draw with pen/pencil/marker/eraser → copy back works.**

#### Unit 7: Freehand Canvas Layer & Pen Tool

**Goal:** Add freehand canvas overlay with pen tool using `perfect-freehand`.
**Requirements:** Layer Architecture R4; Tool Configuration R8
**Dependencies:** Unit 5, Unit 6

**Files:**
- Create: `src/components/FreehandCanvas.vue` — canvas overlay
- Create: `src/composables/useDrawing.ts` — pointer events, stroke rendering
- Create: `src/composables/usePointerRouter.ts` — event routing by active tool
- Create: `src/types/tools.ts` — tool definitions
- Create: `src/types/freehand.ts` — stroke data, checkpoint types
- Create: `src/composables/useToolStore.ts` — active tool, per-tool settings
- Create: `src/commands/FreehandStrokeCommand.ts` — undo integration
- Modify: `src/components/CanvasViewport.vue` — stack freehand above base
- Modify: `src/composables/useExport.ts` — include freehand in flattening
- Test: `test/freehand.test.ts`, `test/tool-store.test.ts`

**Approach:**
- Install `perfect-freehand`. Store strokes as `[x, y, pressure][]` arrays.
- `getStroke(points, options)` → outline polygon → `Path2D` → `ctx.fill()`.
- Each completed stroke pushed to undo stack as `FreehandStrokeCommand`.
- Undo = remove stroke from array, replay remaining strokes.
- Canvas renders at `devicePixelRatio` for Retina quality.
- **Pointer routing:** `usePointerRouter` captures all events on container, routes to `useDrawing` when freehand tool active.
- Coalesce pointermove via `requestAnimationFrame` for performance on high-refresh displays.

**Acceptance:**
- [ ] Pen draws smooth variable-width strokes
- [ ] Strokes appear above base image
- [ ] Undo removes last stroke, redo restores
- [ ] Freehand included in export
- [ ] Retina rendering is crisp

#### Unit 8: Pencil, Marker, Eraser Tools

**Goal:** Complete freehand tool family with distinct rendering characteristics.
**Requirements:** Tool Configuration R9–R11; Layer Architecture R5
**Dependencies:** Unit 7

**Files:**
- Modify: `src/composables/useDrawing.ts` — pencil, marker, eraser modes
- Modify: `src/composables/useToolStore.ts` — register tools with defaults
- Test: `test/freehand.test.ts` (extend)

**Approach:**
- Pencil: thinner default (2px), higher thinning, sharper stroke
- Marker: wider (20px), `globalAlpha: 0.4`, `thinning: 0` (uniform width), `source-over`
- Eraser: `globalCompositeOperation: 'destination-out'`. Shape/color don't matter — only the stroke outline mask.
- Each tool stores independent settings in `useToolStore()`

**Acceptance:**
- [ ] All four tools render with distinct characteristics
- [ ] Marker is semi-transparent, works on white backgrounds
- [ ] Eraser removes previously drawn strokes
- [ ] Tool settings independent (pen color ≠ marker color)
- [ ] Eraser is fully undoable (erased pixels reappear)

### Phase 3: Toolbar & Tool Configuration

**Milestone: All 12 tools accessible with configurable per-tool parameters.**

#### Unit 9: Main Toolbar

**Goal:** Build toolbar with all 12 tool buttons + 7 action buttons.
**Requirements:** Tool Configuration R1–R2; Design System R15–R16
**Dependencies:** Unit 7

**Files:**
- Create: `src/components/ToolButton.vue`, `src/components/ActionButton.vue`
- Modify: `src/components/Toolbar.vue` — populate with buttons
- Test: `test/toolbar.test.ts`

**Approach:**
- Install `lucide-vue-next`. Tool buttons grouped: freehand (pen, pencil, marker, eraser), shapes (arrow, line, rect, ellipse), annotation (callout, text), special (redact, select, crop).
- Action buttons: copy, save, undo, redo, refresh clipboard, smart trim.
- Active tool highlighted via `--interactive-active` token.
- Keyboard shortcuts: 1-0 for tools (v1 baseline accessibility).
- Centered 18px icons per Penpot design.

**Acceptance:**
- [ ] All 12 tools + 7 actions visible
- [ ] Active tool highlighted
- [ ] Keyboard shortcuts work (1-0)
- [ ] Undo/redo buttons disabled when stack empty

#### Unit 10: Sub-Toolbar with Per-Tool Settings

**Goal:** Expandable sub-toolbar showing active tool's parameters.
**Requirements:** Tool Configuration R3–R22
**Dependencies:** Unit 9

**Files:**
- Modify: `src/components/SubToolbar.vue`
- Create: `src/components/ColorPicker.vue` — Flexoki swatches + arbitrary
- Create: `src/components/StrokeWidthSelector.vue` — visual dot sizes
- Create: `src/components/OpacitySlider.vue`
- Create: `src/components/FillToggle.vue`
- Test: `test/sub-toolbar.test.ts`, `test/color-picker.test.ts`

**Approach:**
- Sub-toolbar renders parameter components based on active tool type.
- Parameter schemas per R8–R19: pen (color, width), marker (color, width, opacity), eraser (width), arrow/line (color, width), rect/ellipse (color, width, fill toggle, fill color, fill opacity), callout (fill color, size), text (font family, font size, color, B/I/U), redaction (style picker, block size for pixelation, blur radius for blur).
- Color picker: grid of 10 Flexoki annotation swatches + black/white + native `<input type="color">` for custom + recent colors row.
- Settings are reactive and per-tool-independent.
- Sub-toolbar expands with CSS transition, does not block canvas.

**Acceptance:**
- [ ] Each tool shows its specific parameters
- [ ] Per-tool settings remembered independently across tool switches
- [ ] Color picker shows Flexoki swatches and allows custom colors
- [ ] Recent colors accumulate within session
- [ ] Sub-toolbar is non-blocking

### Phase 4: SVG Annotation Layer

**Milestone: Structured annotations (shapes, arrows, callouts) fully functional.**

#### Unit 11: SVG Layer & Selection System

**Goal:** SVG overlay and core select/move/resize/rotate system.
**Requirements:** Layer Architecture R6–R7; Annotation Primitives R2, R23
**Dependencies:** Unit 5

**Files:**
- Create: `src/components/SvgAnnotationLayer.vue`
- Create: `src/components/SelectionHandles.vue` — 8 resize + rotation handle
- Create: `src/composables/useSelection.ts` — hit testing, transforms
- Create: `src/composables/useAnnotationStore.ts` — CRUD per tab
- Create: `src/types/annotations.ts` — BaseAnnotation, Rect, Ellipse, Arrow, Line, Callout, Text
- Modify: `src/components/CanvasViewport.vue` — stack SVG above freehand
- Test: `test/selection.test.ts`, `test/annotation-store.test.ts`

**Approach:**
- SVG: `<svg>` with `position: absolute`, `viewBox` matching image dimensions. `pointer-events: none` (events routed via usePointerRouter).
- Each annotation = Vue component rendering SVG primitives. Reactive props.
- Selection handles: 8 corner/edge rects + rotation circle above center. `pointer-events: auto` on handles only.
- Drag: capture pointer delta, apply to position. Batch into single undo command (capture state at pointerdown, commit at pointerup).
- Resize: handle drag recalculates dimensions. Shift constrains aspect ratio.
- Hit testing: use SVG `getScreenCTM()` for coordinate conversion. Add invisible wider hit areas (16px) on thin elements.
- Multi-select via Shift+click. Delete key removes selected.
- Top-most annotation wins on click. Tab cycles overlapping at same point.

**Acceptance:**
- [ ] Annotations render in SVG layer
- [ ] Click to select, shows handles
- [ ] Drag to move, resize via handles
- [ ] Shift constrains aspect ratio on resize
- [ ] All mutations undoable
- [ ] Multi-select with Shift+click
- [ ] Delete key removes selected
- [ ] Tab cycles overlapping annotations

#### Unit 12: Rectangle & Ellipse Tools

**Goal:** Click-and-drag shape creation.
**Requirements:** Annotation Primitives R9–R12
**Dependencies:** Unit 11

**Files:**
- Create: `src/components/annotations/RectAnnotation.vue`
- Create: `src/components/annotations/EllipseAnnotation.vue`
- Create: `src/composables/useShapeCreation.ts`
- Create: `src/commands/SvgCreateCommand.ts`
- Modify: `src/composables/useExport.ts` — SVG in flattening
- Test: `test/shapes.test.ts`

**Approach:**
- Pointerdown sets origin, pointermove updates opposite corner (with preview), pointerup finalizes.
- Shift constrains ellipse→circle, rect→square.
- Shapes below 5px in any dimension discarded (SpecFlow I5).
- Stroke/fill from tool settings. Fill off by default.
- SVG: `<rect>`, `<ellipse>`.
- Export: clone SVG, serialize, Image, drawImage.

**Acceptance:**
- [ ] Click-and-drag creates shapes
- [ ] Shift constrains proportions
- [ ] Shapes below 5px discarded
- [ ] Fill toggle works
- [ ] Shapes included in export

#### Unit 13: Arrow & Line Tools

**Goal:** Bendable arrow (quadratic Bezier) and straight line.
**Requirements:** Annotation Primitives R3–R8
**Dependencies:** Unit 11

**Files:**
- Create: `src/components/annotations/ArrowAnnotation.vue`
- Create: `src/components/annotations/LineAnnotation.vue`
- Modify: `src/components/SelectionHandles.vue` — Bezier control point handle
- Test: `test/arrows.test.ts`

**Approach:**
- Arrow: SVG `<path>` with quadratic Bezier (`Q` command). Three points: start, end, control.
- Click-and-drag sets start + end. Control point defaults to midpoint (straight).
- When selected: draggable control point handle bends the arrow. Dashed guide lines from endpoints to control point.
- Arrowhead: manually drawn triangle at end point, oriented along curve tangent. Scales with stroke width.
- Line: SVG `<line>`, no arrowhead.
- Shift constrains to 15° angle increments.

**Acceptance:**
- [ ] Arrow renders straight when control at midpoint
- [ ] Dragging control handle bends the arrow
- [ ] Arrowhead points correctly even when curved
- [ ] Shift constrains angle
- [ ] Line tool works independently

#### Unit 14: Numbered Callout Tool

**Goal:** Numbered callouts with auto-increment and auto-renumber on delete.
**Requirements:** Annotation Primitives R13–R16
**Dependencies:** Unit 11

**Files:**
- Create: `src/components/annotations/CalloutAnnotation.vue`
- Create: `src/commands/CalloutDeleteCommand.ts` — captures renumber state
- Modify: `src/composables/useAnnotationStore.ts` — counter, renumber logic
- Test: `test/callouts.test.ts`

**Approach:**
- SVG `<circle>` + `<text>` centered inside. Placed on single click.
- Auto-increment counter per tab. Each click = next number.
- Delete triggers renumber: scan remaining callouts, assign 1, 2, 3...
- `CalloutDeleteCommand` stores renumber map for undo: `Map<id, { before, after }>`.
- Number text color: white on dark fills (luminance < 0.5), dark on light fills.
- Fill on by default (annotation palette color). Configurable.

**Acceptance:**
- [ ] Sequential clicks produce 1, 2, 3...
- [ ] Deleting #2 renumbers #3→#2
- [ ] Undo restores original numbering
- [ ] Number color contrasts with fill

### Phase 5: Rich Text Tool

**Milestone: Text annotation with inline formatting works and exports correctly.**

#### Unit 15: Rich Text Box

**Goal:** Rich text with HTML overlay editing.
**Requirements:** Annotation Primitives R17–R21
**Dependencies:** Unit 11

**Files:**
- Create: `src/components/annotations/TextAnnotation.vue` — SVG placeholder + display
- Create: `src/components/TextEditor.vue` — contenteditable overlay
- Create: `src/composables/useTextEditing.ts` — editing state, formatting
- Modify: `src/components/CanvasViewport.vue` — text editor overlay layer
- Modify: `src/composables/useExport.ts` — text in flattening
- Test: `test/text-tool.test.ts`

**Approach:**
- Click to place: creates SVG annotation (rectangle) + activates HTML overlay at same position.
- `<div contenteditable>` absolutely positioned, `z-index: 50`, styled to match annotation coords.
- Formatting: `document.execCommand('bold'|'italic'|'underline')`, custom `<span>` wrapping for size/color/font-family. Font family selector with system fonts (see origin: tool-configuration R17, design-system R21).
- On blur: hide overlay, update annotation data, commit as `SvgMutateCommand`.
- Double-click SVG placeholder to re-enter editing.
- Display (non-editing): `foreignObject` with rendered HTML (safe for display, just not editing).
- Empty text box on blur → auto-delete (SpecFlow edge case).
- Export: wrap HTML in SVG foreignObject string → Blob → Image → drawImage.
- Optional background fill.

**Acceptance:**
- [ ] Click places editable text box
- [ ] B/I/U/size/color formatting within one box
- [ ] Double-click to re-edit
- [ ] Text movable/resizable via SVG handles
- [ ] Empty text auto-deleted on blur
- [ ] Text correctly rendered in export
- [ ] Two-tier undo: text-level when focused, global on blur

### Phase 6: Redaction Layer

**Milestone: Redaction is provably destructive on export.**

#### Unit 16: Redaction Tool

**Goal:** Three redaction styles, non-destructive during session, destructive on export.
**Requirements:** Dedicated Redaction R1–R13
**Dependencies:** Unit 5, Unit 6

**Files:**
- Create: `src/components/RedactionCanvas.vue`
- Create: `src/composables/useRedaction.ts`
- Create: `src/types/redaction.ts`
- Create: `src/commands/RedactionCreateCommand.ts`, `RedactionMutateCommand.ts`, `RedactionDeleteCommand.ts`
- Modify: `src/components/CanvasViewport.vue` — stack between base and freehand
- Modify: `src/composables/useExport.ts` — destructive redaction in pipeline
- Test: `test/redaction.test.ts`

**Approach:**
- Redaction canvas between base image (z:0) and freehand (z:2).
- Click-and-drag defines rectangle. Stored as data objects (position, size, style).
- Rendering (session): read base image pixels at region → apply effect → render on redaction canvas:
  - Solid fill: `ctx.fillRect()` with chosen color
  - Pixelation: read block averages, draw colored rectangles. Block size configurable in sub-toolbar (default: 12px, range: 4–32px) (see origin: dedicated-redaction R3)
  - Blur: `ctx.filter = 'blur(Npx)'` + clip region + drawImage. Radius configurable in sub-toolbar (default: 20px, range: 10–50px, minimum 20px for security) (see origin: dedicated-redaction R4)
- Redaction rects selectable/movable/resizable (via useSelection).
- Visual distinction: hatched border pattern or shield icon.
- **Export (destructive):** Step 3 of flattening pipeline applies redaction directly to base pixels. Original data permanently replaced.
- **Security:** Minimum blur radius 20px. Informational text in sub-toolbar: "Solid fill is the most secure option."
- **Atomicity:** Clear clipboard before export. Abort on any failure.
- Overlapping redactions with different styles render correctly (each applied independently to base pixels).
- Redactions outside crop still applied to base image; export clips to crop bounds.

**Acceptance:**
- [ ] All three redaction styles render correctly
- [ ] Redaction rects selectable, movable, resizable
- [ ] Visually distinct from annotation rectangles
- [ ] All CRUD operations undoable
- [ ] **Pixel inspection of export confirms no original data under redaction**
- [ ] Export never contains partially-redacted image (atomicity)

### Phase 7: Auto-Crop & Crop Tool

**Milestone: Auto-trim works on common screenshots. Manual crop works.**

#### Unit 17: Auto-Trim Detection (Rust Backend)

**Goal:** Fast border detection algorithm in Rust.
**Requirements:** Auto-Crop R1, R7
**Dependencies:** Unit 3

**Files:**
- Create: `src-tauri/src/trim.rs` — algorithm
- Modify: `src-tauri/src/lib.rs` — register `detect_trim_bounds` command
- Test: `test/trim-detection.test.ts` (integration)

**Approach:**
- Tauri command: `detect_trim_bounds(image_bytes: Vec<u8>, width: u32, height: u32, threshold: u8) -> TrimBounds { top, right, bottom, left }`
- Algorithm: sample corner pixel as border color. Scan each edge inward, checking all pixels in row/column against threshold. Per-channel: `max(|r1-r2|, |g1-g2|, |b1-b2|) <= threshold`.
- Default threshold: 10. Configurable in settings.
- Must complete within 50ms for 2560×1440.
- Handle asymmetric borders (shadow on one side).
- If entire image would be trimmed → return zero (enforce minimum 10×10 content).

**Acceptance:**
- [ ] Correct detection for uniform borders
- [ ] Handles JPEG artifacts within threshold
- [ ] Asymmetric borders detected per-edge
- [ ] Entire-image-trim returns zero
- [ ] < 50ms for 2560×1440

#### Unit 18: Trim Overlay & Crop Tool

**Goal:** Trim suggestion overlay, manual crop tool, crop-as-projection.
**Requirements:** Auto-Crop R1–R9; Layer Architecture R9
**Dependencies:** Unit 17, Unit 5

**Files:**
- Create: `src/components/TrimOverlay.vue`
- Create: `src/components/CropOverlay.vue`
- Create: `src/composables/useCrop.ts`
- Create: `src/commands/CropCommand.ts`
- Modify: `src/composables/useExport.ts` — apply crop in flattening
- Modify: `src/components/Toolbar.vue` — "Smart Trim" button
- Test: `test/crop.test.ts`

**Approach:**
- **Crop-as-projection:** `{ x, y, width, height }` metadata on tab. All layers rendered within this viewport. No layer data modified.
- **Trim overlay:** Dim border regions (dark overlay), content at full brightness, floating "Trim" button. Auto-shown when borders detected on clipboard read.
- Accept = apply as `CropCommand` (undoable). Cancel = starting to edit dismisses overlay. Also dismissed on clipboard refresh.
- **Manual crop tool:** Drag to define region, handles to adjust, Enter to apply, Esc to cancel.
- "Smart Trim" toolbar button: manually invokes detection on current tab anytime.
- Export respects crop bounds (offset all drawImage calls).

**Acceptance:**
- [ ] Auto-trim overlay appears for bordered images
- [ ] Accept applies crop, undoable
- [ ] Starting to edit dismisses overlay
- [ ] Manual crop tool works
- [ ] Smart Trim button triggers detection
- [ ] Export respects crop bounds

### Phase 8: System Integration

**Milestone: Full system integration — hotkey, tray, settings, ephemeral UX.**

#### Unit 19: Global Hotkey & System Tray

**Goal:** System-wide Cmd+Shift+J and system tray.
**Requirements:** Global Hotkey R1–R8; Design System R36–R37
**Dependencies:** Unit 3

**Files:**
- Modify: `src-tauri/Cargo.toml` — add `tauri-plugin-global-shortcut`
- Modify: `src-tauri/src/lib.rs` — register plugin, build tray in `setup()`
- Modify: `src-tauri/capabilities/desktop.json` — global-shortcut permissions
- Create: `src/composables/useGlobalHotkey.ts`
- Modify: `src/main.ts` — initialize hotkey
- Test: `test/hotkey.test.ts`

**Approach:**
- JS: `register('CommandOrControl+Shift+J', (event) => { if (event.state === 'Pressed') { ... } })`.
- Handler: show window → setFocus → switch to clipboard tab → readImage → display.
- Already focused + hotkey → refresh clipboard.
- No image → show empty state, still foreground.
- Rust tray: `TrayIconBuilder` with menu (Show / Settings / Quit). Left-click = show. `on_menu_event` for menu items.
- Window close → hide to tray (macOS behavior). Cmd+Q / tray Quit → exit.
- Hotkey conflict: wrap register in try/catch, show error toast on failure.
- Window appears on monitor where cursor is (Tauri default behavior).

**Acceptance:**
- [ ] Hotkey activates app from any context
- [ ] Re-press when focused refreshes clipboard
- [ ] Tray icon with Show/Settings/Quit menu
- [ ] Window close hides to tray
- [ ] Hotkey conflict shows error toast

#### Unit 20: Settings Dialog

**Goal:** Configurable settings with persistence.
**Requirements:** Global Hotkey R3; Auto-Crop R2, R7; Design System R2; Ephemeral R2
**Dependencies:** Unit 19

**Files:**
- Create: `src/components/SettingsDialog.vue` — modal
- Create: `src/composables/useSettings.ts` — state + localStorage persistence
- Modify: `src/composables/useGlobalHotkey.ts` — dynamic re-registration
- Test: `test/settings.test.ts`

**Settings:**
- **Hotkey:** Key combination capture input (press to record). Unregister old, register new.
- **Theme:** Dropdown (Light / Dark / System). Applies `.theme-dark` or removes it.
- **Auto-copy on close:** Toggle (default: ON).
- **Auto-trim on paste:** Toggle (default: ON).
- **Trim threshold:** Slider 0–50 (default: 10).
- **Tab name pattern:** Text input (default: `HH:mm:ss`).
- **Autostart:** Toggle (controls `@tauri-apps/plugin-autostart`).

**Approach:**
- Store in `localStorage` (lightweight, no Tauri store plugin needed).
- All changes apply immediately (reactive).
- Hotkey change: `unregister(old)` then `register(new)`. If new fails, revert to old with error toast.

**Acceptance:**
- [ ] All settings configurable and take effect immediately
- [ ] Settings persist across restarts
- [ ] Hotkey re-registration works (with fallback on failure)
- [ ] Theme toggle switches all tokens

#### Unit 21: Keyboard Shortcuts & Ephemeral UX Polish

**Goal:** Complete keyboard shortcuts, auto-copy lifecycle, save-to-file.
**Requirements:** Ephemeral R1–R11
**Dependencies:** Unit 4, Unit 6, Unit 20

**Files:**
- Create: `src/composables/useKeyboard.ts` — shortcut registration
- Modify: `src/composables/useTabStore.ts` — auto-copy on close
- Modify: `src/components/TabItem.vue` — persistent "copied" badge
- Modify: `src/composables/useExport.ts` — save-to-file via dialog plugin
- Test: `test/keyboard.test.ts`, `test/ephemeral.test.ts`

**Keyboard shortcuts:**
| Shortcut | Action |
|----------|--------|
| Cmd+C | Copy flattened image (custom intercept) |
| Cmd+S | Save to file |
| Cmd+W | Close tab |
| Cmd+Z | Undo |
| Cmd+Shift+Z | Redo |
| Cmd+Y | Redo (alt) |
| Cmd+= / Cmd+- | Zoom in/out |
| Cmd+0 | Fit to window |
| Delete / Backspace | Delete selected annotation |
| Escape | Deselect / cancel crop / exit tool |
| Tab | Cycle overlapping annotations |
| 1-0 | Select tools |

**Approach:**
- Cmd+C intercepts default browser copy. Triggers flattened export → clipboard write → success toast.
- Cmd+C on empty/no-image tab → no-op (brief "Nothing to copy" toast).
- Rapid Cmd+C debounced (300ms).
- Auto-copy on close: when closing tab with setting enabled + edits since copy, copy then close (no dialog).
- "Copied" badge: green dot on tab, set on copy, cleared on next edit.
- Save-to-file: `@tauri-apps/plugin-dialog` save dialog → write PNG blob to path.

**Acceptance:**
- [ ] All keyboard shortcuts work
- [ ] Cmd+C copies flattened image (not browser selection)
- [ ] Auto-copy on close works per matrix
- [ ] "Copied" badge lifecycle correct
- [ ] Save-to-file writes valid image
- [ ] Cmd+C debounced

### Phase 9: Zoom, Polish & Integration

**Milestone: Complete feature set, all acceptance criteria pass.**

#### Unit 22: Zoom & Pan

**Goal:** Zoom/pan the canvas viewport with all tools working correctly.
**Requirements:** Design System R38 (canvas viewport), SpecFlow C1
**Dependencies:** Unit 2

**Files:**
- Create: `src/composables/useZoom.ts` — zoom state, transforms
- Modify: `src/components/CanvasViewport.vue` — CSS transform on layer container
- Modify: `src/composables/usePointerRouter.ts` — transform pointer coords to image space
- Test: `test/zoom.test.ts`

**Approach:**
- Zoom state: `{ scale: number, panX: number, panY: number }` per tab.
- CSS `transform: scale(${scale}) translate(${panX}px, ${panY}px)` on the layer container.
- Default: fit-to-window (calculate scale from image dimensions / viewport dimensions).
- Controls: Cmd+= (zoom in), Cmd+- (zoom out), Cmd+0 (fit), scroll wheel with Cmd/Ctrl held.
- Range: 0.25–8.0 (25%–800%).
- Pointer coordinate transformation: divide by scale factor. Use `getScreenCTM()` inverse for SVG elements.
- Zoom is NOT undoable (viewport navigation).
- Smooth CSS transition on programmatic zoom changes.

**Acceptance:**
- [ ] Fit-to-window on image load
- [ ] Keyboard and scroll wheel zoom work
- [ ] All tools draw at correct image-space coordinates when zoomed
- [ ] Export produces full-resolution image regardless of zoom
- [ ] Zoom range 25%–800%

#### Unit 23: Full Export Pipeline

**Goal:** Complete flattening with all 4 layers + text + crop + destructive redaction.
**Requirements:** Layer Architecture R12–R14; Redaction R11
**Dependencies:** Units 6, 7, 12, 15, 16, 18

**Files:**
- Modify: `src/composables/useExport.ts` — complete pipeline
- Test: `test/export-full.test.ts`

**Approach:**
- Follow the 9-step pipeline from Technical Approach section.
- SVG serialization: clone, remove `[data-export-exclude]` elements (handles, selection), serialize, Blob URL, Image, drawImage.
- Text: foreignObject SVG string → Blob → Image → drawImage at text position.
- All coordinates offset by crop bounds.
- Redaction applied destructively to base pixels BEFORE upper layers.
- Atomic: clipboard cleared first, error = abort.

**Acceptance:**
- [ ] All layers present in correct order in export
- [ ] Redacted regions contain only redaction fill
- [ ] Crop correctly clips output dimensions
- [ ] Text rendered at correct position
- [ ] Produces valid PNG blob

#### Unit 24: Contextual Property Panel

**Goal:** Floating panel for post-creation property editing of selected annotations.
**Requirements:** Annotation Primitives R25; Design System R29
**Dependencies:** Unit 11

**Files:**
- Create: `src/components/ContextualPanel.vue`
- Modify: `src/composables/useSelection.ts` — expose selected props
- Create: `src/commands/SvgMutateCommand.ts`
- Test: `test/contextual-panel.test.ts`

**Approach:**
- Small floating panel near selected annotation. Shows: color, stroke width, fill toggle, opacity.
- Changes apply immediately, committed as `SvgMutateCommand` on panel close/deselect.
- Auto-hides on deselect. Positioned to avoid obscuring the annotation.

**Acceptance:**
- [ ] Panel appears on selection with current properties
- [ ] Changes apply in real-time
- [ ] Changes undoable
- [ ] Panel auto-hides on deselect

#### Unit 25: Menu Bar

**Goal:** Application menu bar mirroring toolbar actions.
**Requirements:** Ephemeral R9; Design System (implied)
**Dependencies:** Unit 21

**Files:**
- Modify: `src-tauri/src/lib.rs` — menu bar setup
- Modify: `src/main.ts` — menu event handling

**Structure:**
- File: Save (Cmd+S), Save As, Close Tab (Cmd+W), Quit (Cmd+Q)
- Edit: Undo (Cmd+Z), Redo (Cmd+Shift+Z), Copy (Cmd+C), Delete, Select All
- View: Zoom In (Cmd+=), Zoom Out (Cmd+-), Fit to Window (Cmd+0), Actual Size (Cmd+1), Theme Toggle
- Tools: Select, Pen, Pencil, Marker, Eraser, Arrow, Line, Rectangle, Ellipse, Callout, Text, Redaction, Crop

**Acceptance:**
- [ ] All menu items functional
- [ ] Keyboard accelerators match shortcuts
- [ ] Menu items disabled when not applicable

#### Unit 26: End-to-End Integration Testing

**Goal:** Validate complete workflows.
**Requirements:** All
**Dependencies:** All

**Files:**
- Create: `test/integration/clipboard-round-trip.test.ts`
- Create: `test/integration/annotation-workflow.test.ts`
- Create: `test/integration/redaction-security.test.ts`

**Test scenarios:**
1. Full round-trip: paste → draw freehand → add arrow → add text → add redaction → crop → copy → verify all content in output
2. Tab lifecycle: create → edit → undo → redo → close with warning → copy & close
3. Redaction security: solid + pixelate + blur → export → pixel inspection confirms no original data
4. Cross-layer undo: draw → annotate → redact → crop → undo 4× → verify each restored
5. Tab duplication: 10 edits → duplicate → undo 5× in clone → verify original unaffected

**Acceptance:**
- [ ] All integration test scenarios pass
- [ ] All 148 requirements from brainstorm documents satisfied

## Alternative Approaches Considered

| Approach | Rejected Because |
|----------|-----------------|
| **Event-sourced document model** | "Architecture astronautics" — overkill for ephemeral single-user app (see origin: ideation doc, rejection #13) |
| **Full ImageData snapshots per undo** | ~940× more memory than command pattern at 4K (see origin: undo-redo plan 002) |
| **OffscreenCanvas / Web Workers** | Premature optimization — benchmark first (see origin: ideation doc, rejection #15) |
| **foreignObject for rich text editing** | 56 open WebKit bugs — broken on Safari/Tauri macOS (see origin: prior research session) |
| **SVG.js or D3 for annotations** | Fights Vue's reactivity model. Vue 3 has first-class SVG support. |
| **Pinia for state** | Unnecessary abstraction at this scale. Vue composables sufficient. |
| **Fabric.js for canvas** | 300KB+ library for a feature set we only need 10% of. `perfect-freehand` (3KB) covers freehand. |
| **html2canvas for export** | Re-renders DOM, doesn't capture canvas content. Sequential drawImage is simpler and correct. |
| **Clipboard polling** | Performance overhead, unexpected content changes. Manual refresh only. |
| **Named preset system** | Per-tool remembered settings is simpler and more intuitive (see origin: tool-configuration R1–R3) |

## System-Wide Impact

### Interaction Graph

Tool activation → `usePointerRouter` routes events → layer-specific handler (freehand: `useDrawing`, SVG: `useShapeCreation`/`useSelection`, redaction: `useRedaction`, crop: `useCrop`) → mutation → `useUndoRedo.push(command)` → Vue reactivity triggers re-render.

Clipboard operations cross Rust/JS boundary: `readImage()` → Tauri IPC → Rust clipboard-manager → RGBA bytes → JS. `writeImage()` reverse path.

Global hotkey: OS → Tauri global-shortcut → Rust handler → JS event → `useGlobalHotkey` → show window + read clipboard.

### Error & Failure Propagation

| Error | Handling |
|-------|----------|
| Clipboard read fails | Error toast "Unable to read clipboard." Empty state shown. |
| Clipboard write fails | Error toast "Copy failed." Tab NOT closed if triggered by Copy & Close. |
| Save-to-file fails | Error dialog with reason (disk full, permissions). |
| Hotkey registration fails | Error toast. Revert to previous hotkey. |
| Auto-trim detection fails | Silent failure. No overlay shown. |
| Export flattening fails | Error toast. Clipboard cleared (safe default). |
| Canvas size limit exceeded | Scale image down, info toast. |

### State Lifecycle Risks

- **Tab duplication deep-copy:** Must clone ImageData (freehand checkpoint), annotation array (deep), undo stack (command.clone()). Stale references → bugs.
- **Auto-copy on close race:** Copy must complete before tab state is GC'd. Use `await writeImage()` before disposing tab.
- **Redo branch with stale objects:** Truncated redo commands hold data snapshots, not DOM refs. GC-safe.
- **Pruned checkpoint timing:** Synchronous and mandatory in prune callback. Async = data loss.

### Integration Test Scenarios

1. Draw freehand → add SVG arrow → crop → export → verify arrow visible in cropped region of flattened image
2. Create 3 redaction rects (solid, pixelate, blur) → export → read back pixels → confirm no original data at any redacted region
3. Open 5 tabs → edit 3 → Cmd+Q → aggregate dialog → Copy All & Quit → verify all 3 copied to clipboard (last one wins)
4. Auto-trim detects borders → user starts drawing before accepting → verify trim overlay dismissed
5. Global hotkey from different app → verify window appears within 100ms with clipboard image

## Acceptance Criteria

### Functional Requirements

- [ ] Paste image from clipboard and display in app
- [ ] Draw with pen, pencil, marker, eraser (all distinct characteristics)
- [ ] Create arrows (bendable Bezier), lines, rectangles, ellipses, numbered callouts, rich text boxes
- [ ] Select, move, resize, rotate annotations
- [ ] Redact with solid fill, pixelation, Gaussian blur
- [ ] Auto-trim detection with overlay preview
- [ ] Manual crop tool
- [ ] Copy flattened image to clipboard (Cmd+C)
- [ ] Save to file (PNG/JPG)
- [ ] Tab system with auto-duplication on first edit of clipboard tab
- [ ] Close-warning dialog per auto-copy matrix
- [ ] Undo/redo across all layers (50 steps)
- [ ] Per-tool remembered settings
- [ ] Global hotkey (Cmd+Shift+J, configurable)
- [ ] System tray with menu
- [ ] Settings dialog (hotkey, theme, auto-copy, auto-trim, threshold, tab naming, autostart)
- [ ] Light + dark themes with Flexoki tokens
- [ ] Error handling with toast notifications
- [ ] Callout auto-renumber on delete

### Non-Functional Requirements

- [ ] Auto-trim detection < 50ms for 2560×1440
- [ ] Window appears within 100ms of hotkey press
- [ ] Freehand drawing feels smooth (no perceptible lag)
- [ ] Memory per tab ≤ 10MB at 1080p with 50 undo steps
- [ ] Freehand replay ≤ 16ms for ≤ 50 strokes at 1080p
- [ ] Export flattening < 500ms for typical annotated screenshot
- [ ] Works on macOS (primary) and Windows (secondary)

### Accessibility (v1 Baseline)

- [ ] Keyboard navigation for all tools (1-0 hotkeys)
- [ ] ARIA labels on all interactive elements
- [ ] Visible focus indicators
- [ ] Theme-aware contrast ratios meet WCAG AA
- [ ] Reduced motion: respect `prefers-reduced-motion` for transitions

### Quality Gates

- [ ] All unit tests pass (`bun test`)
- [ ] Type checking passes (`bun run tsc`)
- [ ] Integration tests pass
- [ ] Redaction pixel-inspection test confirms data destruction
- [ ] Manual testing on macOS (Tauri dev mode)

## Success Metrics

- Primary action (paste → annotate → copy) achievable in under 5 seconds for a single annotation
- Clipboard round-trip is lossless (no quality degradation for unannotated images)
- Redaction is provably destructive (pixel inspection confirms no recoverable data)
- Auto-trim correctly identifies borders on 95%+ of typical screenshots
- No user-facing crashes or data loss scenarios

## Dependencies & Prerequisites

**Critical path:** Design System → App Shell → Clipboard Integration → Tab System → Undo/Redo → Freehand → SVG Layer → (all remaining features in parallel where possible)

**External dependencies:**
- Tauri v2 stable (assumed stable for 2026)
- `@tauri-apps/plugin-clipboard-manager` — image read/write API
- `@tauri-apps/plugin-global-shortcut` — global keyboard shortcut
- `@tauri-apps/plugin-dialog` — native save dialog
- `perfect-freehand` — pressure-sensitive stroke rendering
- `lucide-vue-next` — icon library

**Parallelization opportunities:** After Phase 4 (SVG layer), Phases 5 (text), 6 (redaction), and 7 (crop) can be developed in parallel since they operate on independent layers.

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| WebKit rendering quirks on macOS (Tauri = WKWebView) | High | Medium | Test in Tauri window frequently, not just browser. HTML overlay avoids foreignObject bugs. |
| Clipboard image read latency for 4K+ | Medium | Medium | Add loading indicator if >100ms. Test early in Phase 1. |
| Freehand replay too slow for 50+ strokes at 4K | Medium | High | Checkpoint model bounds replay cost. Profile early; increase checkpoint frequency if needed. |
| SVG serialization export issues | Medium | Medium | Keep SVG annotations simple. Test export early in Phase 4. Use `canvg` as fallback if native drawImage fails. |
| Global hotkey conflicts with other apps | Medium | Low | Configurable from start. Try/catch on registration with error toast. |
| Memory pressure with many tabs at 4K | Low | Medium | No hard limit; document expected memory. System memory is natural limit. |
| `perfect-freehand` library abandoned | Low | Low | 3KB, zero deps, trivial to fork or replace. |
| Blur redaction reversibility | Low | High | 20px minimum radius. Educational text in sub-toolbar. |

## Future Considerations

- **Session persistence** — if users request it, add optional tab state serialization (currently explicitly out of scope)
- **Pressure-sensitive input** — `perfect-freehand` already accepts pressure data; could enable real pressure-sensitive pen support on tablets
- **Annotation templates** — save and reuse annotation configurations
- **Batch processing** — annotate multiple clipboard images in sequence
- **Plugin system** — custom annotation types
- **Full screen reader support** — beyond v1 baseline accessibility
- **WebP/AVIF export** — additional export formats
- **Zoom to selection** — zoom to fit selected annotation

## Documentation Plan

- Update `AGENTS.md` with any new conventions discovered during implementation
- Create `docs/solutions/` entries for Tauri v2 gotchas and Canvas/SVG patterns as they're discovered
- No separate user documentation for v1 (app should be self-explanatory)

## Sources & References

### Origin Documents

All 8 requirements documents in `docs/brainstorms/` (dated 2026-03-20):
1. `annotation-layer-architecture-requirements.md` — R1–R20
2. `ephemeral-by-default-requirements.md` — R1–R11
3. `annotation-primitives-requirements.md` — R1–R25
4. `auto-crop-smart-trim-requirements.md` — R1–R9
5. `dedicated-redaction-requirements.md` — R1–R13
6. `tool-configuration-requirements.md` — R1–R22
7. `global-hotkey-requirements.md` — R1–R8
8. `design-system-requirements.md` — R1–R40

Key decisions carried forward: hybrid Canvas+SVG rendering, 4-layer stack, ephemeral-by-default philosophy, per-tool remembered settings, crop-as-projection, command pattern undo, no session persistence.

### Internal References

- Ideation: `docs/ideation/2026-03-20-clipjot-open-ideation.md` — 7 explored ideas, 27 rejected
- Flexoki CSS: `src/assets/flexoki.css` — 131 CSS custom properties
- Tauri config: `src-tauri/tauri.conf.json`, `src-tauri/capabilities/`
- Superseded plans: `docs/plans/2026-03-21-001-*` (beta), `docs/plans/2026-03-21-002-*` (undo-redo subsystem)

### External References

- Tauri v2 Clipboard Plugin: https://v2.tauri.app/plugin/clipboard/
- Tauri v2 Global Shortcut Plugin: https://v2.tauri.app/plugin/global-shortcut/
- Tauri v2 System Tray: https://v2.tauri.app/learn/system-tray/
- perfect-freehand: https://github.com/steveruizok/perfect-freehand
- Flexoki: https://github.com/kepano/flexoki
- Lucide Icons: https://lucide.dev

### Penpot Design Reference

4 pages in Penpot project (accessed via MCP):
1. App Shell - Light — full 1280×800 layout
2. App Shell - Dark — dark theme variant
3. Components — 11 standalone designs (sub-toolbars, dialogs, overlays, empty state, toast)
4. Design Tokens — token library (3 sets, 114 tokens, 2 themes)

---

## Appendix: Detailed Research Insights

*Added by deepen-plan on 2026-03-21. Six agents analyzed the plan across architecture, performance, security, Vue 3 patterns, Tauri v2 production patterns, and simplification.*

### A. Architecture Corrections

**A1. Per-tab composable scoping (CRITICAL):**
Composables at module scope create singletons. The plan needs per-tab instances for `useUndoRedo`, `useAnnotationStore`, `useDrawing`, and `useSelection`. Recommended approach: `useTabStore()` holds a `Map<tabId, TabState>` where composables operate on the active tab's data. Avoids orphaned reactive instances when tabs close.

**A2. Zoom in Phase 1, not Phase 9 (CRITICAL):**
All tools from Phase 2 onward need image-space coordinates. Without zoom transforms from day one, every composable (useDrawing, useShapeCreation, useSelection, useRedaction, useCrop) must be retrofitted. Move the coordinate-transform math to Phase 1. The UI controls (Cmd+/-, scroll wheel) can remain in Phase 9.

**A3. CSS transform order (CRITICAL):**
Plan says `transform: scale(N) translate(X, Y)`. CSS transforms apply right-to-left, so this translates in unscaled space. Correct order: `transform: translate(${panX}px, ${panY}px) scale(${scale})` with `transform-origin: 0 0`.

**A4. SVG CSS variable export bug (CRITICAL):**
Annotations styled with CSS custom properties (`stroke="var(--annotation-red)"`) serialize as literal `var(...)` strings via XMLSerializer. When rendered as an Image in an isolated context, colors resolve to defaults. Fix: store resolved hex colors on annotation data objects, not CSS variables. Use CSS variables only for live DOM rendering.

**A5. Export atomicity fix (CRITICAL):**
Don't clear clipboard before flattening. Instead: (1) flatten to Blob in memory, (2) clear clipboard, (3) write Blob. This narrows the failure window — user only loses clipboard if the write itself fails.

**A6. Pointer event routing vs selection handles conflict:**
Plan says `pointer-events: none` on all layers + invisible overlay, but also `pointer-events: auto` on selection handles. These are contradictory. Fix: use `{ capture: true }` listener on viewport container with `usePointerRouter`. No invisible overlay. Handles in SVG layer receive events naturally.

**A7. Tab DOM virtualization:**
10 tabs × 2 canvases (4K) = ~660 MB GPU memory even for hidden tabs. Only active tab's canvases should exist in DOM. On tab switch: save to ImageData, release canvas (set width=0), restore on activation. ~10–30ms switch cost.

**A8. ObjectURL memory leaks:**
`URL.createObjectURL()` for base image display must be paired with `URL.revokeObjectURL()` on tab close and clipboard refresh.

**A9. `SvgMutateCommand` hidden dependency:**
Listed under Unit 24 (Phase 9) but needed by Unit 11 (Phase 4) and Unit 15 (Phase 5). Move to Unit 11.

### B. Performance Optimizations

**B1. Canvas buffer sizing (saves ~200 MB/tab at 4K Retina):**
Canvas buffer MUST equal image dimensions, NOT image × devicePixelRatio. CSS sizing handles Retina display. A 4K image on 2× Retina would otherwise allocate 7680×4320 (133 MB per canvas).

**B2. Rolling checkpoints every 10 strokes:**
Without this, undo replays ALL strokes (worst case: 50 strokes = 40–100ms at 4K). With checkpoints every 10 strokes, worst case = 10 strokes = 8–18ms. Implementation: `getImageData()` after every 10th stroke, replay from checkpoint on undo.

**B3. Cache Path2D objects on stroke data:**
Don't recompute `getStroke()` + `Path2D` on every replay. Cache on the stroke object. Saves ~0.4ms per stroke × 10 strokes = ~4ms per undo.

**B4. O(1) live stroke rendering during drawing:**
During active drawing, only render the in-progress stroke preview — don't re-render all previous strokes. Save the canvas state before the current stroke as a snapshot; restore + render current stroke each frame. Saves ~15–50ms/frame during active drawing.

**B5. `getCoalescedEvents()` + passive listeners:**
Use `PointerEvent.getCoalescedEvents()` inside rAF to capture all intermediate points between frames. Add `{ passive: true }` on pointermove listener to avoid blocking compositor. Prevents jagged strokes on high-refresh displays.

**B6. Auto-trim: subsample 4× before IPC:**
33 MB RGBA over IPC takes 50–130ms just for transfer. Downsample 4× → 960×540 = 2 MB. Multiply returned bounds by 4. Optionally refine edge rows with a second pass. Total: 15–35ms.

**B7. Export: use `createImageBitmap()` instead of Image + onload:**
Decodes off main thread, avoids Image element overhead. Saves ~20–50ms per SVG decode step.

**B8. Export: batch all text into single SVG:**
Instead of N separate foreignObject → Image decode cycles, combine all text into one SVG. Saves ~200–600ms for multi-text exports.

**B9. Tab duplication: copy-on-write checkpoint:**
Share checkpoint ImageData between original and clone (refCount). Only copy when one tab modifies it. Duplication: 31–66ms → 16–36ms, defers 33 MB allocation.

**B10. Corrected memory estimates:**

| Tabs | 1080p (active / inactive) | 4K (active / inactive) |
|------|--------------------------|------------------------|
| 1 | ~28 MB | ~105 MB |
| 5 | ~28 + 4×10 = ~68 MB | ~105 + 4×35 = ~245 MB |
| 10 | ~28 + 9×10 = ~118 MB | ~105 + 9×35 = ~420 MB |

### C. Security Remediations

**C1. Set CSP immediately (HIGH):**
```json
"security": {
  "csp": {
    "default-src": "'self'",
    "script-src": "'self'",
    "style-src": "'self' 'unsafe-inline'",
    "img-src": "'self' asset: http://asset.localhost blob: data:",
    "connect-src": "ipc: http://ipc.localhost",
    "font-src": "'self' data:",
    "object-src": "'none'",
    "base-uri": "'self'"
  }
}
```

**C2. Sanitize contenteditable paste (HIGH):**
Intercept `paste` event. Strip all tags except `<b>`, `<i>`, `<u>`, `<span>` with whitelisted style properties. Never use `v-html` with unsanitized user content. Consider DOMPurify.

**C3. Strengthen redaction defaults (HIGH/MEDIUM):**
- Blur minimum: 40px (was 20px). Add noise after blur to break deterministic invertibility.
- Pixelation minimum: 12px (was 4px). Default: 16px.
- Warning in sub-toolbar: "Blur and pixelation can potentially be reversed. Use solid fill for sensitive data like passwords and API keys."

**C4. Atomic file writes (MEDIUM):**
Write to temp file first, then atomically rename to target path. On failure, delete temp file.

**C5. Validate Rust IPC buffer size (MEDIUM):**
`detect_trim_bounds` must validate `width * height * 4 == image_bytes.len()`. Return `Result<T, E>`, never panic.

**C6. Strip PNG metadata (MEDIUM):**
`canvas.toBlob()` may include tEXt/iTXt chunks with timestamps and software info. Either strip ancillary chunks post-export or re-encode through Rust `png` crate.

**C7. Remove scaffold `greet` command (LOW):**
Dead code that expands IPC surface. Delete before implementing features.

### D. Vue 3 / TypeScript Patterns

**D1. `shallowRef` for large data:**
Use `shallowRef` (not `ref`) for ImageData, stroke arrays, command stacks, and annotation arrays. Avoids Vue proxying every pixel/point. Reassign `.value` to trigger updates.

**D2. Module-level singletons for global state, provide/inject for viewport context:**
```typescript
// Global state — direct import
export function useTabStore() { /* module-level refs */ }

// Viewport context — provide/inject (flows down to canvas layers)
export const VIEWPORT_KEY: InjectionKey<ViewportContext> = Symbol('viewport')
```

**D3. Discriminated unions with exhaustiveness:**
```typescript
type Annotation = RectAnnotation | EllipseAnnotation | ArrowAnnotation | ...
function assertNever(x: never): never { throw new Error(`Unexpected: ${x}`) }
// In switch: default: return assertNever(annotation) // compile error if case missing
```

**D4. Typed tool settings map:**
```typescript
interface ToolSettingsMap {
  pen: PenSettings; marker: MarkerSettings; eraser: EraserSettings; /* ... */
}
function getSettings<T extends ToolId>(tool: T): ToolSettingsMap[T] { ... }
```

**D5. Canvas context as plain variable, not reactive:**
```typescript
const canvasEl = ref<HTMLCanvasElement | null>(null) // template ref: reactive
let ctx: CanvasRenderingContext2D | null = null // context: plain variable
```

### E. Tauri v2 Production Patterns

**E1. Plugin registration:**
```rust
// Universal plugins on builder; desktop-only in setup() with error handling:
app.handle().plugin(tauri_plugin_global_shortcut::Builder::new().build())?;
```

**E2. Keep event loop alive for tray:**
```rust
app.run(|_handle, event| {
    if let RunEvent::ExitRequested { code, api, .. } = &event {
        if code.is_none() { api.prevent_exit(); }
    }
});
```

**E3. IPC for large binary data:**
Use `tauri::ipc::Response` for raw binary returns. Use `tokio::task::spawn_blocking` for CPU-bound processing.

**E4. CSP compatibility notes:**
- `blob:` and `data:` in `img-src` required for canvas export pipeline
- `ipc: http://ipc.localhost` in `connect-src` required for Tauri IPC
- `'unsafe-inline'` in `style-src` needed for Vue dynamic styles
- Tauri auto-adds nonces/hashes for bundled scripts at compile time

**E5. Auto-updater recommendation:**
~3 hours setup. High-value for desktop app. Requires Ed25519 signing keys, `tauri-plugin-updater`, and a `latest.json` endpoint (GitHub Releases works).

### F. Simplification Recommendations

*These are suggestions, not mandates. Apply based on your v1 scope priorities.*

| Simplification | LOC Saved | Trade-off |
|---------------|-----------|-----------|
| Plain text instead of rich text (defer B/I/U) | 300–400 | No inline formatting in v1 |
| Straight arrows only (defer Bezier) | 100–150 | No curved arrows in v1 |
| Flatten-to-image tab duplication | 100–150 | No undo history in duplicated tabs |
| Reuse sub-toolbar as property panel | ~150 | Properties at top, not floating near annotation |
| Defer menu bar (Unit 25) | 80–100 | No native menus; shortcuts + toolbar sufficient |
| Collapse 10 command types → 4 | 200–300 | Less type-specific, same functionality |
| Merge 6 annotation components → 2 | ~100 | Larger single file, easier maintenance |
| Merge close/quit dialogs → 1 | 50–80 | One generic confirm dialog |
| Merge trim/crop overlays → 1 | 80–100 | Mode prop controls behavior |
| Defer configurable hotkey | 40–60 | Hardcoded Cmd+Shift+J |
| Defer tab renaming | 60–80 | Auto-names only |
| Callout gaps on delete (no renumber) | 60–80 | Numbers 1, 3 after deleting 2 |
