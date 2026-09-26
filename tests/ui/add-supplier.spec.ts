import { test, expect } from "@playwright/test";

test.describe("/add-supplier", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/add-supplier");
  });

  test("loads supplier form page", async ({ page }) => {
    await expect(page.getByTestId("add-supplier-page-title")).toBeVisible();
    await expect(page.getByTestId("add-supplier-page-subtitle")).toBeVisible();
    await expect(page.getByTestId("supplier-form")).toBeVisible();
    await expect(page.getByTestId("supplier-form-title")).toBeVisible();
    await expect(page.getByTestId("supplier-input-name")).toBeVisible();
    await expect(page.getByTestId("supplier-submit")).toBeVisible();
  });

  test("submit empty form shows validation errors", async ({ page }) => {
    await page.getByTestId("supplier-submit").click();

    await expect(page.getByTestId("supplier-error-name")).toBeVisible();
    await expect(page.getByTestId("supplier-error-categories")).toBeVisible();
    await expect(page.getByTestId("supplier-error-country")).toBeVisible();
    await expect(page.getByTestId("supplier-error-account-email")).toBeVisible();
    await expect(page.getByTestId("supplier-error-phone")).toBeVisible();
  });

  test("submit without category blocks submission and shows validation error", async ({
    page,
  }) => {
    await page.getByTestId("supplier-input-name").fill("Playwright Test Supplier");
    await page.getByTestId("supplier-input-country").fill("Cameroon");
    await page
      .getByTestId("supplier-input-account-email")
      .fill("supplier@test.example");
    await page.getByTestId("supplier-input-phone").fill("+237612345678");

    await page.getByTestId("supplier-submit").click();

    await expect(page.getByTestId("supplier-error-categories")).toBeVisible();
    await expect(page.getByTestId("supplier-error-categories")).toHaveText(
      "Please select at least one category."
    );
    await expect(page.getByTestId("supplier-success")).not.toBeVisible();
  });

  test("fill required fields with one category submits and shows success message", async ({
    page,
  }) => {
    await page.route("**/api/suppliers", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.getByTestId("supplier-input-name").fill("Playwright Test Supplier");
    await page.getByTestId("supplier-input-country").fill("Cameroon");
    await page
      .getByTestId("supplier-input-account-email")
      .fill("supplier@test.example");
    await page.getByTestId("supplier-input-phone").fill("+237612345678");
    await page.getByTestId("supplier-category-construction_materials").click();

    await page.getByTestId("supplier-submit").click();

    await expect(page.getByTestId("supplier-success")).toBeVisible();
  });

  test("fill required fields with multiple categories submits and shows success message", async ({
    page,
  }) => {
    await page.route("**/api/suppliers", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.getByTestId("supplier-input-name").fill("Playwright Test Supplier");
    await page.getByTestId("supplier-input-country").fill("Cameroon");
    await page
      .getByTestId("supplier-input-account-email")
      .fill("supplier@test.example");
    await page.getByTestId("supplier-input-phone").fill("+237612345678");
    await page.getByTestId("supplier-category-construction_materials").click();
    await page.getByTestId("supplier-category-wood_lumber").click();

    await page.getByTestId("supplier-submit").click();

    await expect(page.getByTestId("supplier-success")).toBeVisible();
  });
});
