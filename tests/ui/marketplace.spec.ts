import { test, expect } from "@playwright/test";

test.describe("/produits marketplace", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/seller/public", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
  });

  test("marketplace page does not show supplier CTA", async ({ page }) => {
    await page.goto("/produits");

    await expect(page.getByTestId("marketplace-supplier-cta")).toHaveCount(0);
    await expect(page.getByTestId("marketplace-supplier-cta-link")).toHaveCount(
      0
    );
    await expect(page.getByTestId("supplier-directory-cta")).toHaveCount(0);
  });
});
