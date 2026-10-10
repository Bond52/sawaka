import { test, expect, type Page, type Route } from "@playwright/test";

const SUPPLIER_ID = "65a1b2c3d4e5f678901234ab";

const COMPLETE_PROFILE = {
  id: SUPPLIER_ID,
  name: "BoisPlus Cameroun",
  categories: ["wood_lumber", "construction_materials"],
  country: "Cameroun",
  region: "Littoral",
  city: "Douala",
  address: "Zone industrielle Bonabéri, Rue du Commerce",
  postalCode: "BP 1234",
  phone: "+237 699 55 44 33",
  publicEmail: "ventes@boisplus.cm",
  website: "www.boisplus.cm",
  resources: ["Bois massif", "Contreplaqué", "MDF"],
  accountEmail: "secret@private.cm",
  ownerId: "should-not-appear",
  status: "Active",
  isVisible: true,
};

type ProfileFixture = Partial<typeof COMPLETE_PROFILE>;

async function mockProfile(
  page: Page,
  options: {
    body?: ProfileFixture | null;
    status?: number;
    delayMs?: number;
    gate?: Promise<void>;
  } = {}
) {
  await page.route("**/api/suppliers/**", async (route: Route) => {
    const request = route.request();
    if (request.method() !== "GET" || request.url().includes("/magic-link/")) {
      await route.continue();
      return;
    }

    if (options.gate) await options.gate;
    if (options.delayMs) {
      await new Promise((r) => setTimeout(r, options.delayMs));
    }

    if (options.status === 404 || options.body === null) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Supplier not found" }),
      });
      return;
    }

    if (options.status && options.status >= 500) {
      await route.fulfill({
        status: options.status,
        contentType: "application/json",
        body: JSON.stringify({ error: "ECONNREFUSED mongodb stack" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...COMPLETE_PROFILE, ...options.body }),
    });
  });
}

test.describe("Supplier Profile page", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "fr");
    });
  });

  test("renders a complete supplier profile", async ({ page }) => {
    await mockProfile(page);

    await page.goto(`/fournisseurs/${SUPPLIER_ID}`);

    await expect(page.getByTestId("supplier-profile-page")).toBeVisible();
    await expect(page.getByTestId("supplier-profile-name")).toHaveText(
      "BoisPlus Cameroun"
    );
    await expect(
      page.getByTestId("supplier-profile-primary-category")
    ).toContainText("Bois et charpente");
    await expect(page.getByTestId("supplier-profile-categories")).toContainText(
      "Matériaux de construction"
    );
    await expect(page.getByTestId("supplier-profile-categories")).toContainText(
      "Bois massif"
    );

    await expect(page.getByTestId("supplier-profile-location")).toContainText(
      "Douala, Cameroun"
    );
    await expect(page.getByTestId("supplier-profile-location")).toContainText(
      "Littoral"
    );
    await expect(page.getByTestId("supplier-profile-location")).toContainText(
      "Zone industrielle Bonabéri, Rue du Commerce"
    );
    await expect(page.getByTestId("supplier-profile-location")).toContainText(
      "BP 1234"
    );

    await expect(page.getByTestId("contact-supplier-phone")).toHaveAttribute(
      "href",
      "tel:+237699554433"
    );
    await expect(page.getByTestId("contact-supplier-email")).toHaveAttribute(
      "href",
      "mailto:ventes@boisplus.cm"
    );
    await expect(page.getByTestId("contact-supplier-website")).toHaveAttribute(
      "href",
      "https://www.boisplus.cm/"
    );
    await expect(page.getByTestId("contact-supplier-website")).toHaveAttribute(
      "rel",
      "noopener noreferrer"
    );
    await expect(page.getByTestId("contact-supplier-cta")).toBeVisible();

    const html = await page.content();
    expect(html).not.toContain("secret@private.cm");
    expect(html).not.toContain("should-not-appear");
    expect(html).not.toContain("mailto:secret@private.cm");
  });

  test("displays the complete category list on the detail page", async ({
    page,
  }) => {
    const manyCategories = [
      "import_wholesale_distribution",
      "packaging_containers",
      "transport_logistics",
      "construction_materials",
      "wood_lumber",
      "metal_steel",
      "electrical_supplies",
      "plumbing_supplies",
      "paints_finishes",
      "hardware_fasteners",
      "hand_tools",
      "power_tools",
      "industrial_machinery",
      "safety_equipment",
      "textiles_fabrics",
      "leather_accessories",
      "art_craft_materials",
      "agro_raw_materials",
    ];

    await mockProfile(page, {
      body: {
        categories: manyCategories,
        resources: [],
      },
    });

    await page.goto(`/fournisseurs/${SUPPLIER_ID}`);

    await expect(
      page.getByTestId("supplier-profile-primary-category")
    ).toContainText("Import / distribution en gros");

    const tags = page.getByTestId("supplier-profile-categories");
    await expect(tags).toContainText("Emballages et contenants");
    await expect(tags).toContainText("Transport et logistique");
    await expect(tags).toContainText("Matières premières agricoles");
    await expect(tags).not.toContainText("+");
  });

  test("hides missing optional fields", async ({ page }) => {
    await mockProfile(page, {
      body: {
        name: "Minimal Co",
        categories: ["metal_steel"],
        country: "Cameroun",
        city: "Yaoundé",
        region: "",
        address: "",
        postalCode: "",
        phone: "+237600000000",
        publicEmail: "",
        website: "",
        resources: [],
      },
    });

    await page.goto(`/fournisseurs/${SUPPLIER_ID}`);

    await expect(page.getByTestId("supplier-profile-name")).toHaveText(
      "Minimal Co"
    );
    await expect(
      page.getByTestId("supplier-profile-primary-category")
    ).toContainText("Métal et acier");
    await expect(page.getByTestId("supplier-profile-location")).toContainText(
      "Yaoundé, Cameroun"
    );
    await expect(page.getByTestId("supplier-profile-location")).not.toContainText(
      "Littoral"
    );
    await expect(page.getByTestId("contact-supplier-phone")).toBeVisible();
    await expect(page.getByTestId("contact-supplier-email")).toHaveCount(0);
    await expect(page.getByTestId("contact-supplier-website")).toHaveCount(0);
  });

  test("shows loading state while retrieving the profile", async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await mockProfile(page, { gate });

    await page.goto(`/fournisseurs/${SUPPLIER_ID}`);
    await expect(page.getByTestId("supplier-profile-loading")).toBeVisible();
    release();
    await expect(page.getByTestId("supplier-profile-page")).toBeVisible();
  });

  test("shows not-found behavior for missing suppliers", async ({ page }) => {
    await mockProfile(page, { status: 404, body: null });

    await page.goto(`/fournisseurs/${SUPPLIER_ID}`);

    await expect(page.getByTestId("supplier-profile-not-found")).toBeVisible();
    await expect(page.getByTestId("supplier-profile-not-found")).toContainText(
      "Ce fournisseur n'est pas disponible."
    );
    await expect(page.getByTestId("supplier-profile-back")).toBeVisible();
  });

  test("shows safe retrieval error without technical details", async ({
    page,
  }) => {
    await mockProfile(page, { status: 500 });

    await page.goto(`/fournisseurs/${SUPPLIER_ID}`);

    const error = page.getByTestId("supplier-profile-error");
    await expect(error).toBeVisible();
    await expect(page.getByTestId("supplier-profile-error-banner")).toContainText(
      "Impossible de charger ce profil. Veuillez réessayer plus tard."
    );
    await expect(error).not.toContainText("ECONNREFUSED");
    await expect(error).not.toContainText("mongodb");
    await expect(error).not.toContainText("stack");
    await expect(page.getByTestId("supplier-profile-error-banner-retry")).toBeVisible();
    await expect(page.getByTestId("supplier-profile-back")).toBeVisible();
  });

  test("retries profile retrieval after failure", async ({ page }) => {
    let allowSuccess = false;
    await page.route("**/api/suppliers/**", async (route: Route) => {
      const request = route.request();
      if (request.method() !== "GET" || request.url().includes("/magic-link/")) {
        await route.continue();
        return;
      }
      if (!allowSuccess) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Erreur serveur" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(COMPLETE_PROFILE),
      });
    });

    await page.goto(`/fournisseurs/${SUPPLIER_ID}`);
    await expect(page.getByTestId("supplier-profile-error")).toBeVisible();
    allowSuccess = true;
    await page.getByTestId("supplier-profile-error-banner-retry").click();
    await expect(page.getByTestId("supplier-profile-page")).toBeVisible();
    await expect(page.getByTestId("supplier-profile-name")).toHaveText(
      "BoisPlus Cameroun"
    );
  });

  test("keeps not-found distinct from server error", async ({ page }) => {
    await mockProfile(page, { status: 404, body: null });

    await page.goto(`/fournisseurs/${SUPPLIER_ID}`);

    await expect(page.getByTestId("supplier-profile-not-found")).toBeVisible();
    await expect(page.getByTestId("supplier-profile-error")).toHaveCount(0);
    await expect(page.getByTestId("supplier-profile-not-found")).toContainText(
      "Ce fournisseur n'est pas disponible."
    );
  });

  test("return-to-directory navigation works", async ({ page }) => {
    await mockProfile(page);
    await page.route("**/api/suppliers", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      const url = route.request().url();
      if (/\/api\/suppliers\/[^/?]+/.test(url)) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto(`/fournisseurs/${SUPPLIER_ID}`);
    await page.getByTestId("supplier-profile-back").click();
    await expect(page).toHaveURL(/\/fournisseurs\/?$/);
    await expect(page.getByTestId("supplier-directory-page")).toBeVisible();
  });

  test("exposes public contact actions", async ({ page }) => {
    await mockProfile(page);

    await page.goto(`/fournisseurs/${SUPPLIER_ID}`);

    await expect(page.getByTestId("contact-supplier-email")).toHaveAttribute(
      "href",
      "mailto:ventes@boisplus.cm"
    );
    await expect(page.getByTestId("contact-supplier-phone")).toHaveAttribute(
      "href",
      "tel:+237699554433"
    );
    await expect(page.getByTestId("contact-supplier-website")).toHaveAttribute(
      "target",
      "_blank"
    );
    await expect(page.getByTestId("contact-supplier-cta")).toHaveAttribute(
      "href",
      "mailto:ventes@boisplus.cm"
    );
  });
});
