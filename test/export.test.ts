import { describe, test, expect } from "bun:test";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

describe("Export Composable", () => {
  const exportFile = readFileSync(
    resolve(__dirname, "../src/composables/useExport.ts"),
    "utf-8",
  );

  test("exports flattenTab function", () => {
    expect(exportFile).toContain("export async function flattenTab");
  });

  test("exports copyTabToClipboard function", () => {
    expect(exportFile).toContain("export async function copyTabToClipboard");
  });

  test("uses OffscreenCanvas for flattening", () => {
    expect(exportFile).toContain("OffscreenCanvas");
  });

  test("exports as PNG", () => {
    expect(exportFile).toContain('"image/png"');
  });

  test("uses atomic export pattern (flatten before clipboard write)", () => {
    // The blob should be created BEFORE any clipboard operation
    const flattenIndex = exportFile.indexOf("convertToBlob");
    const writeIndex = exportFile.indexOf("writeClipboard");
    expect(flattenIndex).toBeGreaterThan(-1);
    expect(writeIndex).toBeGreaterThan(-1);
    expect(flattenIndex).toBeLessThan(writeIndex);
  });

  test("handles no-image case", () => {
    expect(exportFile).toContain("No image to export");
  });

  test("returns ExportResult with blob, width, and height", () => {
    expect(exportFile).toContain("export interface ExportResult");
    expect(exportFile).toContain("blob: Blob");
    expect(exportFile).toContain("width: number");
    expect(exportFile).toContain("height: number");
  });

  test("converts to RGBA for Tauri clipboard API", () => {
    expect(exportFile).toContain("getImageData");
    expect(exportFile).toContain("Uint8Array");
  });
});

describe("Toast Notification", () => {
  test("ToastNotification component exists", () => {
    expect(
      existsSync(
        resolve(__dirname, "../src/components/ToastNotification.vue"),
      ),
    ).toBe(true);
  });

  test("useToast composable exists", () => {
    expect(
      existsSync(resolve(__dirname, "../src/composables/useToast.ts")),
    ).toBe(true);
  });

  const toastFile = readFileSync(
    resolve(__dirname, "../src/composables/useToast.ts"),
    "utf-8",
  );

  test("has success and error helper functions", () => {
    expect(toastFile).toContain("function success");
    expect(toastFile).toContain("function error");
  });

  test("success toasts dismiss after 1 second", () => {
    expect(toastFile).toContain("1000");
  });

  test("error toasts dismiss after 3 seconds", () => {
    expect(toastFile).toContain("3000");
  });

  test("toast component uses semantic feedback tokens", () => {
    const component = readFileSync(
      resolve(__dirname, "../src/components/ToastNotification.vue"),
      "utf-8",
    );
    expect(component).toContain("--feedback-success");
    expect(component).toContain("--feedback-error");
    expect(component).toContain("--feedback-warning");
  });

  test("toast component does not use Flexoki primitives directly", () => {
    const component = readFileSync(
      resolve(__dirname, "../src/components/ToastNotification.vue"),
      "utf-8",
    );
    expect(component).not.toMatch(/var\(--flexoki-/);
  });

  test("toast has accessibility attributes", () => {
    const component = readFileSync(
      resolve(__dirname, "../src/components/ToastNotification.vue"),
      "utf-8",
    );
    expect(component).toContain('role="alert"');
    expect(component).toContain('aria-live="polite"');
  });

  test("toast uses dismiss emit for cleanup", () => {
    const component = readFileSync(
      resolve(__dirname, "../src/components/ToastNotification.vue"),
      "utf-8",
    );
    expect(component).toContain("dismiss");
  });
});
