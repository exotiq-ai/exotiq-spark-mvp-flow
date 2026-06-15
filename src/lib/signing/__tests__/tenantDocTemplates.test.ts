import { describe, it, expect } from "vitest";
import {
  TENANT_DOC_TEMPLATES,
  fieldsForTemplate,
  resolveFieldPages,
  ESIGN_ACKNOWLEDGEMENT,
} from "../tenantDocTemplates";

describe("tenantDocTemplates", () => {
  it("ships three templates", () => {
    expect(Object.keys(TENANT_DOC_TEMPLATES).sort()).toEqual([
      "addendum",
      "custom",
      "order_form",
    ]);
  });

  it("every template has a required signature field", () => {
    for (const tpl of Object.values(TENANT_DOC_TEMPLATES)) {
      const sig = tpl.fields.find((f) => f.type === "signature");
      expect(sig, `${tpl.id} missing signature field`).toBeTruthy();
      expect(sig?.required).toBe(true);
    }
  });

  it("every template has signature + printed_name + title + date", () => {
    for (const tpl of Object.values(TENANT_DOC_TEMPLATES)) {
      const types = tpl.fields.map((f) => f.type).sort();
      expect(types).toEqual(["date", "printed_name", "signature", "title"]);
    }
  });

  it("all coordinates are normalized 0..1", () => {
    for (const tpl of Object.values(TENANT_DOC_TEMPLATES)) {
      for (const f of tpl.fields) {
        expect(f.x).toBeGreaterThanOrEqual(0);
        expect(f.x + f.width).toBeLessThanOrEqual(1);
        expect(f.y).toBeGreaterThanOrEqual(0);
        expect(f.y + f.height).toBeLessThanOrEqual(1);
      }
    }
  });

  it("resolveFieldPages replaces 'last' with pageCount - 1", () => {
    const fields = fieldsForTemplate("order_form");
    const resolved = resolveFieldPages(fields, 4);
    for (const r of resolved) {
      expect(r.resolvedPage).toBe(3);
    }
  });

  it("resolveFieldPages clamps last page to 0 for single-page docs", () => {
    const resolved = resolveFieldPages(fieldsForTemplate("custom"), 1);
    for (const r of resolved) expect(r.resolvedPage).toBe(0);
  });

  it("acknowledgement copy is ESIGN-compliant", () => {
    expect(ESIGN_ACKNOWLEDGEMENT).toMatch(/electronic signature/i);
    expect(ESIGN_ACKNOWLEDGEMENT).toMatch(/legal equivalent/i);
    expect(ESIGN_ACKNOWLEDGEMENT).toMatch(/authorized to bind/i);
  });
});
