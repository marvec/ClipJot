---
date: 2026-03-20
topic: clipjot-open
focus: open-ended ideation for ClipJot clipboard image editor
---

# Ideation: ClipJot Improvement Ideas

## Codebase Context

**Project shape:** Tauri v2 + Vue 3 + TypeScript + Vite desktop app, managed with Bun. Rust backend in `src-tauri/`, Vue frontend in `src/`. Version 0.1.0.

**Current state:** The codebase is the stock Tauri scaffolding template. `App.vue` is the "Welcome to Tauri + Vue" greeting demo. `lib.rs` contains only the boilerplate `greet` command. No application-specific features are implemented.

**What exists:**
- Strict TypeScript config (`strict: true`, `noUnusedLocals`, `noUnusedParameters`)
- Flexoki color scheme CSS variables imported but unused
- Tauri plugins wired: `clipboard-manager`, `autostart`, `opener`
- Capability files granting `clipboard-manager:default` and `autostart:default`
- Prettier config, AGENTS.md with performance guidance and testing strategy
- Empty `test/` directory

**What doesn't exist:**
- No canvas/drawing engine
- No clipboard image capture/paste logic
- No tab system, no components, no composables, no stores
- No text tool, crop tool, undo/redo
- No system tray integration, no settings UI
- No ESLint config (despite AGENTS.md mentioning it)
- No tests

**Past learnings:** No `docs/solutions/` directory exists. Clean slate.

## Ranked Ideas

### 1. Non-Destructive SVG Annotation Layers

**Description:** Render the clipboard image as a read-only base layer. All annotations (strokes, shapes, text) live as individual SVG/vector objects on transparent layers above it. Annotations remain selectable, movable, and deletable after creation -- never baked into pixels until export. This is closer to how Figma handles comments than how Paint handles drawing.

**Rationale:** This is an architecture decision that shapes everything downstream. Vue 3's reactivity maps naturally to a list of annotation objects (each one a reactive component). Undo/redo becomes adding/removing objects from an array. Export flattens layers. The alternative -- baking strokes into a canvas bitmap -- makes every future feature (move an arrow, delete one annotation, re-color a shape) painful or impossible.

**Downsides:** More complex initial setup than raw canvas. Rendering many overlapping SVG elements on large images may need performance tuning. Export/flatten step adds complexity.

**Confidence:** 85%
**Complexity:** Medium
**Status:** Explored

### 2. Ephemeral-by-Default / Clipboard Round-Trip

**Description:** Make "copy back to clipboard" the primary output action, not "save to file." After annotating, a single keypress (Enter or Cmd+C) flattens and copies the result. The app minimizes or returns to the clipboard view. File save exists but is secondary, behind a menu. The entire loop: paste-in -> annotate -> copy-out in under 5 seconds.

**Rationale:** The app is called ClipJot -- it's a clipboard transformer, not a file-based image editor. This philosophy eliminates entire UX categories: no "save as" dialogs, no file naming, no format selection as the default path. It simplifies the settings model (auto-copy on close becomes the default, not an option). It clarifies every design decision: "does this serve the clipboard round-trip?"

**Downsides:** Users who want to save files must discover the secondary path. Muscle memory from traditional editors may create confusion initially.

**Confidence:** 90%
**Complexity:** Low
**Status:** Explored
**Status:** Unexplored

### 3. Annotation Primitives: Bendable Arrows, Shapes, and Numbered Callouts

**Description:** Add first-class annotation tools: bendable arrows (with draggable midpoint handles to create curves), rectangles, circles/ellipses, and auto-incrementing numbered callouts. These sit alongside (and arguably above) the freehand drawing tools in the toolbar. Numbered callouts auto-increment (place #1, next click places #2, etc.) for documenting multi-step flows. Arrows are bendable by default -- drag a control point on the shaft to curve them around obstacles.

**Rationale:** This is the #1 missing capability in the spec. 80% of screenshot annotation is "point at this thing" and "highlight this area." Freehand pen/marker tools alone force users to draw wobbly arrows by hand. Every competing tool (Skitch, Shottr, CleanShot X, Greenshot, ShareX) treats arrows and rectangles as primary tools. Without these, users will annotate in ClipJot once, find it lacking, and never return. Bendable arrows specifically solve the problem of pointing at something behind another annotation or routing around UI elements -- straight arrows often miss or overlap.

**Downsides:** Increases the tool count and toolbar complexity. Shape tools need resize handles and selection states, which are more complex than freehand strokes. Bezier arrow bending adds interaction complexity (drag midpoint handle).

**Confidence:** 95%
**Complexity:** Medium
**Status:** Explored

### 4. Auto-Crop / Smart Trim on Paste

**Description:** When a screenshot lands in the editor, automatically detect uniform-color borders (window shadows, desktop background padding, terminal whitespace) and offer a one-click "trim" suggestion as a dismissible overlay. Not forced -- just a subtle offer that the user accepts or ignores.

**Rationale:** Highest value-to-effort ratio of any idea. The algorithm is trivial (scan edge rows/columns for uniform pixel values). Screenshots almost always have unwanted padding. This saves 5-10 seconds on literally every paste. Shottr's "auto trim" and CleanShot's "smart crop" are frequently cited as killer features in reviews.

**Downsides:** Edge detection may misfire on images with intentional uniform borders. Needs a clear "no thanks" dismissal that doesn't become annoying.

**Confidence:** 85%
**Complexity:** Low
**Status:** Explored

### 5. Dedicated Redaction Tool

**Description:** A purpose-built tool that fills selected regions with a solid opaque block and destructively flattens the pixel data so it cannot be recovered by adjusting levels, inspecting layers, or selecting/moving the redaction shape. Include pixelation/blur as alternative redaction styles. Visually distinct from the eraser or a black rectangle.

**Rationale:** Every week, someone's "redacted" screenshot gets unmasked because they used a translucent brush on a layer, or a black rectangle that can be moved. Real redaction means the underlying pixels are gone. This is a genuine differentiator for a tool used by developers sharing screenshots of terminals, dashboards, and config files.

**Downsides:** Destructive by nature -- needs clear visual feedback that pixels are permanently gone. Implementing blur/pixelation adds rendering complexity. Conflicts somewhat with non-destructive layer philosophy (redaction must be the exception that bakes into the base layer).

**Confidence:** 80%
**Complexity:** Low-Medium
**Status:** Explored

### 6. Tool Presets with Per-Preset Configurable Parameters

**Description:** Instead of a global color + per-tool width configuration, offer 3-4 opinionated presets immediately available: "Highlight" (thick yellow marker), "Annotate" (medium red pen/arrow), "Sketch" (thin dark pencil), "Redact" (solid black fill). Each preset carries its own color, stroke width, and opacity. Upon selecting a preset, its parameters appear inline for quick adjustment -- the user can tweak the color or width right there before drawing. Color is per-preset, not global, so switching between "Highlight" and "Annotate" doesn't lose your color choices.

**Rationale:** The original spec describes a tool system with global color, per-tool width, opacity, and multiple types -- that's 5+ configuration dimensions before making a single mark. Presets with inline configuration turn a 20-second configure-then-draw sequence into a 1-click-then-optionally-tweak flow. Flexoki's curated palette provides ready-made sensible default colors for each preset. Per-preset color means you set "Highlight = yellow, Annotate = red" once and it sticks.

**Downsides:** Users with strong color preferences may feel constrained by the preset mental model. Preset naming/iconography needs to be immediately clear. The inline parameter editing UI needs to be unobtrusive enough to not slow down users who don't want to customize.

**Confidence:** 80%
**Complexity:** Low
**Status:** Explored

### 7. Global Hotkey with Instant Active-Tool Launch

**Description:** Register a system-wide hotkey (e.g., Cmd+Shift+J) that brings ClipJot to the foreground with the current clipboard image already loaded and the last-used annotation tool/preset active. No splash, no empty state, no "paste here" prompt. The window materializes mid-thought with drawing ready.

**Rationale:** The screenshot-annotate-share loop is measured in seconds. The gap between "I have an image in my clipboard" and "I'm drawing on it" is the critical friction point. Tauri v2 supports global shortcuts via plugin. Competing tools like Shottr and CleanShot X win precisely on this latency metric.

**Downsides:** Global hotkeys can conflict with other apps. Requires the app to be running in the tray (which is already planned). macOS and Windows have different keyboard conventions.

**Confidence:** 85%
**Complexity:** Low
**Status:** Explored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Stroke Stabilization & Velocity Pressure | Polish on tools that don't exist yet; velocity pressure serves artists, not screenshot annotators |
| 2 | Clipboard History / Auto-Capture | Users already have clipboard managers (Maccy, Paste); reinventing a solved problem |
| 3 | Reusable Annotation Stamps | Premature before basic shapes exist; stamp library is feature creep for v1 |
| 4 | Full Command Palette (Cmd+K) | Over-engineering for an app with 6-8 tools; simple keyboard shortcuts suffice |
| 5 | Auto-Redact Detection (OCR) | Requires shipping an OCR engine; massive complexity and liability for v1 |
| 6 | Post-Annotation Pipeline | Premature abstraction; "copy + close" covers the 90% case |
| 7 | Copy-as-Markdown-Image | Requires image upload service, auth tokens, hosting -- an entire product bolted on |
| 8 | Drag-Out Sharing | Tauri v2 drag-and-drop support is limited and platform-quirky; feasibility unclear |
| 9 | Visual Diff / Ghost Layer | Different product -- onion-skin overlays are scope cancer for a quick annotation tool |
| 10 | Radial Tool Palette | UX novelty that feels alien on desktop; a simple toolbar that works beats a clever one |
| 11 | Smart Content Detection | Three hard ML problems dressed as one feature |
| 12 | Transparent Overlay Editor | Platform-specific nightmare; breaks window management; feels like malware |
| 13 | Event-Sourced Document Model | Architecture astronautics; a simple undo stack with serializable commands suffices |
| 14 | Unified Tool Protocol | Valid engineering practice but not an ideation-level idea |
| 15 | OffscreenCanvas + Tiled Rendering | Premature optimization; standard canvas handles 4K fine |
| 16 | Flexoki Design Token System | A task, not an idea -- just wire up what's already imported |
| 17 | Tab State Machine | Over-engineering; a reactive boolean and status enum are enough |
| 18 | Visual Regression Testing | Testing strategy, not a product idea |
| 19 | Typed IPC Bridge | Standard practice, not an ideation-level concept |
| 20 | Session Persistence / Crash Recovery | Contradicts ephemeral-by-default philosophy |
| 21 | Virtual Tab Bar with Overflow | Solving 20+ tab problems when ephemeral design prevents them |
| 22 | Non-Image Clipboard Handling | An error state, not an idea |
| 23 | Multi-Monitor Window Positioning | OS handles this; edge cases eat days for minimal value |
| 24 | Accessibility Color Tools | Premature; build the editor first |
| 25 | Ephemeral Workspaces / Timeline | Novel but unproven; tabs that close are already ephemeral |
| 26 | Scriptable Image Pipeline | Premature; build manual tools first |
| 27 | Paste-Target Detection | Too speculative; can't detect where users will paste |

## Session Log

- 2026-03-20: Initial ideation -- 48 raw ideas generated across 6 frames, deduped to 34 candidates, 7 survived adversarial filtering. User additions: bendable arrows for #3, per-preset configurable parameters for #6 (color no longer global).
- 2026-03-20: Brainstorming #1 (Non-Destructive SVG Annotation Layers) -- marked as Explored.
- 2026-03-20: Brainstorming #2 (Ephemeral-by-Default / Clipboard Round-Trip) -- marked as Explored.
- 2026-03-20: Brainstorming #3 (Annotation Primitives: Shapes, Arrows, Callouts, Text) -- marked as Explored. Added rich text box to the tool set.
- 2026-03-20: Brainstorming #4 (Auto-Crop / Smart Trim) -- marked as Explored.
- 2026-03-20: Brainstorming #5 (Dedicated Redaction Tool) -- marked as Explored.
- 2026-03-20: Brainstorming #6 (Tool Configuration) -- marked as Explored. Reframed from preset-switching to per-tool remembered settings with inline sub-toolbar.
- 2026-03-20: Brainstorming #7 (Global Hotkey Launch) -- marked as Explored. All 7 ideas now brainstormed.
