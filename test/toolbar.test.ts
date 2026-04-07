import { describe, test, expect } from "bun:test";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const componentsDir = resolve(__dirname, "../src/components");

function readComponent(name: string): string {
  return readFileSync(resolve(componentsDir, name), "utf-8");
}

describe("Toolbar Components", () => {
  test("ToolButton.vue exists", () => {
    expect(existsSync(resolve(componentsDir, "ToolButton.vue"))).toBe(true);
  });

  test("ActionButton.vue exists", () => {
    expect(existsSync(resolve(componentsDir, "ActionButton.vue"))).toBe(true);
  });
});

describe("Toolbar", () => {
  const toolbar = readComponent("Toolbar.vue");

  test("imports all 12 tool icons from lucide-vue-next", () => {
    const expectedIcons = [
      "MousePointer2",
      "Pen",
      "Pencil",
      "Highlighter",
      "Eraser",
      "MoveUpRight",
      "Minus",
      "Square",
      "Circle",
      "Hash",
      "Type",
      "ShieldOff",
    ];
    for (const icon of expectedIcons) {
      expect(toolbar).toContain(icon);
    }
  });

  test("defines all 12 tool buttons", () => {
    const toolIds = [
      "select",
      "pen",
      "pencil",
      "marker",
      "eraser",
      "arrow",
      "line",
      "rect",
      "ellipse",
      "callout",
      "text",
      "redact",
    ];
    for (const id of toolIds) {
      expect(toolbar).toContain(`id: "${id}"`);
    }
  });

  test("contains action button icons", () => {
    const actionIcons = [
      "Undo2",
      "Redo2",
      "Copy",
      "Save",
      "RefreshCw",
      "CopyPlus",
    ];
    for (const icon of actionIcons) {
      expect(toolbar).toContain(icon);
    }
  });

  test("emits toolbar action events", () => {
    const events = [
      "undo",
      "redo",
      "copy",
      "save",
      "refresh",
      "duplicate",
    ];
    for (const event of events) {
      expect(toolbar).toContain(`emit('${event}')`);
    }
  });

  test("uses useToolStore for active tool state", () => {
    expect(toolbar).toContain("useToolStore");
    expect(toolbar).toContain("activeTool");
    expect(toolbar).toContain("setTool");
  });

  test("active tool gets distinct visual class", () => {
    expect(toolbar).toContain("activeTool === asTool(tool).id");
    expect(toolbar).toContain("is-active");
  });

  test("has toolbar ARIA role and labels", () => {
    expect(toolbar).toContain('role="toolbar"');
    expect(toolbar).toContain('aria-label="Main toolbar"');
    expect(toolbar).toContain('aria-label="Drawing tools"');
    expect(toolbar).toContain('aria-label="Actions"');
  });

  test("includes dividers between action groups", () => {
    expect(toolbar).toContain("toolbar__divider");
    expect(toolbar).toContain('role="separator"');
  });

  test("uses semantic tokens, no Flexoki primitives", () => {
    expect(toolbar).not.toMatch(/var\(--flexoki-/);
    expect(toolbar).toContain("var(--surface-panel)");
    expect(toolbar).toContain("var(--border-subtle)");
    expect(toolbar).toContain("var(--border-default)");
  });
});

describe("ToolButton", () => {
  const toolButton = readComponent("ToolButton.vue");

  test("accepts toolId, icon, label, isActive props", () => {
    expect(toolButton).toContain("toolId: ToolId");
    expect(toolButton).toContain("icon: Component");
    expect(toolButton).toContain("label: string");
    expect(toolButton).toContain("isActive: boolean");
  });

  test("emits select event with toolId", () => {
    expect(toolButton).toContain("select: [toolId: ToolId]");
  });

  test("has aria-label and aria-pressed attributes", () => {
    expect(toolButton).toContain("aria-label");
    expect(toolButton).toContain("aria-pressed");
  });

  test("applies active class based on isActive prop", () => {
    expect(toolButton).toContain("tool-btn--active");
    expect(toolButton).toContain("isActive");
  });

  test("renders icon at 18px size", () => {
    expect(toolButton).toContain(':size="18"');
  });

  test("button is 32x32", () => {
    expect(toolButton).toContain("width: 32px");
    expect(toolButton).toContain("height: 32px");
  });

  test("uses semantic tokens, no Flexoki primitives", () => {
    expect(toolButton).not.toMatch(/var\(--flexoki-/);
    expect(toolButton).toContain("var(--interactive-active)");
    expect(toolButton).toContain("var(--text-secondary)");
  });
});

describe("ActionButton", () => {
  const actionButton = readComponent("ActionButton.vue");

  test("accepts icon, label, disabled props", () => {
    expect(actionButton).toContain("icon: Component");
    expect(actionButton).toContain("label: string");
    expect(actionButton).toContain("disabled?: boolean");
  });

  test("emits click event", () => {
    expect(actionButton).toContain("click: []");
  });

  test("has aria-label attribute", () => {
    expect(actionButton).toContain("aria-label");
  });

  test("supports disabled state", () => {
    expect(actionButton).toContain(":disabled");
    expect(actionButton).toContain("action-btn:disabled");
  });

  test("renders icon at 18px size", () => {
    expect(actionButton).toContain(':size="18"');
  });

  test("button is 32x32", () => {
    expect(actionButton).toContain("width: 32px");
    expect(actionButton).toContain("height: 32px");
  });

  test("uses semantic tokens, no Flexoki primitives", () => {
    expect(actionButton).not.toMatch(/var\(--flexoki-/);
    expect(actionButton).toContain("var(--text-secondary)");
    expect(actionButton).toContain("var(--text-disabled)");
  });
});
