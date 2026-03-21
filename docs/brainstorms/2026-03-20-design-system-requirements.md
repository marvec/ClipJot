---
date: 2026-03-20
topic: design-system
---

# Design System: Semantic Tokens, Components, and Layout

## Problem Frame

ClipJot needs a cohesive design system before implementation begins. Flexoki provides the primitive color palette, but the app needs a semantic token layer that maps Flexoki primitives to ClipJot-specific roles (surfaces, tool states, tab states, annotation colors). The app also needs a clear component inventory derived from the 7 requirements documents so that Penpot design work covers all necessary pieces. Finally, the layout architecture must define how these components compose into the main app window.

## Requirements

### Visual Identity

- R1. ClipJot uses a **soft and warm** visual style: subtle shadows, rounded corners, warm Flexoki paper tones. Inspired by Apple Notes / Things 3 aesthetics rather than flat-utilitarian or dense-developer styles.
- R2. Both light and dark themes are supported. The initial theme follows the OS preference. The user can manually toggle between light and dark in settings.
- R3. Theme switching is implemented via a single CSS class swap on `:root` (e.g., `.theme-light` / `.theme-dark`). All components reference only semantic tokens, never Flexoki primitives directly.

### Semantic Design Token Layer

- R4. A semantic token layer maps Flexoki primitive variables to ClipJot-specific roles. Every component references semantic tokens exclusively.
- R5. Token categories:

**Surfaces:**
- `--surface-primary` — main background (light: paper, dark: 950)
- `--surface-secondary` — slightly recessed areas like tab bar, toolbar (light: 50, dark: 900)
- `--surface-elevated` — cards, dialogs, tooltips, floating panels (light: white, dark: 850)
- `--surface-canvas` — the canvas background behind the image (light: 100, dark: 900)

**Text:**
- `--text-primary` — main text (light: black, dark: 100)
- `--text-secondary` — less prominent text (light: 600, dark: 400)
- `--text-muted` — disabled, placeholder text (light: 400, dark: 600)
- `--text-inverse` — text on dark/accent backgrounds (light: paper, dark: black)

**Borders:**
- `--border-default` — standard borders (light: 200, dark: 700)
- `--border-subtle` — very faint separators (light: 100, dark: 800)
- `--border-focus` — focused/active element ring (blue-400 / blue-500)

**Interactive States (tools, buttons):**
- `--interactive-default` — default state background
- `--interactive-hover` — hover state
- `--interactive-active` — pressed/selected state
- `--interactive-disabled` — disabled state

**Tab States:**
- `--tab-default` — inactive tab
- `--tab-active` — active/selected tab
- `--tab-copied` — tab with "copied" indicator (subtle green accent)
- `--tab-clipboard` — the permanent clipboard tab (subtle accent to distinguish)

**Annotation Palette:**
- `--annotation-red` — red-400 / red-600
- `--annotation-orange` — orange-400 / orange-600
- `--annotation-yellow` — yellow-400 / yellow-600
- `--annotation-green` — green-400 / green-600
- `--annotation-cyan` — cyan-400 / cyan-600
- `--annotation-blue` — blue-400 / blue-600
- `--annotation-purple` — purple-400 / purple-600
- `--annotation-magenta` — magenta-400 / magenta-600
- `--annotation-black` — black / paper (inverted per theme)
- `--annotation-white` — paper / black (inverted per theme)

**Overlays:**
- `--overlay-dim` — semi-transparent overlay for auto-trim dimming, modal backdrop
- `--overlay-scrim` — darker overlay for modals/dialogs

**Feedback:**
- `--feedback-success` — green accent for "copied" confirmation
- `--feedback-warning` — orange accent for unsaved warnings
- `--feedback-destructive` — red accent for redaction, discard actions

**Shadows:**
- `--shadow-sm` — subtle shadow for elevated surfaces
- `--shadow-md` — medium shadow for dialogs, floating panels
- `--shadow-lg` — larger shadow for tooltips, popovers

- R6. Each token has a light-theme and dark-theme value. Switching themes swaps all tokens simultaneously.

### Component Inventory

Components derived from all 7 requirements documents:

#### App Shell
- R7. **Window frame** — native Tauri window with custom titlebar (if needed) or system titlebar.
- R8. **Tab bar** — horizontal bar at the top holding all tabs. Stacks into multiple rows when tabs overflow (R20 from layer architecture). Contains: tab items, permanent clipboard tab, add-tab button (if applicable).
- R9. **Main toolbar** — horizontal bar below the tab bar. Contains: tool buttons, action buttons (copy, save, duplicate, undo, redo), and clipboard-tab-specific refresh button.
- R10. **Sub-toolbar** — inline expandable area within/below the main toolbar. Appears when a tool is selected. Contains the tool's configurable parameters.
- R11. **Canvas viewport** — central area displaying the image and all annotation layers.

#### Tab Components
- R12. **Tab item** — individual tab with: name label (double-click to edit), "copied" indicator badge, close button. Active tab is visually distinct.
- R13. **Clipboard tab** — permanent tab with "Clipboard" label. Cannot be closed. Has two states: image present (shows the image) and no image ("No image in clipboard" message).
- R14. **Tab name editor** — inline text input that appears on double-click for renaming.

#### Toolbar Components
- R15. **Tool button** — icon button for each of the 12 tools: pen, pencil, marker, eraser, arrow, line, rectangle, circle, callout, text, redaction, crop. Active tool is highlighted.
- R16. **Action button** — icon button for non-tool actions: copy to clipboard, save to file, duplicate tab, undo, redo, refresh (clipboard tab only), smart trim.
- R17. **Color picker** — compact picker with: Flexoki palette swatches (8 colors + black/white), custom color picker (arbitrary color), recent colors row.
- R18. **Stroke width selector** — visual selector showing stroke width options (discrete sizes or slider).
- R19. **Opacity slider** — slider for marker opacity and fill opacity.
- R20. **Fill toggle** — on/off toggle for shape fill, with fill color and opacity controls visible when on.
- R21. **Font selector** — dropdown for font family selection (for text tool).
- R22. **Font size selector** — numeric input or dropdown for font size (for text tool).
- R23. **Redaction style selector** — toggle or dropdown to switch between solid/pixelation/blur.

#### Canvas Components
- R24. **Base image display** — renders the clipboard image as the read-only base layer.
- R25. **Freehand canvas overlay** — transparent HTML5 Canvas for pen/pencil/marker/eraser strokes.
- R26. **Redaction layer overlay** — renders redaction rectangles with their chosen style (solid/pixelate/blur).
- R27. **SVG annotation layer** — renders all structured annotations (arrows, shapes, callouts, text).
- R28. **Selection handles** — resize handles (8 points), rotation handle (above top center), and Bezier control point (for arrows) shown on selected SVG objects.
- R29. **Contextual property panel** — small floating or inline panel shown when an SVG object is selected, allowing recolor/restyle/fill changes.
- R30. **Auto-trim overlay** — dims detected border regions while keeping the content region at full brightness. Includes a "Trim" accept button.
- R31. **Crop overlay** — draggable crop region with resize handles and dimmed outside area.

#### Dialogs and Feedback
- R32. **Close-warning dialog** — modal with three buttons: "Copy & Close", "Discard", "Cancel".
- R33. **Settings dialog** — modal or panel with sections: global hotkey configuration, auto-trim toggle + threshold, tab name date pattern, theme toggle (light/dark), auto-copy on close toggle, auto-start toggle.
- R34. **Toast notification** — brief auto-dismissing notification for "Copied!" confirmation. Appears near the top or bottom of the canvas area.
- R35. **Empty clipboard state** — centered message in the clipboard tab: "No image in clipboard" with subtle icon/illustration.

#### System
- R36. **System tray icon** — icon in the OS system tray / menu bar. Right-click for: Show ClipJot, Settings, Quit.
- R37. **Tray context menu** — right-click menu for the system tray icon.

### Layout Architecture

- R38. The app layout from top to bottom:
  1. **Tab bar** — full width, multi-row when needed
  2. **Toolbar** — full width, containing tool buttons + action buttons
  3. **Sub-toolbar** — full width, inline expansion below toolbar (hidden when no tool has parameters to show)
  4. **Canvas viewport** — fills remaining space, scrollable/zoomable, with the image centered

- R39. The canvas viewport should have a neutral background (`--surface-canvas`) that is distinct from the image content, so image boundaries are clearly visible.
- R40. The toolbar and tab bar remain fixed (do not scroll with the canvas).

## Success Criteria

- Every UI element defined in the 7 requirements documents maps to a component in this inventory.
- Semantic tokens cover all visual states without any component needing to reference Flexoki primitives directly.
- The component inventory is complete enough to serve as a Penpot design checklist — designing all listed components produces a complete UI for ClipJot v1.
- Light and dark themes produce a cohesive, warm aesthetic using only semantic token swaps.

## Scope Boundaries

- **No animation specifications** — transitions and micro-interactions will be handled during implementation.
- **No responsive/mobile layout** — ClipJot is a desktop app with a fixed layout philosophy.
- **No icon design** — tool icons will use an existing icon set or be designed separately.
- **No typography specification beyond font choice** — body text size, heading hierarchy, etc., will be set during implementation.

## Key Decisions

- **Soft and warm aesthetic:** Rounded corners, subtle shadows, warm Flexoki paper tones. This gives ClipJot a distinctive feel versus the flat/utilitarian look of most screenshot tools.
- **Both themes, OS-initialized, manually toggleable:** Expected for 2026 desktop apps. Flexoki's palette is designed for both light and dark, so the mapping is natural.
- **Semantic tokens only in components:** No component references `--flexoki-red-400`. They reference `--annotation-red` or `--feedback-destructive`. This makes theme switching a single class swap and prevents color drift.
- **Inline sub-toolbar:** Rather than a sidebar or floating panel, the sub-toolbar expands inline below the main toolbar. This preserves canvas space and keeps the tool configuration contextual.

## Dependencies / Assumptions

- Flexoki CSS is already imported and available.
- Penpot MCP will be used for visual design of the components listed here.
- The Flexoki primitive-to-semantic mapping values listed above are starting points; exact values may be refined during Penpot design.

## Outstanding Questions

### Deferred to Planning

- [Affects R7][Needs research] Should ClipJot use a custom titlebar (more design control, consistent cross-platform) or native system titlebar (familiar, less work)?
- [Affects R15-R16][Needs research] What icon set should be used for tool and action buttons? Options: Lucide, Phosphor, Tabler, custom.
- [Affects R17][Technical] What Vue 3 color picker component best supports the dual-mode (palette swatches + arbitrary) design?
- [Affects R38][Needs research] Should the toolbar be horizontal (below tab bar) or vertical (left sidebar)? Horizontal is assumed but vertical maximizes canvas height.

## Next Steps

-> Use Penpot MCP to design the components listed in R7-R37
-> After Penpot design, proceed to /ce:plan for structured implementation planning
