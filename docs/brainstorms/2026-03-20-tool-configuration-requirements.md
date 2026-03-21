---
date: 2026-03-20
topic: tool-configuration
---

# Tool Configuration and Sub-Toolbar

## Problem Frame

The original spec described a global color selection with per-tool stroke width — requiring users to configure multiple dimensions before annotating. A faster model: each tool lives directly on the toolbar with its own remembered settings. Selecting a tool reveals an inline sub-toolbar for tweaking parameters, but the defaults are sensible enough that most users can start drawing immediately. This replaces the concept of named presets with a simpler "each tool is its own preset" model.

## Requirements

### Toolbar and Tool Selection

- R1. All tools are directly accessible from the main toolbar: pen, pencil, marker, eraser, arrow, straight line, rectangle, circle/ellipse, numbered callout, text box, redaction, and crop. The toolbar also includes action buttons: copy to clipboard, save to file, duplicate tab, undo, and redo. The clipboard tab additionally has a refresh button.
- R2. Selecting a tool immediately activates it. No secondary step is required to start using it.
- R3. When a tool is selected, an inline sub-toolbar expands within the main toolbar area, showing the active tool's configurable parameters.
- R4. The sub-toolbar is dismissable but appears automatically on tool selection. If the user wants to skip configuration and start drawing with current settings, they simply begin drawing — the sub-toolbar does not block interaction with the canvas.

### Per-Tool Remembered Settings

- R5. Each tool remembers its own parameter settings independently. Changing the pen's color does not affect the marker's color.
- R6. Tool settings persist within the current session (across tabs). When the user switches between tools, each tool restores to its last-used settings.
- R7. Tool settings reset to defaults when the app is restarted. No cross-session persistence of tool settings.

### Tool-Specific Parameters

- R8. **Pen:** color, stroke width.
- R9. **Pencil:** color, stroke width. (Sharp/hard edge pencil, distinct from pen in stroke rendering.)
- R10. **Marker:** color, stroke width, opacity.
- R11. **Eraser:** size (eraser width).
- R12. **Arrow:** color, stroke width.
- R13. **Straight line:** color, stroke width.
- R14. **Rectangle:** color, stroke width, fill toggle (off by default), fill color, fill opacity.
- R15. **Circle/Ellipse:** color, stroke width, fill toggle (off by default), fill color, fill opacity.
- R16. **Numbered callout:** color (fill color of the circle; number color auto-contrasts).
- R17. **Text box:** font family, font size, color. Bold/italic/underline are inline formatting options within the text, not tool-level settings.
- R18. **Redaction:** style (solid color / pixelation / blur), color (for solid fill style).
- R19. **Crop:** no configurable parameters (the crop interaction is the tool itself).

### Sensible Defaults

- R20. Every tool ships with a sensible default configuration using Flexoki palette colors so that a user can select any tool and start using it immediately without any configuration. Defaults should be optimized for the most common annotation use case of each tool.

### Color Picker

- R21. The color parameter in the sub-toolbar uses a compact color picker that includes: the Flexoki palette as quick-select swatches, plus an arbitrary color picker for custom colors.
- R22. Recently used colors are shown for quick re-selection across tools.

## Success Criteria

- A user can select any tool and immediately start drawing/annotating without configuring anything.
- Switching between tools preserves each tool's independent settings — using the marker doesn't reset the pen's color.
- The sub-toolbar is visible but non-blocking: users who want fine control can tweak, users who want speed can ignore it.
- The toolbar accommodates all 12 tools without feeling cluttered on a standard desktop window.

## Scope Boundaries

- **No named preset saving/loading** — each tool IS its own remembered configuration. No "save this as Preset X" mechanism.
- **No cross-session persistence** of tool settings — settings reset on app restart.
- **No tool-specific keyboard shortcuts for parameter changes** in v1 (e.g., no [ / ] to change brush size). Tool switching via keyboard is covered separately.
- **No custom tool creation** — the tool set is fixed in v1.

## Key Decisions

- **Each tool = its own preset:** Simpler than a preset-switching model. Users don't need to learn a preset concept — they just pick a tool and its settings are remembered.
- **Inline sub-toolbar expansion:** Cleaner than floating panels. The sub-toolbar is part of the toolbar chrome, not a separate popup that needs positioning or dismissal.
- **No global color:** Color is per-tool. Changing the arrow's color doesn't affect the marker's color. This enables the "yellow marker, red arrow" workflow without switching.
- **Session-only persistence:** Keeps the app lightweight and consistent with the ephemeral philosophy. Persistent tool settings across restarts would require a settings store and add complexity.
- **Flexoki as the palette base:** The Flexoki CSS is already imported in the project. Using its palette for the color picker swatches gives the app a cohesive visual identity.

## Dependencies / Assumptions

- Depends on the annotation primitives requirements (brainstorm #3) for the shape tool set.
- Depends on the redaction requirements (brainstorm #5) for redaction tool parameters.
- Depends on the layer architecture (brainstorm #1) for how tool output maps to layers (freehand tools -> canvas, shape tools -> SVG, redaction -> redaction layer).
- The toolbar must fit all 12 tools on a standard desktop window (800px+ wide). May need icon-only presentation with tooltips.

## Outstanding Questions

### Deferred to Planning

- [Affects R1][Needs research] What toolbar layout pattern works best for 12 tools? Horizontal strip, grouped sections, collapsible groups?
- [Affects R3][Technical] How to implement the inline sub-toolbar expansion in Vue 3 with smooth transitions?
- [Affects R21][Needs research] What Vue 3 color picker component supports both palette swatches and arbitrary color selection? Or should this be custom-built?
- [Affects R20][Needs research] What are the best default values for each tool? Need to test Flexoki colors for annotation visibility on typical screenshot backgrounds.

## Next Steps

-> /ce:plan for structured implementation planning
