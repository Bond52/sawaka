import { test, expect, type Page, type Route } from "@playwright/test";

const SUPPLIER_ID = "65a1b2c3d4e5f678901234ab";

type ProfileFixture = {
  id?: string;
  name?: string;
  categories?: string[];
  country?: string;
  city?: string;
  phone?: string;
  publicEmail?: string;
  website?: string;
  accountEmail?: string;
};

async function mockSupplierProfile(page: Page, fixture: ProfileFixture) {
  const body = {
    id: SUPPLIER_ID,
    name: "BoisPlus Cameroun",
    categories: ["wood_lumber"],
    country: "Cameroun",
    city: "Douala",
    ...fixture,
  };

  await page.route("**/api/suppliers/**", async (route: Route) => {
    const request = route.request();
    if (request.method() !== "GET") {
      await route.continue();
      return;
    }
    if (request.url().includes("/magic-link/")) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

test.describe("ContactSupplier on supplier profile", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "fr");
    });
  });

  test("email only: shows accessible mailto and hides other actions", async ({
    page,
  }) => {
    await mockSupplierProfile(page, {
      publicEmail: "contact@boisplus.cm",
      phone: "",
      website: "",
    });

    await page.goto(`/fournisseurs/${SUPPLIER_ID}`);

    await expect(page.getByTestId("contact-supplier")).toBeVisible();
    const email = page.getByTestId("contact-supplier-email");
    await expect(email).toBeVisible();
    await expect(email).toHaveAttribute("href", "mailto:contact@boisplus.cm");
    await expect(email).toHaveAttribute(
      "aria-label",
      "Envoyer un e-mail à BoisPlus Cameroun"
    );
    await expect(page.getByTestId("contact-supplier-phone")).toHaveCount(0);
    await expect(page.getByTestId("contact-supplier-website")).toHaveCount(0);
    await expect(page.getByTestId("contact-supplier-unavailable")).toHaveCount(
      0
    );

    await email.focus();
    await expect(email).toBeFocused();
  });

  test("website only: shows secure external link", async ({ page }) => {
    await mockSupplierProfile(page, {
      publicEmail: "",
      phone: "",
      website: "boisplus.cm",
    });

    await page.goto(`/fournisseurs/${SUPPLIER_ID}`);

    const website = page.getByTestId("contact-supplier-website");
    await expect(website).toBeVisible();
    await expect(website).toHaveAttribute("href", "https://boisplus.cm/");
    await expect(website).toHaveAttribute("target", "_blank");
    await expect(website).toHaveAttribute("rel", "noopener noreferrer");
    await expect(page.getByTestId("contact-supplier-email")).toHaveCount(0);
    await expect(page.getByTestId("contact-supplier-phone")).toHaveCount(0);
  });

  test("phone only: shows accessible tel action", async ({ page }) => {
    await mockSupplierProfile(page, {
      publicEmail: "",
      phone: "+237 6 12 34 56 78",
      website: "",
    });

    await page.goto(`/fournisseurs/${SUPPLIER_ID}`);

    const phone = page.getByTestId("contact-supplier-phone");
    await expect(phone).toBeVisible();
    await expect(phone).toHaveAttribute("href", "tel:+237612345678");
    await expect(phone).toContainText("+237 6 12 34 56 78");
    await expect(phone).toHaveAttribute(
      "aria-label",
      "Appeler BoisPlus Cameroun"
    );
    await expect(page.getByTestId("contact-supplier-email")).toHaveCount(0);
    await expect(page.getByTestId("contact-supplier-website")).toHaveCount(0);
  });

  test("multiple contact options are all available", async ({ page }) => {
    await mockSupplierProfile(page, {
      publicEmail: "hello@boisplus.cm",
      phone: "+237699887766",
      website: "https://www.boisplus.cm/about",
    });

    await page.goto(`/fournisseurs/${SUPPLIER_ID}`);

    await expect(page.getByTestId("contact-supplier-email")).toHaveAttribute(
      "href",
      "mailto:hello@boisplus.cm"
    );
    await expect(page.getByTestId("contact-supplier-phone")).toHaveAttribute(
      "href",
      "tel:+237699887766"
    );
    await expect(page.getByTestId("contact-supplier-website")).toHaveAttribute(
      "href",
      "https://www.boisplus.cm/about"
    );
    await expect(page.getByTestId("contact-supplier-website")).toHaveAttribute(
      "rel",
      "noopener noreferrer"
    );
  });

  test("missing optional contact information shows unavailable message", async ({
    page,
  }) => {
    await mockSupplierProfile(page, {
      publicEmail: "",
      phone: "",
      website: "",
      city: "",
      country: "",
    });

    await page.goto(`/fournisseurs/${SUPPLIER_ID}`);

    await expect(page.getByTestId("contact-supplier-unavailable")).toBeVisible();
    await expect(page.getByTestId("contact-supplier-unavailable")).toHaveText(
      "Aucun moyen de contact public disponible."
    );
    await expect(page.getByTestId("contact-supplier-email")).toHaveCount(0);
    await expect(page.getByTestId("contact-supplier-phone")).toHaveCount(0);
    await expect(page.getByTestId("contact-supplier-website")).toHaveCount(0);
    await expect(page.getByTestId("contact-supplier-cta")).toHaveCount(0);
  });

  test("accountEmail is never used for contact actions", async ({ page }) => {
    await mockSupplierProfile(page, {
      publicEmail: "public@boisplus.cm",
      accountEmail: "secret-account@private.cm",
      phone: "+237611111111",
      website: "https://boisplus.cm",
    });

    await page.goto(`/fournisseurs/${SUPPLIER_ID}`);

    const email = page.getByTestId("contact-supplier-email");
    await expect(email).toHaveAttribute("href", "mailto:public@boisplus.cm");
    await expect(email).not.toHaveAttribute(
      "href",
      /secret-account@private\.cm/
    );

    const html = await page.content();
    expect(html).not.toContain("mailto:secret-account@private.cm");
  });

  test("correct mailto, tel, and website links with normalized values", async ({
    page,
  }) => {
    await mockSupplierProfile(page, {
      publicEmail: "  info@example.com  ",
      phone: "  +33 1 23 45 67 89  ",
      website: "  example.org/shop  ",
    });

    await page.goto(`/fournisseurs/${SUPPLIER_ID}`);

    await expect(page.getByTestId("contact-supplier-email")).toHaveAttribute(
      "href",
      "mailto:info@example.com"
    );
    await expect(page.getByTestId("contact-supplier-phone")).toHaveAttribute(
      "href",
      "tel:+33123456789"
    );
    await expect(page.getByTestId("contact-supplier-website")).toHaveAttribute(
      "href",
      "https://example.org/shop"
    );
    await expect(page.getByTestId("contact-supplier-website")).toHaveAttribute(
      "target",
      "_blank"
    );
    await expect(page.getByTestId("contact-supplier-website")).toHaveAttribute(
      "rel",
      "noopener noreferrer"
    );
  });
});
