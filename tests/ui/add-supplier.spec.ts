import { test, expect } from "@playwright/test";

const SUCCESS =
  "Supplier profile created. Please check your email to complete activation.";

test.describe("/add-supplier", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/add-supplier");
  });

  test("loads supplier form page", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Ajouter un fournisseur/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Create Your Supplier Profile/i })
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: /Supplier Name/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Créer le profil fournisseur/i })
    ).toBeVisible();
  });

  test("submit empty form shows validation errors", async ({ page }) => {
    await page
      .getByRole("button", { name: /Créer le profil fournisseur/i })
      .click();

    await expect(
      page.getByText(/Indiquez le nom du fournisseur \(champ obligatoire\)\./)
    ).toBeVisible();
    await expect(
      page.getByText(/Indiquez le pays \(champ obligatoire\)\./)
    ).toBeVisible();
    await expect(
      page.getByText(/Indiquez l['’]e-mail du compte \(champ obligatoire\)\./)
    ).toBeVisible();
    await expect(
      page.getByText(
        /Indiquez un numéro de téléphone \(champ obligatoire\)\./
      )
    ).toBeVisible();
  });

  test("fill required fields submits and shows success message", async ({
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

    await page.getByLabel(/Supplier Name/i).fill("Playwright Test Supplier");
    await page.getByLabel(/^Country/i).fill("Cameroon");
    await page.getByLabel(/Email for account access/i).fill("supplier@test.example");
    await page.getByLabel(/^Phone number/i).fill("+237612345678");

    await page
      .getByRole("button", { name: /Créer le profil fournisseur/i })
      .click();

    await expect(page.getByRole("status")).toContainText(SUCCESS);
  });
});
