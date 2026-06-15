import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

type LegalPageCase = {
  route: string;
  sourcePath: string;
};

const pages: LegalPageCase[] = [
  {
    route: "/privacy-eu",
    sourcePath: "docs/compliance/legal-source/privacy-notice-eu-uk.html",
  },
  {
    route: "/privacy-uae",
    sourcePath: "docs/compliance/legal-source/privacy-notice-uae.html",
  },
  {
    route: "/transfer-addendum",
    sourcePath: "docs/compliance/legal-source/international-transfer-addendum.html",
  },
];

function sourceHeadings(sourcePath: string): string[] {
  const html = readFileSync(path.join(process.cwd(), sourcePath), "utf8");
  return Array.from(html.matchAll(/<h[23][^>]*>(.*?)<\/h[23]>/gis)).map((m) =>
    m[1]
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

test.describe("S-6 legal pages render counsel-source headings", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "exotiq.cookie_consent.v2",
        JSON.stringify({
          version: "2026-06-14",
          decided_at: new Date().toISOString(),
          categories: {
            necessary: true,
            functional: false,
            analytics: false,
            marketing: false,
          },
        })
      );
    });
  });

  for (const legalPage of pages) {
    test(`${legalPage.route} includes every h2/h3 from ${legalPage.sourcePath}`, async ({ page }) => {
      await page.goto(legalPage.route);

      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator("body")).not.toContainText(/\[[^\]]*(to be inserted|placeholder|to be completed)[^\]]*\]/i);

      const headings = sourceHeadings(legalPage.sourcePath);
      expect(headings.length).toBeGreaterThan(0);

      for (const heading of headings) {
        await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      }
    });
  }
});
