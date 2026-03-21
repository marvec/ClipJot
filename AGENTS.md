# ClipJot

A simple desktop application to edit images directly from the clipboard.

## Core Purpose

ClipJot is a desktop application that allows simple jotting/editing of images directly in clipboard.

## Tech Stack

- Exclusively use `bun` to run commands and install packages. Don't use `npm`
  or `pnpm` or `npx` or other variants unless there's a specific reason to break
  from the norm.
- Since we use `bun` we can natively run typescript without compilation. So even
  local scripts we run can be .ts files.

- Runtime/tooling: Bun
- UI: Vue 3, TypeScript, Vite
- Desktop: Tauri v2 (`src-tauri/`)
- Clipboard management: `@tauri-apps/plugin-clipboard-manager` (https://v2.tauri.app/plugin/clipboard/)
- Flexoki for color schemes: (https://github.com/kepano/flexoki)
- Flexoki for color schemes: (https://github.com/kepano/flexoki)


## Agent Environment

You must set `AGENT=1` at the start of any terminal session to enable
AI-friendly output from Bun's test runner:

```bash
export AGENT=1
```

## Code formatting

We have a Prettier config (`prettierrc.json`) at the project root.

**Important:** Always preserve trailing newlines at the end of files.

## Typescript

We use typescript everywhere possible and try to stick to fairly strict types,
which are then linted with typescript powered eslint.

Project should respond to `bun run tsc` for typechecking.

## Performance

**CRITICAL: Avoid nested loops and O(n²) operations.**

- When iterating over collections, calculate expensive values ONCE before the
  loop, not inside it
- Never nest loops unless absolutely necessary - it's expensive and usually
  there's a better way
- If you need to check conditions on remaining elements, scan backwards once
  upfront instead of checking inside the main loop

Example of BAD code:

```typescript
for (let i = 0; i < items.length; i++) {
  // DON'T DO THIS - nested loop on every iteration
  let hasMoreItems = false;
  for (let j = i + 1; j < items.length; j++) {
    if (items[j].someCondition) {
      hasMoreItems = true;
      break;
    }
  }
}
```

Example of GOOD code:

```typescript
// Calculate once upfront
let lastMeaningfulIndex = items.length - 1;
for (let i = items.length - 1; i >= 0; i--) {
  if (items[i].someCondition) {
    lastMeaningfulIndex = i;
    break;
  }
}

// Now iterate efficiently
for (let i = 0; i <= lastMeaningfulIndex; i++) {
  const isLast = i === lastMeaningfulIndex;
  // ...
}
```

## Testing

We use Bun's built-in testing framework for unit tests. Tests are located in a
`test/` folder, separate from the source code.

### Test Strategy

- Prefer unit/integration tests (`bun test`) by default.
- Add Playwright/browser E2E tests only when behavior cannot be validated
  without a real browser engine.
- Good Playwright candidates include computed style checks, shadow DOM
  encapsulation boundaries, and browser-only rendering behavior.
- Keep E2E coverage intentionally small and high-value.
- Prefer explicit assertions over broad snapshots.
- Avoid snapshot tests unless they are shallow and narrowly scoped to the exact
  behavior under test.

### Running Tests

```bash
bun test
```

### Updating Snapshots

When test snapshots need to be updated:

```bash
bun test -u
```

### Test Structure

- Tests use Bun's native `describe`, `test`, and `expect` from `bun:test`
- Snapshot testing is supported natively via `toMatchSnapshot()`
- Shared test fixtures and mocks are located in `test/mocks.ts`
- Test files are included in TypeScript type checking via `tsconfig.json`

## Browser Automation

Use `agent-browser` for web automation. Run `agent-browser --help` for all
commands.

Core workflow:

1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes