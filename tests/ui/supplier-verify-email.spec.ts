import { test, expect, type Page, type Route } from "@playwright/test";

async function mockVerify(
  page: Page,
  options: { status?: number } = {}
) {
  await page.route("**/api/suppliers/contact-email/verify", async (route: Route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    const status = options.status ?? 200;
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(
        status === 200
          ? { success: true }
          : { error: "Invalid magic link" }
      ),
    });
  });
}

test.describe("Supplier contact email verification page", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
  });

  test("shows success after a valid verification token", async ({ page }) => {
    await mockVerify(page);
    await page.goto("/supplier/verify-email?token=valid-verify-token");

    await expect(page.getByTestId("supplier-verify-email-success")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByText(/contact email has been verified/i)
    ).toBeVisible();
  });

  test("shows error for an invalid verification token", async ({ page }) => {
    await mockVerify(page, { status: 400 });
    await page.goto("/supplier/verify-email?token=bad-token");

    await expect(page.getByTestId("supplier-verify-email-error")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByText(/invalid or has expired/i)
    ).toBeVisible();
  });
});
