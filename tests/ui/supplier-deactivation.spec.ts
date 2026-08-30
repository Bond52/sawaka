import { test, expect, type Page, type Route } from "@playwright/test";

const SUPPLIER_ID = "65a1b2c3d4e5f678901234ab";
const MANAGEMENT_JWT = "mgmt-session-jwt";

const EDITABLE_SUPPLIER = {
  id: SUPPLIER_ID,
  name: "BoisPlus Cameroun",
  categories: ["wood_lumber"],
  country: "Cameroun",
  city: "Douala",
  accountEmail: "compte@boisplus.cm",
  phone: "+237 699 55 44 33",
};

async function mockApis(page: Page) {
  await page.route("**/api/suppliers/**", async (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes("/api/suppliers/management/deactivate") && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          supplierId: SUPPLIER_ID,
          name: EDITABLE_SUPPLIER.name,
        }),
      });
      return;
    }

    if (url.includes("/api/suppliers/management") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(EDITABLE_SUPPLIER),
      });
      return;
    }

    if (method === "GET" && url.includes("/api/suppliers?")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
      return;
    }

    await route.continue();
  });
}

test.describe("Supplier deactivation", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((jwt) => {
      window.localStorage.setItem("sawaka-locale", "en");
      window.localStorage.setItem("supplierManagementJwt", jwt);
    }, MANAGEMENT_JWT);
  });

  test("shows confirmation dialog and cancels without deactivating", async ({
    page,
  }) => {
    await mockApis(page);
    await page.goto("/supplier/manage");

    await expect(page.getByTestId("manage-supplier-danger-zone")).toBeVisible({
      timeout: 10000,
    });
    await page.getByTestId("manage-supplier-deactivate-open").click();
    await expect(
      page.getByTestId("manage-supplier-deactivate-dialog")
    ).toBeVisible();
    await expect(page.getByText(/BoisPlus Cameroun/i)).toBeVisible();

    await page.getByTestId("manage-supplier-deactivate-cancel").click();
    await expect(
      page.getByTestId("manage-supplier-deactivate-dialog")
    ).toHaveCount(0);
    await expect(page.getByTestId("manage-supplier-form")).toBeVisible();
  });

  test("confirms deactivation and leaves the management page", async ({
    page,
  }) => {
    await mockApis(page);
    await page.goto("/supplier/manage");

    await page.getByTestId("manage-supplier-deactivate-open").click();
    await page.getByTestId("manage-supplier-deactivate-confirm").click();

    await expect(page).toHaveURL(/\/fournisseurs/, { timeout: 10000 });
    const stored = await page.evaluate(() =>
      window.localStorage.getItem("supplierManagementJwt")
    );
    expect(stored).toBeNull();
  });
});
