import { expect, test } from "@playwright/test";

const LS_KEY = "exotiq.cookie_consent.v2";

test.describe("S-1 cookie consent banner", () => {
  test("reject all persists necessary-only categories and suppresses the banner", async ({ page }) => {
    await page.goto("/");
    await page.evaluate((key) => window.localStorage.removeItem(key), LS_KEY);
    await page.reload();

    await expect(page.getByTestId("cookie-consent-banner")).toBeVisible();
    await page.getByTestId("cookie-reject-all").click();

    await expect(page.getByTestId("cookie-consent-banner")).toBeHidden();

    const stored = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, LS_KEY);

    expect(stored).toMatchObject({
      version: "2026-06-14",
      categories: {
        necessary: true,
        functional: false,
        analytics: false,
        marketing: false,
      },
    });
    expect(typeof stored.decided_at).toBe("string");

    await page.reload();
    await expect(page.getByTestId("cookie-consent-banner")).toBeHidden();
  });

  test("customize allows analytics opt-in and persists categories", async ({ page }) => {
    await page.goto("/");
    await page.evaluate((key) => window.localStorage.removeItem(key), LS_KEY);
    await page.reload();

    await expect(page.getByTestId("cookie-consent-banner")).toBeVisible();
    await page.getByTestId("cookie-customize").click();
    await page.getByTestId("cookie-analytics-toggle").click();
    await page.getByTestId("cookie-save-preferences").click();

    const stored = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, LS_KEY);

    expect(stored).toMatchObject({
      version: "2026-06-14",
      categories: {
        necessary: true,
        functional: false,
        analytics: true,
        marketing: false,
      },
    });
  });
});
