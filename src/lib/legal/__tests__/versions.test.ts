import { describe, it, expect } from "vitest";
import {
  requiredDocsForJurisdiction,
  consentStatementForJurisdiction,
  LEGAL_DOCS,
  REQUIRED_AT_SIGNUP,
} from "../versions";

describe("requiredDocsForJurisdiction", () => {
  it("returns base docs for US / unset jurisdictions", () => {
    expect(requiredDocsForJurisdiction("US")).toEqual(REQUIRED_AT_SIGNUP);
    expect(requiredDocsForJurisdiction(null)).toEqual(REQUIRED_AT_SIGNUP);
    expect(requiredDocsForJurisdiction(undefined)).toEqual(REQUIRED_AT_SIGNUP);
  });

  it("adds DPA + Transfer Addendum for EU teams", () => {
    const docs = requiredDocsForJurisdiction("EU");
    expect(docs).toContain("dpa");
    expect(docs).toContain("transfer_addendum");
    expect(docs).toContain("terms");
  });

  it("adds DPA + Transfer Addendum for UK teams", () => {
    const docs = requiredDocsForJurisdiction("UK");
    expect(docs).toContain("dpa");
    expect(docs).toContain("transfer_addendum");
  });

  it("does NOT add DPA/addendum for UAE teams (handled by separate UAE flow)", () => {
    const docs = requiredDocsForJurisdiction("UAE");
    expect(docs).not.toContain("transfer_addendum");
  });
});

describe("consentStatementForJurisdiction", () => {
  it("mentions DPA + Addendum for EU/UK", () => {
    expect(consentStatementForJurisdiction("EU")).toMatch(/Data Processing Agreement/);
    expect(consentStatementForJurisdiction("EU")).toMatch(/Transfer Addendum/);
    expect(consentStatementForJurisdiction("UK")).toMatch(/Transfer Addendum/);
  });

  it("omits DPA/Addendum for US/other", () => {
    expect(consentStatementForJurisdiction("US")).not.toMatch(/Transfer Addendum/);
  });
});

describe("LEGAL_DOCS catalog", () => {
  it("registers transfer_addendum with a /transfer-addendum url", () => {
    expect(LEGAL_DOCS.transfer_addendum.url).toBe("/transfer-addendum");
    expect(LEGAL_DOCS.transfer_addendum.version).toBe("2026-06-14");
  });
});
