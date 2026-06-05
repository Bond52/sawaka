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

  test("marketplace page loads with supplier CTA visible", async ({ page }) => {
    await page.goto("/produits");

    await expect(page.getByTestId("marketplace-supplier-cta")).toBeVisible();
    await expect(page.getByTestId("marketplace-supplier-cta-link")).toBeVisible();
  });

  test("clicking CTA redirects to supplier onboarding", async ({ page }) => {
    await page.goto("/produits");
    await page.getByTestId("marketplace-supplier-cta-link").click();

    await expect(page).toHaveURL(/\/add-supplier$/);
    await expect(page.getByTestId("add-supplier-page-title")).toBeVisible();
  });

  test("English language displays English CTA", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("sawaka-locale", "en");
    });
    await page.goto("/produits");

    await expect(page.getByTestId("marketplace-supplier-cta-link")).toHaveText(
      "Become a Supplier"
    );
  });

  test("French language displays French CTA", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("sawaka-locale", "fr");
    });
    await page.goto("/produits");

    await expect(page.getByTestId("marketplace-supplier-cta-link")).toHaveText(
      "Devenir fournisseur"
    );
  });
});
