---
title: "feat: Unified Undo/Redo System"
type: feat
status: active
date: 2026-03-21
origin: docs/brainstorms/2026-03-20-annotation-layer-architecture-requirements.md
---

# feat: Unified Undo/Redo System

## Overview

Implement a memory-efficient, command-pattern-based undo/redo system that spans all four rendering layers (base image, redaction, freehand canvas, SVG annotations) and the crop viewport. Each tab maintains its own independent undo/redo stack, entirely in-memory with no persistence.

This is foundational infrastructure — nearly every editing feature depends on it. The system must handle heterogeneous layer types (bitmap freehand, SVG objects, metadata crop) through a unified command interface, with special attention to the freehand canvas where the eraser contradiction and history pruning create non-trivial architectural challenges.

## Problem Statement / Motivation

Every image editor needs undo/redo. ClipJot's 4-layer hybrid rendering (Canvas + SVG) makes this harder than a single-layer bitmap editor because:

1. **Different layers need different undo strategies** — SVG is object-based, freehand is bitmap, crop is metadata
2. **The eraser creates a contradiction** — the proposed "replay strokes" undo model breaks with pixel-level erasure unless erasure is reframed as a compositing stroke
3. **Memory is a real constraint** — a naive ImageData snapshot approach costs ~8 MB per undo step at 1080p, ~32 MB at 4K. With 50 steps, that's 400 MB–1.6 GB per tab
4. **Tab duplication (R16) must deep-copy undo history** — the data structures must be efficiently cloneable

(see origin: `docs/brainstorms/2026-03-20-annotation-layer-architecture-requirements.md`, R10–R11, R15–R16)

## Proposed Solution

### Architecture: Command Pattern with Replay-Based Freehand Undo

A **command-pattern undo stack** where each undoable action is a `Command` object with `execute()` and `undo()` methods. The stack is an array with a cursor index.

**Per-layer undo strategies:**

| Layer | Strategy | Data Stored per Command | Undo Cost |
|-------|----------|------------------------|-----------|
| SVG Annotations | Object mutation commands | Object snapshot (before/after state) | O(1) — direct restore |
| Redaction | Object mutation commands | Region rect + style (before/after) | O(1) — direct restore |
| Freehand Canvas | **Compositing stroke replay** | Stroke path data (`Point[]` + tool config) | O(n) — replay from checkpoint |
| Crop | Metadata swap | Previous + new viewport rect | O(1) — swap rect |

**Critical design decision: Eraser as compositing stroke.** The eraser is stored as a stroke with `globalCompositeOperation: 'destination-out'`. All freehand strokes (additive and subtractive) are replayed in order. This resolves the eraser/replay contradiction without requiring canvas snapshots (see "Eraser Resolution" section below).

**Critical design decision: Checkpoint model for history pruning.** When freehand commands are pruned from the undo stack, their strokes are not discarded — they are "baked" into a checkpoint canvas snapshot. Replay starts from the most recent checkpoint instead of from stroke #1, bounding both memory and replay cost (see "Checkpoint Model" section below).

### Core Data Structures

```typescript
// src/composables/useUndoRedo.ts

interface Command {
  /** Unique ID for debugging/tracking */
  readonly id: string
  /** Human-readable label for UI (e.g., "Draw stroke", "Move arrow") */
  readonly label: string
  /** Which layer this command affects */
  readonly layer: 'freehand' | 'svg' | 'redaction' | 'crop'
  /** Apply the action */
  execute(): void
  /** Reverse the action */
  undo(): void
  /** Create a deep clone for tab duplication */
  clone(): Command
}

interface CompoundCommand extends Command {
  /** Sub-commands executed/undone as a single unit */
  readonly commands: Command[]
}

interface UndoStack {
  /** All commands in history */
  commands: Command[]
  /** Points to the current position (next undo). -1 = nothing to undo */
  cursor: number
  /** Maximum history depth */
  maxDepth: number
  /** Position of cursor when last copied/exported (for "edited" detection) */
  savedAtIndex: number
}
```

### Freehand Stroke Data Model

```typescript
// src/types/freehand.ts

interface StrokePoint {
  x: number
  y: number
  pressure?: number  // for future pressure-sensitive input
}

interface FreehandStroke {
  /** Unique stroke ID */
  id: string
  /** Array of points forming the path */
  points: StrokePoint[]
  /** Drawing tool configuration */
  tool: 'pen' | 'pencil' | 'marker' | 'eraser'
  /** Stroke color (hex) — ignored for eraser */
  color: string
  /** Stroke width in pixels */
  strokeWidth: number
  /** Opacity (0-1) — 0.5 for marker, 1.0 for pen/pencil */
  opacity: number
  /**
   * Canvas composite operation.
   * 'source-over' for additive strokes (pen, pencil, marker)
   * 'destination-out' for eraser
   */
  compositeOperation: GlobalCompositeOperation
}

interface FreehandCheckpoint {
  /** ImageData snapshot of all committed (pruned) strokes */
  imageData: ImageData
  /** Number of strokes baked into this checkpoint */
  strokeCount: number
}
```

## Technical Approach

### Phase 1: Core Undo Infrastructure

**Files to create:**
- `src/composables/useUndoRedo.ts` — Vue composable exposing undo/redo stack per tab
- `src/types/commands.ts` — Command interface and concrete command types
- `src/types/freehand.ts` — Freehand stroke data structures

**The composable:**

```typescript
// src/composables/useUndoRedo.ts
export function useUndoRedo(maxDepth = 50) {
  const commands = ref<Command[]>([])
  const cursor = ref(-1)
  const savedAtIndex = ref(-1)
  const isOperationInProgress = ref(false)

  const canUndo = computed(() => cursor.value >= 0 && !isOperationInProgress.value)
  const canRedo = computed(() => cursor.value < commands.value.length - 1 && !isOperationInProgress.value)
  const isEdited = computed(() => cursor.value !== savedAtIndex.value)

  function push(command: Command): void {
    // Truncate redo branch
    commands.value = commands.value.slice(0, cursor.value + 1)
    commands.value.push(command)
    cursor.value++

    // Prune if over max depth
    if (commands.value.length > maxDepth) {
      const pruned = commands.value.shift()!
      cursor.value--
      savedAtIndex.value--
      onCommandPruned(pruned)  // Hook for checkpoint creation
    }

    command.execute()
  }

  function undo(): void {
    if (!canUndo.value) return
    commands.value[cursor.value].undo()
    cursor.value--
  }

  function redo(): void {
    if (!canRedo.value) return
    cursor.value++
    commands.value[cursor.value].execute()
  }

  function markSaved(): void {
    savedAtIndex.value = cursor.value
  }

  // ... clone(), clear(), onCommandPruned callback registration
}
```

**Key behaviors:**
- `push()` truncates the redo branch (everything after cursor), appends, and executes
- `undo()` calls `undo()` on current command, decrements cursor
- `redo()` increments cursor, calls `execute()` on the new current command
- `push()` while redo history exists clears the redo branch (standard behavior)
- `isOperationInProgress` gate prevents undo/redo during active draw/drag operations

**Tasks:**
1. Create `Command` interface and `CompoundCommand` wrapper
2. Implement `useUndoRedo` composable with push/undo/redo/clone/clear
3. Implement history depth cap with pruning callback
4. Implement `savedAtIndex` tracking for edited-state detection
5. Implement `isOperationInProgress` guard
6. Unit tests for all stack operations (push, undo, redo, prune, branch truncation, clone)

**Estimated effort:** 2-3 hours

### Phase 2: Freehand Canvas Commands

**Files to create/modify:**
- `src/commands/FreehandStrokeCommand.ts` — Command for additive strokes + eraser
- `src/composables/useFreehandCanvas.ts` — Canvas rendering with stroke replay

**Eraser Resolution:**

The eraser is stored identically to other strokes but with `compositeOperation: 'destination-out'`. During replay, each stroke is drawn in order with its stored composite operation. This means:

1. Draw red line (stroke A, `source-over`) ✅
2. Draw blue circle (stroke B, `source-over`) ✅
3. Erase intersection (stroke C, `destination-out`) ✅
4. Undo → remove stroke C → replay A + B → full red line + blue circle ✅
5. Undo → remove stroke B → replay A → only red line ✅

No special cases. No canvas snapshots. The eraser is just another stroke.

```typescript
// src/commands/FreehandStrokeCommand.ts
class FreehandStrokeCommand implements Command {
  readonly layer = 'freehand' as const

  constructor(
    private readonly stroke: FreehandStroke,
    private readonly canvasManager: FreehandCanvasManager,
  ) {}

  execute(): void {
    this.canvasManager.addStroke(this.stroke)
    this.canvasManager.replay()  // Replay from checkpoint + all active strokes
  }

  undo(): void {
    this.canvasManager.removeLastStroke()
    this.canvasManager.replay()
  }

  clone(): Command {
    return new FreehandStrokeCommand(
      structuredClone(this.stroke),
      this.canvasManager,  // Manager is per-tab, cloned separately during tab dup
    )
  }
}
```

**Checkpoint Model:**

When a `FreehandStrokeCommand` is pruned from the undo stack (history cap exceeded), the pruned stroke is "committed" — it can never be undone. Rather than keeping all committed strokes' path data forever (unbounded memory), periodically flatten committed strokes into a canvas `ImageData` checkpoint:

```
[Checkpoint ImageData] + [Stroke N+1] + [Stroke N+2] + ... + [Stroke N+K]
                         ^--- still in undo stack, replayable ---^
```

Replay = draw checkpoint to canvas, then replay active strokes on top.

**Checkpoint creation strategy:**
- Create a new checkpoint every time a freehand command is pruned from the undo stack
- The checkpoint is a single `ImageData` (or compressed `Blob` via `toBlob('image/webp', 0.92)` for memory savings)
- Only one checkpoint exists at a time (replaced on each prune)

**Memory analysis (checkpoint approach):**

| Canvas Size | Raw Checkpoint | WebP Compressed (~20:1) | Per-Stroke Path Data (~1 KB avg) | 50 Strokes in Stack |
|---|---|---|---|---|
| 1920×1080 | 7.9 MB | ~400 KB | ~1 KB | ~50 KB |
| 3840×2160 | 31.6 MB | ~1.6 MB | ~1 KB | ~50 KB |

Total memory per tab (50 undo steps, 4K): ~1.7 MB for freehand history vs. ~1.6 GB with naive per-step snapshots. **~940× improvement.**

**Tasks:**
1. Define `FreehandStroke` and `FreehandCheckpoint` types
2. Implement `FreehandCanvasManager` with stroke array + checkpoint + replay
3. Implement `FreehandStrokeCommand` with execute/undo/clone
4. Implement checkpoint creation on prune (sync `ImageData` for v1, compressed `Blob` as optimization)
5. Implement `drawStroke()` renderer that respects composite operations
6. Unit tests: add stroke → undo → redo, eraser stroke → undo, checkpoint creation on prune, replay correctness after checkpoint

**Estimated effort:** 4-6 hours

### Phase 3: SVG & Redaction Commands

**Files to create:**
- `src/commands/SvgCreateCommand.ts`
- `src/commands/SvgMutateCommand.ts`
- `src/commands/SvgDeleteCommand.ts`
- `src/commands/RedactionCreateCommand.ts`
- `src/commands/RedactionMutateCommand.ts`
- `src/commands/RedactionDeleteCommand.ts`
- `src/commands/CalloutDeleteCommand.ts` (handles renumber cascade)

SVG and redaction commands are straightforward — they store before/after snapshots of the affected object(s) and directly mutate reactive arrays.

```typescript
// src/commands/SvgMutateCommand.ts
class SvgMutateCommand implements Command {
  readonly layer = 'svg' as const

  constructor(
    private readonly objectId: string,
    private readonly before: SvgAnnotationSnapshot,
    private readonly after: SvgAnnotationSnapshot,
    private readonly store: AnnotationStore,
  ) {}

  execute(): void {
    this.store.applySnapshot(this.objectId, this.after)
  }

  undo(): void {
    this.store.applySnapshot(this.objectId, this.before)
  }
}
```

**Numbered callout cascade:** When a numbered callout is deleted, remaining callouts auto-renumber. The `CalloutDeleteCommand` must capture the numbering state of ALL callouts before deletion, so `undo()` can restore original numbers:

```typescript
class CalloutDeleteCommand implements Command {
  constructor(
    private readonly deletedCallout: CalloutSnapshot,
    private readonly renumberMap: Map<string, { before: number; after: number }>,
    private readonly store: AnnotationStore,
  ) {}

  undo(): void {
    this.store.addCallout(this.deletedCallout)
    // Restore original numbers for all affected callouts
    for (const [id, { before }] of this.renumberMap) {
      this.store.setCalloutNumber(id, before)
    }
  }
}
```

**Tasks:**
1. Implement SVG create/mutate/delete commands
2. Implement redaction create/mutate/delete commands (R11 expansion — all CRUD is undoable, not just creation)
3. Implement `CalloutDeleteCommand` with renumber cascade capture
4. Implement `CompoundCommand` for batch operations (multi-select + delete/move)
5. Unit tests for each command type, including callout renumber undo

**Estimated effort:** 3-4 hours

### Phase 4: Crop Command

**Files to create:**
- `src/commands/CropCommand.ts`

Crop undo is trivially cheap — swap viewport rect metadata:

```typescript
class CropCommand implements Command {
  readonly layer = 'crop' as const

  constructor(
    private readonly before: CropRect | null,  // null = uncropped
    private readonly after: CropRect,
    private readonly viewport: Ref<CropRect | null>,
  ) {}

  execute(): void { this.viewport.value = this.after }
  undo(): void { this.viewport.value = this.before }
}
```

**Tasks:**
1. Implement `CropCommand`
2. Integrate with auto-crop/smart-trim (accepted trim = single `CropCommand` pushed to stack)
3. Unit tests

**Estimated effort:** 30 minutes

### Phase 5: Keyboard Shortcuts & UI Integration

**Files to modify:**
- `src/App.vue` (or toolbar component) — keyboard listener registration
- Toolbar component — undo/redo buttons with disabled states

**Keyboard shortcuts:**
- `Cmd+Z` (macOS) / `Ctrl+Z` (Windows/Linux) → undo
- `Cmd+Shift+Z` / `Ctrl+Shift+Z` → redo
- `Cmd+Y` / `Ctrl+Y` → redo (alternative)

**Active operation guard:**

```typescript
// In the composable that manages drawing/dragging
function onPointerDown(e: PointerEvent) {
  undoStack.isOperationInProgress.value = true
  // ... begin draw/drag
}

function onPointerUp(e: PointerEvent) {
  // ... finalize draw/drag, push command to stack
  undoStack.isOperationInProgress.value = false
}
```

While `isOperationInProgress` is true, `undo()` and `redo()` are no-ops. This prevents state corruption from simultaneous keyboard + pointer input.

**Two-tier text undo:**
When a rich text annotation has focus, `Cmd+Z` is intercepted by the text editor for text-level undo. The global undo stack is paused. On blur, the entire text editing session is committed as a single `SvgMutateCommand` (before = text content at focus time, after = text content at blur time). If no change occurred, no command is pushed.

**Tasks:**
1. Register global keyboard shortcuts (Tauri-aware — may need `@tauri-apps/api/event`)
2. Implement `isOperationInProgress` guard in pointer event handlers
3. Wire undo/redo buttons with `canUndo`/`canRedo` computed disabled states
4. Implement two-tier text undo (focus = local, blur = commit to global stack)
5. Implement `isEdited` for close-tab warning (based on `savedAtIndex`)

**Estimated effort:** 2-3 hours

### Phase 6: Tab Duplication Deep Copy

When a tab is duplicated (R16), the undo stack must be deep-cloned. Each `Command` implements `clone()`:

- SVG/redaction commands: `structuredClone()` the snapshot data, point to the new tab's store
- Freehand commands: `structuredClone()` the stroke path data
- Freehand checkpoint: Clone the `ImageData` (or copy the compressed `Blob`)
- Crop commands: Clone the rect objects

The `useUndoRedo` composable exposes a `clone(newTabContext)` method that:
1. Creates a new `UndoStack` with the same `maxDepth` and `savedAtIndex`
2. Calls `command.clone()` on every command, rebinding to the new tab's stores/managers
3. Sets the new stack's cursor to match the original

**Tasks:**
1. Implement `clone()` on every command type
2. Implement `UndoStack.clone(newContext)` 
3. Integration test: duplicate tab → undo in clone → verify original unaffected

**Estimated effort:** 1-2 hours

## System-Wide Impact

### Interaction Graph

`push(command)` → `command.execute()` → layer-specific mutation (reactive array splice / canvas replay / viewport ref update) → Vue reactivity triggers component re-render → UI updates.

`undo()` → `command.undo()` → reverse mutation → same reactivity chain.

Freehand `replay()` → clear canvas → draw checkpoint → draw each active stroke in order → canvas visually updated.

### Error Propagation

Commands are synchronous. If `execute()` throws, the command is not added to the stack (push should wrap in try/catch). If `undo()` throws, the cursor has already moved — this is a critical bug. **Mitigation:** Command implementations must be infallible by construction (operate on owned data, no external I/O).

### State Lifecycle Risks

- **Pruned freehand strokes without checkpoint:** If a freehand command is pruned but the checkpoint is not updated, replaying the canvas will produce incorrect output. **Mitigation:** Checkpoint creation is synchronous and mandatory in the prune callback.
- **Redo branch with stale object references:** When redo is truncated, the discarded commands may hold references to SVG objects that still exist in the DOM. This is benign (GC handles it) but commands should not retain DOM references — only data snapshots.
- **Tab close without cleanup:** Per ephemeral design, closing a tab drops all state. The composable's `clear()` nullifies the checkpoint and command array. No explicit cleanup needed beyond letting GC collect.

### API Surface Parity

The `useUndoRedo` composable is the single API. All tools (freehand, SVG, redaction, crop) interact with undo exclusively through `push(command)`. No tool directly manipulates the stack.

### Integration Test Scenarios

1. **Cross-layer undo ordering:** Draw stroke → add arrow → add redaction → crop → undo 4× → verify each layer restored in reverse order
2. **Eraser + replay correctness:** Draw 3 strokes → erase intersection → undo eraser → verify all 3 strokes fully visible → undo stroke 3 → verify strokes 1+2 visible
3. **Checkpoint after prune:** Draw 55 strokes (cap = 50) → verify checkpoint contains first 5 strokes baked → undo 50× → verify canvas shows checkpoint (strokes 1-5) only
4. **Tab duplication isolation:** Make 10 edits → duplicate tab → undo 5× in clone → verify original still has 10 edits
5. **Redo branch truncation:** Draw A → Draw B → undo → Draw C → verify redo stack is empty (B is gone)

## Acceptance Criteria

### Functional Requirements

- [ ] `Cmd+Z` undoes the last action regardless of which layer it affected
- [ ] `Cmd+Shift+Z` redoes the last undone action
- [ ] New actions after undo clear the redo branch
- [ ] Eraser strokes are fully undoable (erased pixels reappear)
- [ ] History is capped at configurable depth (default 50)
- [ ] Pruned freehand strokes are checkpointed (canvas stays correct)
- [ ] Each tab has independent undo/redo history
- [ ] Tab duplication deep-copies undo history
- [ ] Tab close frees all undo memory
- [ ] Undo/redo buttons show correct disabled state
- [ ] Close-tab warning accounts for undo state (`isEdited` via `savedAtIndex`)
- [ ] Undo/redo suppressed during active draw/drag operations
- [ ] Rich text `Cmd+Z` does text-level undo when text box is focused
- [ ] Rich text session committed as single undo step on blur
- [ ] Numbered callout deletion + undo restores original numbering
- [ ] Batch operations (multi-select delete/move) are single undo steps

### Non-Functional Requirements

- [ ] Memory per tab with 50 undo steps ≤ 5 MB at 1080p (freehand strokes + SVG snapshots)
- [ ] Freehand replay ≤ 16ms for ≤ 50 strokes at 1080p (one frame budget)
- [ ] Undo/redo latency < 50ms perceived

### Quality Gates

- [ ] Unit tests for all command types (create, execute, undo, clone)
- [ ] Unit tests for stack operations (push, undo, redo, prune, truncate, clone)
- [ ] Integration tests for cross-layer undo ordering
- [ ] Integration test for checkpoint correctness after pruning

## Alternative Approaches Considered

### Full ImageData Snapshots (Rejected)

Store complete canvas pixel buffer after every action. Simple but **~940× more memory** than path-based approach at 4K. Rejected per ideation doc: "a simple undo stack with serializable commands suffices."

### Event-Sourced Document Model (Rejected)

Full CQRS/event-sourcing architecture. Explicitly rejected in ideation as "architecture astronautics." The command pattern provides sufficient power for ClipJot's scope.

### Compressed Blob Snapshots per Step (Rejected for v1)

Using `canvas.toBlob('image/webp')` per undo step. 10-40× compression vs raw ImageData, but async decompression adds latency on undo. May be used for **checkpoint** compression as a later optimization, but not for per-step storage.

### Diff-Based Pixel Storage (Rejected)

Store only changed pixels between states. Good for localized edits but complex to implement, doesn't work well with large brush strokes, and the path-based replay approach is simpler and more memory-efficient for our use case.

## Dependencies & Prerequisites

- **Annotation layer architecture** must be implemented first (4-layer DOM structure, Canvas + SVG rendering)
- **Tool system** must integrate with undo by calling `push(command)` after each action
- **Tab system** must wire each tab to its own `useUndoRedo` instance
- Depends on `docs/plans/2026-03-21-001-feat-clipjot-v1-full-implementation-beta-plan.md` for overall architecture

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Freehand replay too slow for 50+ strokes at 4K | Medium | High | Checkpoint reduces replay to ≤50 strokes. Profile early; if needed, increase checkpoint frequency |
| Eraser compositing (`destination-out`) produces unexpected visual artifacts | Low | Medium | Test with various brush sizes and overlapping strokes early |
| Memory leak from command references preventing GC | Low | High | Commands store plain data (not DOM refs). Use `WeakRef` if needed for store references |
| Tab duplication takes too long with large undo history | Low | Medium | `structuredClone` is fast for plain objects. Checkpoint ImageData clone is a single buffer copy |
| Two-tier text undo feels wrong to users | Medium | Medium | Follow established pattern (Figma, Notion). Test with users early |

## Scope Exclusions

- **No persistent undo** — undo history is in-memory only, lost on tab close (see origin: ephemeral-by-default-requirements.md)
- **No OffscreenCanvas / Web Workers** — premature optimization per ideation doc rejection #15
- **Zoom/pan/scroll are NOT undoable** — viewport navigation excluded from undo stack
- **Tool/color/setting changes do NOT clear redo** — only actions that create commands clear redo
- **Tab creation is NOT undoable** — undoing the first edit in an auto-duplicated tab leaves the tab open but unmodified

## Open Questions Resolved

| Question | Resolution | Rationale |
|----------|-----------|-----------|
| How does eraser undo work? | Compositing stroke (`destination-out`) replayed in sequence | Keeps replay model intact, no snapshots needed, eraser undo is "free" |
| What happens to pruned freehand strokes? | Baked into checkpoint `ImageData` | Bounds both memory and replay cost |
| Undo during active operation? | Suppressed via `isOperationInProgress` flag | Prevents state corruption from simultaneous input |
| Cmd+Z in focused text box? | Two-tier: text-level undo when focused, global on blur | Matches established UX patterns (Figma, Notion) |
| Are redaction modifications undoable? | Yes — all CRUD operations | Consistency with SVG annotations (R11 expansion) |
| Compound/batch operations? | Single undo step via `CompoundCommand` | Expected UX for multi-select operations |
| SVG property change granularity? | Each discrete change = 1 step (v1) | Simplest correct implementation; coalescing is future optimization |
| History depth cap? | 50, not user-configurable (v1) | Reasonable default; revisit based on memory profiling |
| "Edited" close warning after full undo? | `savedAtIndex` tracking — no warning if at saved position | Matches text editor conventions |

## Sources & References

### Origin

- **Origin document:** [docs/brainstorms/2026-03-20-annotation-layer-architecture-requirements.md](docs/brainstorms/2026-03-20-annotation-layer-architecture-requirements.md) — Key decisions carried forward: unified undo stack (R10), command pattern (not event sourcing), per-tab independent history (R15), tab duplication deep-copies history (R16)

### Internal References

- Ideation doc (rejections): `docs/ideation/2026-03-20-clipjot-open-ideation.md` — event sourcing rejected (#13), OffscreenCanvas rejected (#15)
- Annotation primitives: `docs/brainstorms/2026-03-20-annotation-primitives-requirements.md` — tool definitions
- Redaction: `docs/brainstorms/2026-03-20-dedicated-redaction-requirements.md` — R10 non-destructive during session, R12 all operations undoable
- Auto-crop: `docs/brainstorms/2026-03-20-auto-crop-smart-trim-requirements.md` — R8-R9 crop as viewport projection + undo
- Ephemeral: `docs/brainstorms/2026-03-20-ephemeral-by-default-requirements.md` — R11 no session persistence

### External Research

- MDN Canvas API: `getImageData()`, `putImageData()`, `globalCompositeOperation`
- Stack Overflow: Canvas undo/redo patterns, command pattern implementations
- Memory benchmarks: `width × height × 4` bytes per ImageData snapshot
- WebP `toBlob()` compression: ~10-40× reduction for canvas snapshots
