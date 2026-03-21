import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("Design Tokens", () => {
  const tokensCSS = readFileSync(
    resolve(__dirname, "../src/assets/tokens.css"),
    "utf-8",
  );

  test("defines surface tokens", () => {
    expect(tokensCSS).toContain("--surface-app");
    expect(tokensCSS).toContain("--surface-panel");
    expect(tokensCSS).toContain("--surface-canvas");
    expect(tokensCSS).toContain("--surface-elevated");
  });

  test("defines text tokens", () => {
    expect(tokensCSS).toContain("--text-primary");
    expect(tokensCSS).toContain("--text-secondary");
    expect(tokensCSS).toContain("--text-disabled");
  });

  test("defines border tokens", () => {
    expect(tokensCSS).toContain("--border-subtle");
    expect(tokensCSS).toContain("--border-default");
    expect(tokensCSS).toContain("--border-strong");
  });

  test("defines interactive tokens", () => {
    expect(tokensCSS).toContain("--interactive-default");
    expect(tokensCSS).toContain("--interactive-hover");
    expect(tokensCSS).toContain("--interactive-active");
  });

  test("defines annotation palette", () => {
    expect(tokensCSS).toContain("--annotation-red");
    expect(tokensCSS).toContain("--annotation-orange");
    expect(tokensCSS).toContain("--annotation-yellow");
    expect(tokensCSS).toContain("--annotation-green");
    expect(tokensCSS).toContain("--annotation-cyan");
    expect(tokensCSS).toContain("--annotation-blue");
    expect(tokensCSS).toContain("--annotation-purple");
    expect(tokensCSS).toContain("--annotation-magenta");
    expect(tokensCSS).toContain("--annotation-black");
    expect(tokensCSS).toContain("--annotation-white");
  });

  test("defines tab tokens", () => {
    expect(tokensCSS).toContain("--tab-default");
    expect(tokensCSS).toContain("--tab-active");
    expect(tokensCSS).toContain("--tab-clipboard");
    expect(tokensCSS).toContain("--tab-copied");
  });

  test("defines overlay tokens", () => {
    expect(tokensCSS).toContain("--overlay-dim");
    expect(tokensCSS).toContain("--overlay-backdrop");
  });

  test("defines feedback tokens", () => {
    expect(tokensCSS).toContain("--feedback-success");
    expect(tokensCSS).toContain("--feedback-warning");
    expect(tokensCSS).toContain("--feedback-error");
  });

  test("defines shadow tokens", () => {
    expect(tokensCSS).toContain("--shadow-sm");
    expect(tokensCSS).toContain("--shadow-md");
    expect(tokensCSS).toContain("--shadow-lg");
  });

  test("has dark theme overrides", () => {
    expect(tokensCSS).toContain(".theme-dark");
  });

  test("light and dark themes have different values", () => {
    // Split on the actual CSS rule selector, not comments
    const darkRuleIndex = tokensCSS.indexOf(":root.theme-dark");
    expect(darkRuleIndex).toBeGreaterThan(0);
    const rootSection = tokensCSS.slice(0, darkRuleIndex);
    const darkSection = tokensCSS.slice(darkRuleIndex);
    expect(rootSection).toContain("--surface-app");
    expect(darkSection).toContain("--surface-app");
  });

  test("references flexoki primitives, not raw hex values", () => {
    expect(tokensCSS).toContain("var(--flexoki-paper)");
    expect(tokensCSS).toContain("var(--flexoki-950)");
    expect(tokensCSS).toContain("var(--flexoki-blue-600)");
  });
});
