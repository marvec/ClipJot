---
date: 2026-03-20
topic: ephemeral-by-default
---

# Ephemeral-by-Default / Clipboard Round-Trip

## Problem Frame

ClipJot's core identity is a clipboard transformer: images come in from the clipboard, get annotated, and go back to the clipboard. The UX should reflect this. Traditional image editors optimize for persistence (save dialogs, file naming, format selection). ClipJot should optimize for transience — the user wants to annotate and paste somewhere else, not manage files. Every design decision should be filtered through: "does this serve the clipboard round-trip?"

## Requirements

- R1. The primary output action is copy-to-clipboard (Cmd+C on macOS, Ctrl+C on Windows). This copies the flattened, rasterized annotated image to the system clipboard.
- R2. Auto-copy on tab close is enabled by default. When a tab is closed, its current content is automatically copied to the clipboard before closing. This behavior is togglable in settings.
- R3. A close-warning dialog appears only if the tab has been edited since the last copy-to-clipboard. The warning offers three options: **Copy & Close** (copies then closes), **Discard** (closes without copying), **Cancel** (aborts the close).
- R4. Save-to-file (Cmd+S / Ctrl+S) is accessible via the tab toolbar and the menu bar. It triggers a save-as dialog for PNG or JPG. The system never prompts save-to-file on its own — it is always user-initiated.
- R5. When content is successfully copied to clipboard, the app shows a brief flash/toast confirmation (~1 second, auto-dismiss) and marks the tab with a persistent "copied" indicator (small visual badge or icon change on the tab).
- R6. The tab's "copied" indicator resets when new edits are made after the most recent copy. This ensures the indicator always reflects whether the current state has been sent to clipboard.
- R7. On launch or hotkey activation, if the clipboard contains an image, show the permanent clipboard tab focused and ready to view. The user views the image first, then editing begins when they select a tool — which triggers auto-duplication into a new editing tab per the layer architecture requirements.
- R8. Keyboard behavior: Cmd+C copies the flattened image to clipboard. Cmd+W closes the current tab (triggering the close-warning if applicable per R3). Enter is reserved for text input within text annotations and must not trigger copy or close.
- R9. The tab toolbar contains all primary actions: copy to clipboard, save to file, duplicate tab, drawing tools (pen, pencil, marker, eraser), annotation tools (arrows, shapes, callouts), redaction tools, crop, text, and undo/redo. All toolbar actions are mirrored in the application menu bar.
- R10. The clipboard tab's toolbar additionally includes a **refresh button** that re-reads the current clipboard content and updates the displayed image.
- R11. No session persistence beyond tab lifetime. When a tab is closed, its layer state, undo history, and edit state are gone. This is consistent with the ephemeral philosophy and the annotation layer architecture decisions.

## Success Criteria

- The clipboard round-trip (paste-in → annotate → copy-out) can be completed in under 5 seconds for simple annotations.
- A user who has never seen ClipJot can discover how to copy back to clipboard within their first use (Cmd+C is universally known; the toolbar copy button is visible).
- Closing a tab never silently loses un-copied edits — the close-warning catches the case where edits exist after last copy.
- File save exists and is easily accessible but the default flow never requires it.

## Scope Boundaries

- **No auto-save to disk** — the app does not write files unless the user explicitly triggers save.
- **No recent-files or reopen-last-session** — tabs are ephemeral; there is no session recovery.
- **No "save all before quit"** — on app quit, the same per-tab close-warning logic applies to each open tab that has unsaved edits since last copy.
- **Settings remain configurable** — auto-copy on close and close-warning behavior can be toggled by users who want different defaults, but the out-of-box experience is strongly ephemeral.
- **No drag-out or URL sharing** — output paths are clipboard and file save only (for now).

## Key Decisions

- **Strong ephemeral philosophy:** Auto-copy on close is the default, not an opt-in setting. This was a deliberate choice over moderate or soft ephemeral approaches.
- **Close-warning triggers on edits-since-last-copy:** More protective than "never warn" but less annoying than "always warn if unsaved to disk." The right balance for a clipboard-first tool.
- **Close-warning offers Copy & Close / Discard / Cancel:** Three options give the user full control without introducing save-to-file in the interrupt flow.
- **Clipboard tab shows preview first:** On launch, the user sees the clipboard image before editing. This preserves the mental model of "I see what's in my clipboard" before committing to annotate. Editing triggers auto-duplication per the layer architecture.
- **Toolbar has all actions including save:** Save is not hidden — it's on the toolbar and in the menu. The ephemeral philosophy is about default flow, not about removing functionality.
- **Enter reserved for text:** Avoids the mistake of making Enter a "done/copy" shortcut, which would conflict with text annotation input.

## Dependencies / Assumptions

- Depends on the annotation layer architecture (R1–R17 in `2026-03-20-annotation-layer-architecture-requirements.md`) for the flattening/rasterization that copy-to-clipboard requires.
- Depends on Tauri's clipboard-manager plugin for writing images to the system clipboard.
- Assumes Cmd+C can be intercepted by the app to trigger the custom "copy flattened image" behavior rather than the browser's default copy.

## Outstanding Questions

### Deferred to Planning

- [Affects R1][Technical] How to intercept Cmd+C in the Tauri webview to trigger flattened-image copy rather than default browser copy behavior?
- [Affects R2][Technical] What is the best way to flatten all four layers into a raster image suitable for clipboard writing? (Shared concern with the layer architecture planning.)
- [Affects R5][Technical] What toast/notification library or pattern to use for the copy confirmation flash? Vue transition, native notification, or custom overlay?
- [Affects R9][Needs research] What is the optimal toolbar layout for fitting copy, save, 6+ drawing/annotation tools, redaction, crop, text, and undo/redo without overwhelming the minimal aesthetic?

## Next Steps

-> /ce:plan for structured implementation planning (can be planned jointly with the annotation layer architecture)
