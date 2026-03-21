---
date: 2026-03-20
topic: auto-crop-smart-trim
---

# Auto-Crop / Smart Trim

## Problem Frame

Screenshots almost always have unwanted uniform-color borders: window shadows, desktop background padding, terminal whitespace, browser chrome margins. Manual cropping is tedious and repetitive. Auto-detecting and offering to trim these borders saves 5-10 seconds on every paste — the highest value-to-effort feature for a clipboard image editor.

## Requirements

- R1. When a new image arrives in the clipboard tab, automatically scan for trimmable uniform-color borders on all four edges.
- R2. Auto-trim detection on clipboard paste is enabled by default and configurable in settings (can be turned off).
- R3. If trimmable borders are detected, present a visual suggestion: the detected border regions are dimmed/darkened, the kept region is shown at full brightness, and a "Trim" accept button appears on the image.
- R4. The user must explicitly accept the trim suggestion (click "Trim" button or equivalent). The trim is never applied automatically.
- R5. If the user starts editing (selects a tool, triggering auto-duplication to an edit tab) before accepting the trim, the trim suggestion is cancelled.
- R6. A "Smart Trim" button in the toolbar and a corresponding menu item allow the user to invoke auto-trim detection manually at any time on any tab, regardless of the auto-detection setting.
- R7. The border detection algorithm uses a configurable color variance threshold. The default is a moderate tolerance (small deltaE or similar metric, catching JPEG artifacts and slight noise). An advanced setting allows adjusting this threshold.
- R8. Trimming operates as a crop — it updates the viewport projection per the layer architecture (R9 from the annotation layer requirements). It does not destructively modify the base image, so it can be undone.
- R9. The trim is added to the unified undo stack as a single undoable action.

## Success Criteria

- Auto-trim correctly detects and offers to remove uniform borders on common screenshot types: macOS window shadows, Windows desktop background, terminal padding, browser page margins.
- False positive rate is low enough that users leave auto-detection enabled by default.
- The detection and UI presentation add no perceptible delay to the clipboard paste workflow.
- The trim suggestion is unobtrusive — it doesn't block or slow down users who want to skip it and start editing immediately.

## Scope Boundaries

- **No content-aware cropping** (e.g., detecting and cropping to a specific window or UI element within the screenshot). Only uniform-color border detection.
- **No batch trim** across multiple tabs.
- **No automatic acceptance** — the trim always requires explicit user confirmation.

## Key Decisions

- **Overlay with dimmed borders:** Chosen over dashed crop lines or floating banners. The dimming makes it immediately obvious what will be removed without requiring the user to interpret crop lines.
- **Cancel on edit start:** If the user wants to annotate without trimming, simply starting to edit dismisses the suggestion. No friction.
- **Configurable threshold:** Balances the needs of users with clean PNG screenshots (strict matching works) and users with JPEG artifacts or anti-aliased edges (need moderate tolerance). Default is moderate.
- **Non-destructive (crop-as-projection):** Consistent with the layer architecture. Trim is reversible via undo.

## Dependencies / Assumptions

- Depends on the annotation layer architecture's crop-as-projection model (R9 from layer architecture requirements).
- Assumes access to raw pixel data of the clipboard image for border scanning (via canvas getImageData or Rust-side analysis).
- Detection must run fast enough to not delay the clipboard paste display (target: under 50ms for typical screenshot sizes).

## Outstanding Questions

### Deferred to Planning

- [Affects R1][Technical] Should border detection run on the frontend (JS canvas getImageData) or in the Rust backend (faster for large images, but requires IPC round-trip)?
- [Affects R7][Needs research] What specific color distance metric and default threshold value work best across common screenshot types? CIE deltaE, simple RGB Euclidean distance, or per-channel tolerance?

## Next Steps

-> /ce:plan for structured implementation planning
