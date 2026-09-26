import { test, expect, type Page, type Route } from "@playwright/test";

const SUPPLIER_ID = "65a1b2c3d4e5f678901234cd";

const FULL_OPTIONAL = {
  id: SUPPLIER_ID,
  name: "Full Options Co",
  categories: ["wood_lumber", "  ", "metal_steel"],
  country: "Cameroun",
  region: "Littoral",
  city: "Douala",
  address: "Rue du Port",
  postalCode: "BP 99",
  phone: "+237600000099",
  publicEmail: "hello@full.cm",
  website: "https://full.cm",
  resources: ["Bois massif", "", "  ", "MDF"],
  accountEmail: "private@secret.cm",
};

async function mockDirectory(page: Page, body: unknown) {
  await page.route("**/api/suppliers**", async (route: Route) => {
    const request = route.request();
    const url = request.url();
    if (request.method() !== "GET") {
      await route.continue();
      return;
    }
    if (url.includes("/magic-link/")) {
      await route.continue();
      return;
    }
    if (/\/api\/suppliers\/[^/?]+/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(Array.isArray(body) ? body : [body]),
    });
  });
}

test.describe("Optional supplier field handling", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "fr");
    });
  });

  test("renders all optional fields when available", async ({ page }) => {
    await mockDirectory(page, FULL_OPTIONAL);

    await page.goto("/fournisseurs");
    await expect(page.getByTestId("supplier-card-location")).toContainText(
      "Douala, Cameroun"
    );
    await expect(page.getByTestId("supplier-card-resources")).toContainText(
      "Bois massif"
    );
    await expect(page.getByTestId("supplier-card-resources")).toContainText("MDF");
    await expect(page.getByTestId("supplier-card")).not.toContainText("undefined");
    await expect(page.getByTestId("supplier-card")).not.toContainText("null");

    await page.goto(`/fournisseurs/${SUPPLIER_ID}`);
    await expect(page.getByTestId("supplier-profile-location")).toContainText(
      "Littoral"
    );
    await expect(page.getByTestId("supplier-profile-location")).toContainText(
      "Rue du Port"
    );
    await expect(page.getByTestId("supplier-profile-location")).toContainText(
      "BP 99"
    );
    await expect(page.getByTestId("contact-supplier-email")).toBeVisible();
    await expect(page.getByTestId("contact-supplier-website")).toBeVisible();
  });

  test("hides one missing optional field without empty labels", async ({
    page,
  }) => {
    await mockDirectory(page, {
      ...FULL_OPTIONAL,
      website: undefined,
    });

    await page.goto(`/fournisseurs/${SUPPLIER_ID}`);
    await expect(page.getByTestId("contact-supplier-email")).toBeVisible();
    await expect(page.getByTestId("contact-supplier-website")).toHaveCount(0);
    await expect(page.getByTestId("supplier-profile-page")).not.toContainText(
      "undefined"
    );
  });

  test("hides several missing optional fields", async ({ page }) => {
    await mockDirectory(page, {
      id: SUPPLIER_ID,
      name: "Sparse Co",
      categories: ["metal_steel"],
      country: "Cameroun",
      city: "Yaoundé",
      phone: "+237611111111",
      region: null,
      address: null,
      postalCode: null,
      publicEmail: null,
      website: null,
      resources: null,
      accountEmail: "hidden@private.cm",
    });

    await page.goto(`/fournisseurs/${SUPPLIER_ID}`);

    await expect(page.getByTestId("supplier-profile-location")).toContainText(
      "Yaoundé, Cameroun"
    );
    await expect(page.getByTestId("supplier-profile-location")).not.toContainText(
      "Littoral"
    );
    await expect(page.getByTestId("contact-supplier-email")).toHaveCount(0);
    await expect(page.getByTestId("contact-supplier-website")).toHaveCount(0);
    await expect(page.getByTestId("supplier-profile-categories")).toHaveCount(0);
    await expect(page.getByTestId("supplier-profile-page")).not.toContainText(
      "Produits :"
    );
  });

  test("treats empty strings and whitespace-only values as missing", async ({
    page,
  }) => {
    await mockDirectory(page, {
      id: SUPPLIER_ID,
      name: "Blank Optional Co",
      categories: ["wood_lumber", "   ", ""],
      country: "Cameroun",
      city: "  ",
      region: "   ",
      address: "",
      postalCode: " \t ",
      phone: "+237622222222",
      publicEmail: "   ",
      website: "",
      resources: ["", "   "],
    });

    await page.goto("/fournisseurs");
    const card = page.getByTestId("supplier-card");
    await expect(card).toBeVisible();
    await expect(page.getByTestId("supplier-card-location")).toContainText(
      "Cameroun"
    );
    await expect(page.getByTestId("supplier-card-location")).not.toContainText(
      ", ,"
    );
    await expect(page.getByTestId("supplier-card-resources")).toHaveCount(0);
    await expect(card).not.toContainText("Produits :");

    await page.goto(`/fournisseurs/${SUPPLIER_ID}`);
    await expect(page.getByTestId("supplier-profile-location")).toContainText(
      "Cameroun"
    );
    await expect(page.getByTestId("contact-supplier-email")).toHaveCount(0);
    await expect(page.getByTestId("contact-supplier-website")).toHaveCount(0);
    await expect(page.getByTestId("supplier-profile-page")).not.toContainText(
      "undefined"
    );
    await expect(page.getByTestId("supplier-profile-page")).not.toContainText(
      "null"
    );
  });

  test("treats empty arrays as missing and never uses accountEmail", async ({
    page,
  }) => {
    await mockDirectory(page, {
      id: SUPPLIER_ID,
      name: "No Public Email Co",
      categories: [],
      country: "Cameroun",
      city: "Douala",
      phone: "+237633333333",
      publicEmail: "",
      website: "",
      resources: [],
      accountEmail: "fallback-should-never-show@private.cm",
    });

    await page.goto(`/fournisseurs/${SUPPLIER_ID}`);

    await expect(page.getByTestId("supplier-profile-primary-category")).toHaveCount(
      0
    );
    await expect(page.getByTestId("contact-supplier-email")).toHaveCount(0);
    await expect(page.getByTestId("contact-supplier-phone")).toBeVisible();

    const html = await page.content();
    expect(html).not.toContain("fallback-should-never-show@private.cm");
    expect(html).not.toContain("mailto:fallback-should-never-show@private.cm");
  });
});
