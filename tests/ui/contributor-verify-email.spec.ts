import { test, expect, type Page, type Route } from "@playwright/test";

async function mockVerify(page: Page, body: unknown, status = 200) {
  await page.route("**/api/contributors/email-verification", async (route: Route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

test.describe("Contributor account email verification page", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
  });

  test("shows activation success after a valid token", async ({ page }) => {
    await mockVerify(page, { emailVerified: true, profileActivated: true });
    await page.goto("/contributor/verify-email?token=valid-user-token");
    await expect(page.getByTestId("contributor-verify-email-success")).toBeVisible();
  });

  test("shows a non-public state when the profile is not eligible", async ({ page }) => {
    await mockVerify(page, { emailVerified: true, profileActivated: false });
    await page.goto("/contributor/verify-email?token=valid-user-token");
    await expect(page.getByTestId("contributor-verify-email-not-public")).toBeVisible();
  });

  test("shows an error for an invalid token", async ({ page }) => {
    await mockVerify(page, { error: { code: "TOKEN_INVALID" } }, 400);
    await page.goto("/contributor/verify-email?token=bad-token");
    await expect(page.getByTestId("contributor-verify-email-error")).toBeVisible();
  });
});
