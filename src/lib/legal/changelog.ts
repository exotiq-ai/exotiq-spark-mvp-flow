// Human-readable change summaries surfaced in the re-acceptance gate.
// Keyed by document version. Keep each entry to one short sentence — this
// satisfies CCPA/CPRA "material change" notice without overwhelming users.

import type { LegalDocType } from "./versions";

export const VERSION_CHANGELOG: Record<string, Partial<Record<LegalDocType, string>>> = {
  "2026-06-14": {
    terms:
      "Clarified rental responsibilities, liability limits, and dispute-resolution wording.",
    privacy:
      "Expanded data-rights section (GDPR/CCPA), clarified retention periods and sub-processor list.",
    aup:
      "Tightened prohibitions on automated scraping and reverse engineering.",
    dpa:
      "Updated sub-processor list and incident-response timelines.",
    sms:
      "Refined STOP/HELP instructions and message-frequency disclosure.",
    cookies:
      "First publication: documents the strictly-necessary cookies Exotiq uses.",
    dmca:
      "Updated designated agent contact and counter-notice procedure.",
  },
};

export function getChangeSummary(
  docType: LegalDocType,
  version: string
): string | null {
  return VERSION_CHANGELOG[version]?.[docType] ?? null;
}
