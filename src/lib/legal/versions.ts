// Single source of truth for currently published legal documents.
// To bump a version: update here, then insert a new legal_document_versions
// row via migration so the edge function can resolve the new version.

export type LegalDocType = "terms" | "privacy" | "aup" | "dpa" | "sms" | "cookies" | "dmca" | "transfer_addendum";

export interface PriorVersionMeta {
  version: string;
  effectiveDate: string;
}

export interface LegalDocMeta {
  version: string;        // ISO date string identifier, e.g. "2026-06-14"
  effectiveDate: string;  // human-printable date this version takes legal force
  lastUpdated: string;    // human-printable date the text was last revised
  url: string;            // canonical in-app URL
  label: string;          // display name in consent statement
  priorVersions?: PriorVersionMeta[]; // audit lineage for prior published versions
}

// All seven core documents were materially revised on June 14, 2026
// (new EU/UK privacy notice, UAE privacy notice, International Transfer
// Addendum / SCCs / UK IDTA, refreshed sub-processor disclosures). Each
// version's effective date matches the date the revised text takes force.
// The original January 1, 2026 publication is retained in `priorVersions`
// so the admin audit history can resolve acceptances against earlier text.
const ORIGINAL_PUBLICATION: PriorVersionMeta = {
  version: "2026-01-01",
  effectiveDate: "January 1, 2026",
};

export const LEGAL_DOCS: Record<LegalDocType, LegalDocMeta> = {
  terms: {
    version: "2026-06-14",
    effectiveDate: "June 14, 2026",
    lastUpdated: "June 14, 2026",
    url: "/terms",
    label: "Terms and Conditions",
    priorVersions: [ORIGINAL_PUBLICATION],
  },
  privacy: {
    version: "2026-06-14",
    effectiveDate: "June 14, 2026",
    lastUpdated: "June 14, 2026",
    url: "/privacy",
    label: "Privacy Policy",
    priorVersions: [ORIGINAL_PUBLICATION],
  },
  aup: {
    version: "2026-06-14",
    effectiveDate: "June 14, 2026",
    lastUpdated: "June 14, 2026",
    url: "/acceptable-use",
    label: "Acceptable Use Policy",
    priorVersions: [ORIGINAL_PUBLICATION],
  },
  dpa: {
    version: "2026-06-14",
    effectiveDate: "June 14, 2026",
    lastUpdated: "June 14, 2026",
    url: "/data-processing",
    label: "Data Processing Agreement",
    priorVersions: [ORIGINAL_PUBLICATION],
  },
  sms: {
    version: "2026-06-14",
    effectiveDate: "June 14, 2026",
    lastUpdated: "June 14, 2026",
    url: "/sms",
    label: "SMS/Text Messaging Consent and Disclosure",
    priorVersions: [ORIGINAL_PUBLICATION],
  },
  cookies: {
    version: "2026-06-14",
    effectiveDate: "June 14, 2026",
    lastUpdated: "June 14, 2026",
    url: "/cookies",
    label: "Cookie Policy",
    priorVersions: [ORIGINAL_PUBLICATION],
  },
  dmca: {
    version: "2026-06-14",
    effectiveDate: "June 14, 2026",
    lastUpdated: "June 14, 2026",
    url: "/dmca",
    label: "DMCA and Copyright Policy",
    priorVersions: [ORIGINAL_PUBLICATION],
  },
  transfer_addendum: {
    version: "2026-06-14",
    effectiveDate: "June 14, 2026",
    lastUpdated: "June 14, 2026",
    url: "/transfer-addendum",
    label: "International Data Transfer Addendum (SCCs / UK IDTA)",
  },
};

// Documents required for general signup / re-acceptance. DPA is offered
// separately to enterprise customers. SMS is an optional opt-in captured
// separately at signup (not required). Cookies and DMCA are informational.
export const REQUIRED_AT_SIGNUP: LegalDocType[] = ["terms", "privacy", "aup"];

// Jurisdiction-specific documents stacked on top of REQUIRED_AT_SIGNUP.
// EU and UK teams must also accept the DPA + International Data Transfer
// Addendum (SCCs / UK IDTA) before they can proceed, since their personal
// data is transferred to processors outside the EEA/UK.
const JURISDICTION_EXTRA_DOCS: Record<string, LegalDocType[]> = {
  EU: ["dpa", "transfer_addendum"],
  UK: ["dpa", "transfer_addendum"],
};

export function requiredDocsForJurisdiction(
  jurisdiction: string | null | undefined
): LegalDocType[] {
  const extras = jurisdiction ? JURISDICTION_EXTRA_DOCS[jurisdiction] ?? [] : [];
  return [...REQUIRED_AT_SIGNUP, ...extras];
}

export const CURRENT_CONSENT_STATEMENT =
  "I have read and agree to the Exotiq Terms and Conditions, Privacy Policy, and Acceptable Use Policy. I represent that I am authorized to bind my organization to these terms.";

export const CONSENT_STATEMENT_WITH_DPA =
  "I have read and agree to the Exotiq Terms and Conditions, Privacy Policy, Acceptable Use Policy, Data Processing Agreement, and International Data Transfer Addendum (SCCs / UK IDTA). I represent that I am authorized to bind my organization to these terms.";

export function consentStatementForJurisdiction(
  jurisdiction: string | null | undefined
): string {
  return jurisdiction === "EU" || jurisdiction === "UK"
    ? CONSENT_STATEMENT_WITH_DPA
    : CURRENT_CONSENT_STATEMENT;
}

export const SMS_CONSENT_STATEMENT =
  "I consent to receive transactional text messages from Exotiq at the phone number provided (e.g., booking confirmations, reminders, account alerts). Message frequency may vary. Message and data rates may apply. Reply HELP for help or STOP to opt out.";

export function buildDocumentsPayload(types: LegalDocType[]) {
  return types.map((t) => ({
    document_type: t,
    version: LEGAL_DOCS[t].version,
  }));
}
