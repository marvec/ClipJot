---
date: 2026-03-20
topic: annotation-primitives
---

# Annotation Primitives: Shapes, Arrows, Callouts, and Text

## Problem Frame

ClipJot's freehand drawing tools (pen, pencil, marker) are insufficient for the dominant screenshot annotation workflows: pointing at things, highlighting areas, numbering steps, and adding explanatory text. Users need structured annotation primitives — shapes, arrows, and callouts — that are precise, repositionable, and fast to place. These are the tools that differentiate a useful annotation app from a paint program.

## Requirements

### Tool Set

- R1. The following SVG annotation tools are first-class in v1: **bendable arrow**, **straight line**, **rectangle**, **circle/ellipse**, **numbered callout**, and **rich text box**.
- R2. All SVG annotation tools follow the manipulation model from the layer architecture requirements: objects are individually selectable, movable, resizable, rotatable, recolorable, and deletable after creation.

### Bendable Arrow

- R3. The arrow is a quadratic Bezier curve with three control points: start (tail), end (head with arrowhead), and a single midpoint control handle.
- R4. The midpoint control handle can be dragged both perpendicular to the arrow axis (to bend the curve) and along the arrow's length (toward either end) to influence the curve shape.
- R5. The arrow is created via click-and-drag: click to set the tail, drag to set the head. The midpoint defaults to the center of the straight line between them (producing a straight arrow). The user can then drag the midpoint to bend it.
- R6. Arrows are stroke-only (no fill). Stroke color, width, and arrowhead style are configurable via the active tool preset.

### Straight Line

- R7. A simple line segment with no arrowhead. Created via click-and-drag: click to set one end, drag to set the other.
- R8. Lines are stroke-only. Stroke color and width are configurable.

### Rectangle

- R9. Created via click-and-drag: click to set one corner, drag to set the opposite corner.
- R10. Rectangles have a visible stroke. Fill is optional — off by default, togglable, with configurable fill color and opacity.

### Circle / Ellipse

- R11. Created via click-and-drag: click to set one corner of the bounding box, drag to set the opposite corner. Hold Shift to constrain to a perfect circle.
- R12. Circles/ellipses have a visible stroke. Fill is optional — off by default, togglable, with configurable fill color and opacity.

### Numbered Callout

- R13. Placed with a single click at the cursor position. Each placement auto-increments the number (1, 2, 3, ...).
- R14. When a numbered callout is deleted, all remaining callouts in the tab are automatically renumbered to maintain a sequential, gap-free sequence.
- R15. Callouts are rendered as solid-filled circles with a contrasting number inside. Fill color follows the active preset color. The number color is automatically chosen for contrast (white on dark fills, dark on light fills).
- R16. Callouts have optional fill (on by default, since the filled circle is the primary visual identity of a callout).

### Rich Text Box

- R17. Created by clicking to place the text insertion point, which opens an inline text editing area on the SVG layer.
- R18. The text box supports basic rich text within a single box: **bold**, **italic**, **underline**, font size changes, and color changes. Different spans within the same text box can have different styles.
- R19. No text alignment controls, lists, or tables in v1.
- R20. The text box is an SVG annotation object and follows the same manipulation rules (selectable, movable, resizable, rotatable, deletable). Double-click to re-enter text editing mode.
- R21. Text boxes have an optional background fill (off by default) for readability over busy image regions.

### General Shape Behavior

- R22. Shapes, arrows, and lines are created via click-and-drag. Numbered callouts are placed with a single click.
- R23. After creation, all annotation objects can be selected by clicking on them. Selection shows resize handles, a rotation handle, and (for arrows) the Bezier control point.
- R24. Each annotation tool inherits its initial color, stroke width, and opacity from the currently active tool preset (as defined in the tool presets requirements).
- R25. After creation, an individual annotation's color, stroke width, fill, and opacity can be changed independently via a contextual property panel or inline controls that appear on selection.

## Success Criteria

- A user can annotate a screenshot with arrows pointing at specific elements, numbered steps, highlighted areas, and explanatory text in under 30 seconds.
- Bendable arrows can route around UI elements without overlapping important content.
- Numbered callouts stay sequential even after deletions.
- Rich text boxes support mixed formatting within a single box without requiring multiple text placements.
- All annotation objects remain editable (movable, resizable, recolorable) until the tab is closed or exported.

## Scope Boundaries

- **No speech bubbles** in v1 — can be added later as a compound shape.
- **No connector lines** (lines that snap to and follow other shapes).
- **No grouping** of annotation objects in v1.
- **No alignment/distribute tools** (snap-to-grid, align selected objects) in v1.
- **No custom arrowhead styles** in v1 — single default arrowhead.
- **No freeform polygon or polyline shape** in v1.

## Key Decisions

- **Quadratic Bezier for arrows:** One control point is sufficient for annotation routing. Cubic Bezier (two control points) adds complexity without proportionate value for typical screenshot markup.
- **Auto-renumber on delete:** Keeps callout sequences clean without manual management. The cost is that users can't have intentional gaps (e.g., skipping step 3). This tradeoff favors the common case.
- **Click-and-drag for shapes, click-to-place for callouts:** Matches the ergonomic expectations for each tool type. Callouts are small fixed shapes; shapes need size definition.
- **Basic rich text (not single-style):** Allows emphasis within explanatory text (e.g., "Click the **Submit** button") without the complexity of a full rich text editor.
- **Optional fill, off by default:** Keeps annotations clean and see-through for most use cases. Users who need filled shapes can toggle it on.

## Dependencies / Assumptions

- Depends on the annotation layer architecture (brainstorm #1) — all these tools create objects on the SVG annotation layer.
- Depends on the tool presets system (ideation idea #6) for initial color/width/opacity values.
- Assumes SVG provides adequate rendering quality and performance for these primitives at typical annotation density (5-30 objects per image).

## Outstanding Questions

### Deferred to Planning

- [Affects R3-R5][Needs research] What SVG path construction approach works best for interactive quadratic Bezier arrows with draggable control points in Vue 3?
- [Affects R14][Technical] What renumbering strategy is most efficient? Scan all callout objects and reassign numbers on every delete, or maintain an ordered list?
- [Affects R18][Needs research] What approach for inline rich text editing in SVG? foreignObject with contenteditable, a lightweight rich text library, or custom SVG text rendering?
- [Affects R23][Technical] How to implement selection handles, rotation handles, and the Bezier control point as interactive SVG overlays?
- [Affects R15][Technical] What algorithm for automatically choosing a contrasting number color inside callouts? Simple luminance threshold, or WCAG contrast ratio calculation?

## Next Steps

-> /ce:plan for structured implementation planning (can be planned jointly with the layer architecture)
