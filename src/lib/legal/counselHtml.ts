// Loads counsel-drafted legal source HTML (docs/compliance/legal-source/*.html)
// at build time via Vite's ?raw import and extracts the inner <div class="legal-body">.
//
// We render the result via dangerouslySetInnerHTML inside LegalPageLayout. This
// is safe: the HTML ships from our own repo, not user input. Rendering directly
// from the counsel source guarantees the published page cannot drift from what
// was reviewed by counsel (enforced by Playwright heading-parity tests + the
// vitest case below).

export interface CounselDoc {
  title: string;
  subtitle: string;
  effectiveDate: string;
  lastUpdated: string;
  bodyHtml: string;
}

const BODY_OPEN = '<div class="legal-body">';
const BODY_CLOSE = "</div>";

function between(src: string, start: string, end: string): string | null {
  const i = src.indexOf(start);
  if (i === -1) return null;
  const j = src.indexOf(end, i + start.length);
  if (j === -1) return null;
  return src.slice(i + start.length, j).trim();
}

function extractMeta(html: string, label: string): string {
  // Matches <span>Effective Date: January 1, 2026</span>
  const re = new RegExp(`<span>\\s*${label}:\\s*([^<]+?)\\s*</span>`, "i");
  const m = html.match(re);
  return m ? m[1].trim() : "";
}

function extractBetween(html: string, open: string, close: string): string {
  const v = between(html, open, close);
  return v ?? "";
}

/**
 * Parse a counsel HTML document (string from `?raw` import) into the parts we
 * render. Throws if the document is missing the canonical structure so a
 * malformed source fails fast at build/test time rather than silently
 * rendering an empty page.
 */
export function parseCounselHtml(raw: string): CounselDoc {
  const title = extractBetween(raw, "<h1>", "</h1>");
  const subtitle = extractBetween(raw, '<div class="subtitle">', "</div>");
  const effectiveDate = extractMeta(raw, "Effective Date");
  const lastUpdated = extractMeta(raw, "Last Updated");

  // The legal-body div is the last block before </div><div class="legal-footer">.
  // We deliberately slice from BODY_OPEN to the legal-footer marker so nested
  // </div> tags inside the body don't terminate extraction early.
  const start = raw.indexOf(BODY_OPEN);
  const footerIdx = raw.indexOf('<div class="legal-footer">');
  if (start === -1 || footerIdx === -1 || footerIdx <= start) {
    throw new Error("Counsel HTML missing legal-body/legal-footer markers");
  }
  // Slice between BODY_OPEN end and the closing </div> immediately before the footer.
  const inner = raw.slice(start + BODY_OPEN.length, footerIdx);
  const bodyHtml = inner.replace(/<\/div>\s*$/, "").trim();

  if (!title || !bodyHtml) {
    throw new Error("Counsel HTML missing title or body");
  }
  return { title, subtitle, effectiveDate, lastUpdated, bodyHtml };
}

/**
 * Inject a real EU / UK Article 27 representative block in place of the
 * counsel placeholder "[Representative details to be inserted upon appointment.]"
 * when the operator has saved one. Falls through untouched when no rep is set,
 * so the published page still reads as the counsel-drafted notice.
 */
export interface RepInjection {
  euName?: string | null;
  euAddress?: string | null;
  euEmail?: string | null;
  ukName?: string | null;
  ukAddress?: string | null;
  ukEmail?: string | null;
}

function repLine(label: string, name?: string | null, address?: string | null, email?: string | null): string {
  if (!name) return "";
  const parts = [escapeHtml(name)];
  if (address) parts.push(escapeHtml(address));
  if (email) parts.push(`<a href="mailto:${encodeURIComponent(email)}">${escapeHtml(email)}</a>`);
  return `<p><strong>${label}:</strong> ${parts.join(", ")}.</p>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function injectEuUkRepresentatives(bodyHtml: string, rep: RepInjection): string {
  const hasAny = rep.euName || rep.ukName;
  if (!hasAny) return bodyHtml;

  const block =
    repLine("EU representative (GDPR Article 27)", rep.euName, rep.euAddress, rep.euEmail) +
    repLine("UK representative (UK GDPR Article 27)", rep.ukName, rep.ukAddress, rep.ukEmail);

  // Replace the counsel placeholder sentence (with or without surrounding <em>).
  const placeholderRe =
    /<em>\[Representative details to be inserted upon appointment\.\]<\/em>/i;
  if (placeholderRe.test(bodyHtml)) {
    return bodyHtml.replace(placeholderRe, block);
  }
  // Fallback: append to the end of the Article I paragraph mentioning Article 27.
  return bodyHtml.replace(
    /(Article 27[^<]*?will appoint and identify a representative in the EU and in the UK\.)/i,
    `$1 ${block}`,
  );
}
