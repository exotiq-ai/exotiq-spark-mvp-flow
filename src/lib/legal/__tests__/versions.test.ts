import { describe, it, expect } from "vitest";
import {
  requiredDocsForJurisdiction,
  consentStatementForJurisdiction,
  LEGAL_DOCS,
  REQUIRED_AT_SIGNUP,
  buildDocumentsPayload,
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

  it("requires exactly 5 documents for EU teams", () => {
    expect(requiredDocsForJurisdiction("EU")).toHaveLength(5);
  });

  it("requires exactly 5 documents for UK teams", () => {
    expect(requiredDocsForJurisdiction("UK")).toHaveLength(5);
  });

  it("requires exactly 3 documents for US teams", () => {
    expect(requiredDocsForJurisdiction("US")).toHaveLength(3);
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

  it("keeps EU and UK consent statements in parity", () => {
    expect(consentStatementForJurisdiction("UK")).toBe(
      consentStatementForJurisdiction("EU")
    );
  });
});

describe("LEGAL_DOCS catalog", () => {
  it("registers transfer_addendum with a /transfer-addendum url", () => {
    expect(LEGAL_DOCS.transfer_addendum.url).toBe("/transfer-addendum");
    expect(LEGAL_DOCS.transfer_addendum.version).toBe("2026-06-14");
  });

  it("provides a lastUpdated date for every document", () => {
    for (const t of Object.keys(LEGAL_DOCS) as Array<keyof typeof LEGAL_DOCS>) {
      expect(LEGAL_DOCS[t].lastUpdated, `${t} missing lastUpdated`).toBeTruthy();
    }
  });

  it("preserves the original January 1, 2026 publication for the seven core docs", () => {
    const core = ["terms", "privacy", "aup", "dpa", "sms", "cookies", "dmca"] as const;
    for (const t of core) {
      const prior = LEGAL_DOCS[t].priorVersions;
      expect(prior, `${t} missing priorVersions`).toBeDefined();
      expect(prior?.some((p) => p.version === "2026-01-01")).toBe(true);
    }
  });

  it("uses the June 14, 2026 effective date for the current core revisions", () => {
    const core = ["terms", "privacy", "aup", "dpa", "sms", "cookies", "dmca"] as const;
    for (const t of core) {
      expect(LEGAL_DOCS[t].effectiveDate).toBe("June 14, 2026");
    }
  });
});

describe("buildDocumentsPayload", () => {
  it("produces the expected payload shape for EU teams", () => {
    const payload = buildDocumentsPayload(requiredDocsForJurisdiction("EU"));

    expect(payload).toHaveLength(5);
    expect(payload.map((d) => d.document_type)).toContain("transfer_addendum");
    payload.forEach((d) => {
      expect(d.document_type).toBeTruthy();
      expect(d.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
