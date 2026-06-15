import { describe, it, expect } from "vitest";
import {
  parseCounselHtml,
  injectEuUkRepresentatives,
} from "../counselHtml";

const SAMPLE = `<!DOCTYPE html><html><body>
<div class="legal-page">
  <div class="legal-header">
    <h1>Sample Notice</h1>
    <div class="subtitle">A sample subtitle</div>
  </div>
  <div class="legal-meta">
    <span>Effective Date: January 1, 2026</span>
    <span>Last Updated: June 14, 2026</span>
  </div>
  <div class="legal-body">
    <p>Intro.</p>
    <h2>Article I: Controller and Roles</h2>
    <p>Exotiq will appoint and identify a representative in the EU and in the UK. <em>[Representative details to be inserted upon appointment.]</em></p>
    <h2>Article II: Other</h2>
    <p>Body.</p>
  </div>
  <div class="legal-footer">&copy; 2026 Exotiq Inc.</div>
</div>
</body></html>`;

describe("parseCounselHtml", () => {
  it("extracts title, subtitle, dates and body", () => {
    const d = parseCounselHtml(SAMPLE);
    expect(d.title).toBe("Sample Notice");
    expect(d.subtitle).toBe("A sample subtitle");
    expect(d.effectiveDate).toBe("January 1, 2026");
    expect(d.lastUpdated).toBe("June 14, 2026");
    expect(d.bodyHtml).toContain("<h2>Article I: Controller and Roles</h2>");
    expect(d.bodyHtml).toContain("<h2>Article II: Other</h2>");
    expect(d.bodyHtml).not.toContain("legal-footer");
  });

  it("throws when structure is missing", () => {
    expect(() => parseCounselHtml("<html><body>nope</body></html>")).toThrow();
  });
});

describe("injectEuUkRepresentatives", () => {
  const body = parseCounselHtml(SAMPLE).bodyHtml;

  it("leaves placeholder untouched when no rep is set", () => {
    const out = injectEuUkRepresentatives(body, {});
    expect(out).toContain("[Representative details to be inserted upon appointment.]");
  });

  it("injects EU + UK rep blocks in place of the placeholder", () => {
    const out = injectEuUkRepresentatives(body, {
      euName: "Acme EU Rep BV",
      euAddress: "Herengracht 1, Amsterdam",
      euEmail: "eu@example.com",
      ukName: "Acme UK Rep Ltd",
      ukAddress: "10 Downing St, London",
      ukEmail: "uk@example.com",
    });
    expect(out).not.toContain("[Representative details to be inserted");
    expect(out).toContain("EU representative (GDPR Article 27)");
    expect(out).toContain("Acme EU Rep BV");
    expect(out).toContain("Herengracht 1, Amsterdam");
    expect(out).toContain('mailto:eu%40example.com');
    expect(out).toContain("UK representative (UK GDPR Article 27)");
    expect(out).toContain("Acme UK Rep Ltd");
  });

  it("escapes HTML in operator-supplied values", () => {
    const out = injectEuUkRepresentatives(body, {
      euName: "<script>alert(1)</script>",
    });
    expect(out).not.toContain("<script>alert(1)</script>");
    expect(out).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});
