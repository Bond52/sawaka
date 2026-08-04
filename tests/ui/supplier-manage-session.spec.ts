import { test, expect, type Page, type Route } from "@playwright/test";

const SUPPLIER_ID = "65a1b2c3d4e5f678901234ab";

const PROFILE = {
  id: SUPPLIER_ID,
  name: "BoisPlus Cameroun",
  categories: ["wood_lumber"],
  country: "Cameroun",
  city: "Douala",
  phone: "+237 699 55 44 33",
  publicEmail: "ventes@boisplus.cm",
};

async function mockSupplierApis(
  page: Page,
  options: {
    managementSessionStatus?: number;
    managementSessionBody?: Record<string, unknown>;
  } = {}
) {
  await page.route("**/api/suppliers/**", async (route: Route) => {
    const request = route.request();
    const url = request.url();
    const method = request.method();

    if (method === "GET" && url.includes("/api/suppliers/management")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...PROFILE, accountEmail: "compte@boisplus.cm" }),
      });
      return;
    }

    if (method === "GET" && url.includes(`/api/suppliers/${SUPPLIER_ID}`)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PROFILE),
      });
      return;
    }

    if (method === "POST" && url.includes("/management-link")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    if (method === "POST" && url.includes("/management-session")) {
      const status = options.managementSessionStatus ?? 200;
      const body =
        options.managementSessionBody ??
        (status === 200
          ? {
              token: "mgmt-session-jwt",
              supplierId: SUPPLIER_ID,
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            }
          : { error: "Invalid magic link" });
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
      return;
    }

    await route.continue();
  });
}

test.describe("Supplier management access & session", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
  });

  test("profile Edit supplier entry requests a management link", async ({
    page,
  }) => {
    await mockSupplierApis(page);
    await page.goto(`/fournisseurs/${SUPPLIER_ID}`);

    await expect(page.getByTestId("supplier-edit-entry")).toBeVisible();
    await page.getByTestId("supplier-edit-open").click();
    await expect(page.getByTestId("supplier-manage-request-dialog")).toBeVisible();

    await page.getByTestId("supplier-manage-email").fill("owner@example.com");
    await page.getByTestId("supplier-manage-request-submit").click();

    await expect(page.getByTestId("supplier-manage-request-sent")).toBeVisible();
    await expect(page.getByText(/If the email matches/i)).toBeVisible();
  });

  test("manage page establishes a session from a valid token", async ({
    page,
  }) => {
    await mockSupplierApis(page);
    await page.goto("/supplier/manage?token=valid-raw-token");

    await expect(page.getByTestId("manage-supplier-form")).toBeVisible({
      timeout: 10000,
    });
    const stored = await page.evaluate(() =>
      window.localStorage.getItem("supplierManagementJwt")
    );
    expect(stored).toBe("mgmt-session-jwt");
  });

  test("manage page shows error for an invalid token", async ({ page }) => {
    await mockSupplierApis(page, { managementSessionStatus: 400 });
    await page.goto("/supplier/manage?token=bad-token");

    await expect(page.getByTestId("supplier-manage-error")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByText(/invalid or has expired/i)
    ).toBeVisible();
  });
});
