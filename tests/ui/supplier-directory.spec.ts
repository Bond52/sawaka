import { test, expect, type Page, type Route } from "@playwright/test";

const COMPLETE_SUPPLIER = {
  id: "65a1b2c3d4e5f678901234ab",
  name: "BoisPlus Cameroun",
  categories: ["wood_lumber"],
  country: "Cameroun",
  city: "Douala",
  phone: "+237600000001",
  resources: ["Bois massif", "Contreplaqué", "MDF"],
};

const MULTI_CATEGORY_SUPPLIER = {
  id: "65a1b2c3d4e5f678901234cd",
  name: "BuildMart CM",
  categories: ["construction_materials", "metal_steel"],
  country: "Cameroun",
  city: "Yaoundé",
  phone: "+237600000002",
};

const MANY_CATEGORIES_SUPPLIER = {
  id: "65a1b2c3d4e5f67890123499",
  name: "MultiCat Supply",
  categories: [
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
  ],
  country: "Cameroun",
  city: "Douala",
  phone: "+237600000099",
};

const EXACTLY_THREE_CATEGORIES_SUPPLIER = {
  id: "65a1b2c3d4e5f67890123488",
  name: "ThreeCat Supply",
  categories: [
    "construction_materials",
    "wood_lumber",
    "metal_steel",
  ],
  country: "Cameroun",
  city: "Bafoussam",
  phone: "+237600000088",
};

const FOUR_CATEGORIES_SUPPLIER = {
  id: "65a1b2c3d4e5f67890123477",
  name: "FourCat Supply",
  categories: [
    "construction_materials",
    "wood_lumber",
    "metal_steel",
    "electrical_supplies",
  ],
  country: "Cameroun",
  city: "Garoua",
  phone: "+237600000077",
};

const MINIMAL_SUPPLIER = {
  id: "65a1b2c3d4e5f678901234ef",
  name: "Minimal Supply",
  categories: [],
  country: "",
  city: "",
  phone: "+237600000003",
};

const ALL_SUPPLIERS = [
  COMPLETE_SUPPLIER,
  MULTI_CATEGORY_SUPPLIER,
  MINIMAL_SUPPLIER,
];

function isSupplierListRequest(url: string, method: string): boolean {
  if (method !== "GET") return false;
  if (url.includes("/magic-link/")) return false;
  const detailMatch = url.match(/\/api\/suppliers\/([^/?]+)/);
  if (detailMatch && detailMatch[1]) return false;
  return url.includes("/api/suppliers");
}

async function mockSuppliersByQuery(page: Page) {
  await page.route("**/api/suppliers**", async (route: Route) => {
    const request = route.request();
    const url = request.url();

    if (!isSupplierListRequest(url, request.method())) {
      await route.continue();
      return;
    }

    const parsed = new URL(url);
    const search = (parsed.searchParams.get("search") ?? "").trim().toLowerCase();
    const category = (parsed.searchParams.get("category") ?? "").trim();

    let results = [...ALL_SUPPLIERS];
    if (search) {
      results = results.filter((s) => s.name.toLowerCase().includes(search));
    }
    if (category) {
      results = results.filter((s) => s.categories.includes(category));
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(results),
    });
  });
}

async function mockSuppliers(
  page: Page,
  body: unknown,
  options: { status?: number } = {}
) {
  await page.route("**/api/suppliers**", async (route: Route) => {
    const request = route.request();
    const url = request.url();

    if (!isSupplierListRequest(url, request.method())) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: options.status ?? 200,
      contentType: "application/json",
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  });
}

test.describe("Supplier Directory", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "fr");
    });
  });

  test("shows loading state while retrieving suppliers", async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    await page.route("**/api/suppliers**", async (route: Route) => {
      if (!isSupplierListRequest(route.request().url(), route.request().method())) {
        await route.continue();
        return;
      }
      await gate;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([COMPLETE_SUPPLIER]),
      });
    });

    await page.goto("/fournisseurs");

    await expect(page.getByTestId("supplier-directory-loading")).toBeVisible();
    release();
    await expect(page.getByTestId("supplier-directory-list")).toBeVisible();
    await expect(page.getByTestId("supplier-directory-loading")).toHaveCount(0);
  });

  test("lists suppliers with SupplierCard content", async ({ page }) => {
    await mockSuppliers(page, ALL_SUPPLIERS);

    await page.goto("/fournisseurs");

    await expect(page.getByTestId("supplier-directory-list")).toBeVisible();
    await expect(page.getByTestId("supplier-card")).toHaveCount(3);
    await expect(page.getByTestId("supplier-card-name").first()).toHaveText(
      "BoisPlus Cameroun"
    );
  });

  test("hides optional card fields when missing", async ({ page }) => {
    await mockSuppliers(page, [MINIMAL_SUPPLIER]);

    await page.goto("/fournisseurs");

    const card = page.getByTestId("supplier-card");
    await expect(card).toHaveCount(1);
    await expect(page.getByTestId("supplier-card-location")).toHaveCount(0);
    await expect(page.getByTestId("supplier-card-categories")).toHaveCount(0);
    await expect(page.getByTestId("supplier-card-resources")).toHaveCount(0);
    await expect(card).not.toContainText("undefined");
  });

  test("renders multiple categories on a card", async ({ page }) => {
    await mockSuppliers(page, [MULTI_CATEGORY_SUPPLIER]);

    await page.goto("/fournisseurs");

    const categories = page.getByTestId("supplier-card-categories");
    await expect(categories).toContainText("Matériaux de construction");
    await expect(categories).toContainText("Métal et acier");
    await expect(page.getByTestId("supplier-card-more-categories")).toHaveCount(
      0
    );
  });

  test("shows at most 3 category badges plus a localized overflow count", async ({
    page,
  }) => {
    await mockSuppliers(page, [
      EXACTLY_THREE_CATEGORIES_SUPPLIER,
      FOUR_CATEGORIES_SUPPLIER,
      MANY_CATEGORIES_SUPPLIER,
    ]);

    await page.goto("/fournisseurs");

    const threeCatCard = page.locator(
      `[data-testid="supplier-card"][data-supplier-id="${EXACTLY_THREE_CATEGORIES_SUPPLIER.id}"]`
    );
    await expect(
      threeCatCard.getByTestId("supplier-card-categories").locator("span")
    ).toHaveCount(3);
    await expect(
      threeCatCard.getByTestId("supplier-card-more-categories")
    ).toHaveCount(0);

    const fourCatCard = page.locator(
      `[data-testid="supplier-card"][data-supplier-id="${FOUR_CATEGORIES_SUPPLIER.id}"]`
    );
    await expect(
      fourCatCard.getByTestId("supplier-card-categories").locator("span")
    ).toHaveCount(4);
    await expect(
      fourCatCard.getByTestId("supplier-card-more-categories")
    ).toHaveText("+1 autres");
    await expect(fourCatCard).not.toContainText("Fournitures électriques");

    const manyCatCard = page.locator(
      `[data-testid="supplier-card"][data-supplier-id="${MANY_CATEGORIES_SUPPLIER.id}"]`
    );
    await expect(
      manyCatCard.getByTestId("supplier-card-categories").locator("span")
    ).toHaveCount(4);
    await expect(
      manyCatCard.getByTestId("supplier-card-more-categories")
    ).toHaveText("+15 autres");
    await expect(manyCatCard).toContainText("Import / distribution en gros");
    await expect(manyCatCard).toContainText("Emballages et contenants");
    await expect(manyCatCard).toContainText("Transport et logistique");
    await expect(manyCatCard).not.toContainText("Matières premières agricoles");
  });

  test("renders English overflow indicator for many categories", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
    await mockSuppliers(page, [MANY_CATEGORIES_SUPPLIER]);

    await page.goto("/fournisseurs");

    await expect(page.getByTestId("supplier-card-more-categories")).toHaveText(
      "+15 more"
    );
  });

  test("filters by a category hidden behind the card overflow indicator", async ({
    page,
  }) => {
    const directory = [...ALL_SUPPLIERS, MANY_CATEGORIES_SUPPLIER];
    await page.route("**/api/suppliers**", async (route: Route) => {
      const request = route.request();
      const url = request.url();
      if (!isSupplierListRequest(url, request.method())) {
        await route.continue();
        return;
      }

      const parsed = new URL(url);
      const search = (parsed.searchParams.get("search") ?? "").trim().toLowerCase();
      const category = (parsed.searchParams.get("category") ?? "").trim();

      let results = [...directory];
      if (search) {
        results = results.filter((s) => s.name.toLowerCase().includes(search));
      }
      if (category) {
        results = results.filter((s) => s.categories.includes(category));
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(results),
      });
    });

    await page.goto("/fournisseurs");
    await page.getByTestId("supplier-filter-agro_raw_materials").click();

    await expect(page).toHaveURL(/category=agro_raw_materials/);
    await expect(page.getByTestId("supplier-card")).toHaveCount(1);
    await expect(page.getByTestId("supplier-card-name")).toHaveText(
      "MultiCat Supply"
    );
    await expect(page.getByTestId("supplier-card-more-categories")).toHaveText(
      "+15 autres"
    );
  });

  test("card is an accessible link to the supplier profile URL", async ({
    page,
  }) => {
    await mockSuppliers(page, [COMPLETE_SUPPLIER]);

    await page.goto("/fournisseurs");

    const card = page.getByTestId("supplier-card");
    await expect(card).toHaveAttribute(
      "href",
      `/fournisseurs/${COMPLETE_SUPPLIER.id}`
    );
    await card.focus();
    await expect(card).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      new RegExp(`/fournisseurs/${COMPLETE_SUPPLIER.id}`)
    );
  });

  test("shows empty directory state", async ({ page }) => {
    await mockSuppliers(page, []);

    await page.goto("/fournisseurs");

    await expect(page.getByTestId("supplier-directory-empty")).toHaveText(
      "Aucun fournisseur trouvé."
    );
  });

  test("shows user-friendly error without technical details", async ({
    page,
  }) => {
    await mockSuppliers(page, { error: "ECONNREFUSED mongodb" }, { status: 500 });

    await page.goto("/fournisseurs");

    const error = page.getByTestId("supplier-directory-error");
    await expect(error).toBeVisible();
    await expect(error).toContainText(
      "Impossible de charger les fournisseurs. Veuillez réessayer plus tard."
    );
    await expect(error).not.toContainText("ECONNREFUSED");
    await expect(error).not.toContainText("mongodb");
    await expect(page.getByTestId("supplier-directory-error-retry")).toBeVisible();
  });

  test("retries directory retrieval after failure", async ({ page }) => {
    let attempts = 0;
    await page.route("**/api/suppliers**", async (route: Route) => {
      if (!isSupplierListRequest(route.request().url(), route.request().method())) {
        await route.continue();
        return;
      }
      attempts += 1;
      if (attempts === 1) {
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
        body: JSON.stringify([COMPLETE_SUPPLIER]),
      });
    });

    await page.goto("/fournisseurs");
    await expect(page.getByTestId("supplier-directory-error")).toBeVisible();
    await page.getByTestId("supplier-directory-error-retry").click();
    await expect(page.getByTestId("supplier-directory-list")).toBeVisible();
    await expect(page.getByTestId("supplier-card")).toHaveCount(1);
  });
});

test.describe("Supplier Search and Category Filter", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "fr");
    });
  });

  test("searches by supplier name via API", async ({ page }) => {
    await mockSuppliersByQuery(page);

    await page.goto("/fournisseurs");
    await expect(page.getByTestId("supplier-card")).toHaveCount(3);

    await page.getByTestId("supplier-directory-search").fill("  BoisPlus  ");

    await expect(page).toHaveURL(/search=BoisPlus/, { timeout: 5000 });
    await expect(page.getByTestId("supplier-card")).toHaveCount(1);
    await expect(page.getByTestId("supplier-card-name")).toHaveText(
      "BoisPlus Cameroun"
    );
  });

  test("filters by category selection", async ({ page }) => {
    await mockSuppliersByQuery(page);

    await page.goto("/fournisseurs");

    await page.getByTestId("supplier-filter-wood_lumber").click();

    await expect(page).toHaveURL(/category=wood_lumber/);
    await expect(
      page.getByTestId("supplier-filter-wood_lumber")
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("supplier-filter-all")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    await expect(page.getByTestId("supplier-card")).toHaveCount(1);
    await expect(page.getByTestId("supplier-card-name")).toHaveText(
      "BoisPlus Cameroun"
    );
  });

  test("supports combined name and category filtering", async ({ page }) => {
    await mockSuppliersByQuery(page);

    await page.goto("/fournisseurs");
    await page.getByTestId("supplier-directory-search").fill("Build");
    await expect(page).toHaveURL(/search=Build/, { timeout: 5000 });

    await page.getByTestId("supplier-filter-construction_materials").click();

    await expect(page).toHaveURL(/search=Build/);
    await expect(page).toHaveURL(/category=construction_materials/);
    await expect(page.getByTestId("supplier-card")).toHaveCount(1);
    await expect(page.getByTestId("supplier-card-name")).toHaveText(
      "BuildMart CM"
    );
  });

  test("clears active search and filters", async ({ page }) => {
    await mockSuppliersByQuery(page);

    await page.goto("/fournisseurs?search=BoisPlus&category=wood_lumber");

    await expect(page.getByTestId("supplier-directory-search")).toHaveValue(
      "BoisPlus"
    );
    await expect(page.getByTestId("supplier-directory-clear")).toBeVisible();
    await expect(page.getByTestId("supplier-card")).toHaveCount(1);

    await page.getByTestId("supplier-directory-clear").click();

    await expect(page.getByTestId("supplier-directory-search")).toHaveValue("");
    await expect(page.getByTestId("supplier-filter-all")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page).not.toHaveURL(/search=/);
    await expect(page).not.toHaveURL(/category=/);
    await expect(page.getByTestId("supplier-card")).toHaveCount(3);
    await expect(page.getByTestId("supplier-directory-clear")).toHaveCount(0);
  });

  test("shows no-results message when search matches nothing", async ({
    page,
  }) => {
    await mockSuppliersByQuery(page);

    await page.goto("/fournisseurs");
    await page.getByTestId("supplier-directory-search").fill("zzzz-unknown");

    await expect(page.getByTestId("supplier-directory-empty")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("supplier-directory-empty")).toHaveText(
      "Aucun fournisseur ne correspond à votre recherche."
    );
    await expect(page.getByTestId("supplier-directory-list")).toHaveCount(0);
  });

  test("shows user-friendly error when search request fails", async ({
    page,
  }) => {
    await page.route("**/api/suppliers**", async (route: Route) => {
      if (!isSupplierListRequest(route.request().url(), route.request().method())) {
        await route.continue();
        return;
      }
      const url = new URL(route.request().url());
      if (url.searchParams.has("search") || url.searchParams.has("category")) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "db timeout stacktrace" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ALL_SUPPLIERS),
      });
    });

    await page.goto("/fournisseurs");
    await expect(page.getByTestId("supplier-card")).toHaveCount(3);

    await page.getByTestId("supplier-directory-search").fill("Bois");
    await expect(page.getByTestId("supplier-directory-error")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("supplier-directory-error")).toContainText(
      "Impossible d'effectuer la recherche. Veuillez réessayer plus tard."
    );
    await expect(page.getByTestId("supplier-directory-error")).not.toContainText(
      "stacktrace"
    );
    await expect(page.getByTestId("supplier-directory-error-retry")).toBeVisible();
  });

  test("supports keyboard interaction for search and category chips", async ({
    page,
  }) => {
    await mockSuppliersByQuery(page);

    await page.goto("/fournisseurs");

    const search = page.getByTestId("supplier-directory-search");
    await search.focus();
    await expect(search).toBeFocused();
    await search.pressSequentially("Steel", { delay: 20 });

    await expect(page).toHaveURL(/search=Steel/, { timeout: 5000 });

    await page.getByTestId("supplier-filter-metal_steel").focus();
    await expect(page.getByTestId("supplier-filter-metal_steel")).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(
      page.getByTestId("supplier-filter-metal_steel")
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/category=metal_steel/);
  });
});
