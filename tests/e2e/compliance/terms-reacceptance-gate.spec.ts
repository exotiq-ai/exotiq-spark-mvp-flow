import { expect, test } from "@playwright/test";

const email = process.env.E2E_OWNER_EMAIL;
const password = process.env.E2E_OWNER_PASSWORD;

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/auth");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("S-5 transfer addendum acceptance gate", () => {
  test("EU demo owner sees the 5-document gate", async ({ page }) => {
    test.skip(
      !email || !password || process.env.E2E_EXPECT_JURISDICTION !== "EU",
      "Requires E2E_OWNER_EMAIL/E2E_OWNER_PASSWORD and a demo team pre-set to EU by Lovable."
    );

    await signIn(page);

    await expect(page.getByTestId("terms-reacceptance-gate")).toBeVisible();
    await expect(page.getByTestId("terms-gate-doc-terms")).toBeVisible();
    await expect(page.getByTestId("terms-gate-doc-privacy")).toBeVisible();
    await expect(page.getByTestId("terms-gate-doc-aup")).toBeVisible();
    await expect(page.getByTestId("terms-gate-doc-dpa")).toBeVisible();
    await expect(page.getByTestId("terms-gate-doc-transfer_addendum")).toBeVisible();
  });

  test("US demo owner sees only the 3 base documents", async ({ page }) => {
    test.skip(
      !email || !password || process.env.E2E_EXPECT_JURISDICTION !== "US",
      "Requires E2E_OWNER_EMAIL/E2E_OWNER_PASSWORD and a demo team pre-set to US by Lovable."
    );

    await signIn(page);

    await expect(page.getByTestId("terms-reacceptance-gate")).toBeVisible();
    await expect(page.getByTestId("terms-gate-doc-terms")).toBeVisible();
    await expect(page.getByTestId("terms-gate-doc-privacy")).toBeVisible();
    await expect(page.getByTestId("terms-gate-doc-aup")).toBeVisible();
    await expect(page.getByTestId("terms-gate-doc-dpa")).toBeHidden();
    await expect(page.getByTestId("terms-gate-doc-transfer_addendum")).toBeHidden();
  });
});
