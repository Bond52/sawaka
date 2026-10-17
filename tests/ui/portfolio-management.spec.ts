import { expect, test, type Page, type Route } from "@playwright/test";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]);

const domains = [
  { id: "domain-wood", nameFR: "Menuiserie", nameEN: "Woodwork" },
  { id: "domain-metal", nameFR: "Ferronnerie", nameEN: "Metalwork" },
];

const published = {
  id: "realization-published",
  sequence: 1,
  description: "Chaise en noyer",
  domainId: "domain-wood",
  completedOn: "2024-05-01",
  status: "published",
  images: [
    { url: "https://images.example/chair.jpg" },
    { url: "https://images.example/detail.jpg" },
  ],
};

const draft = {
  id: "realization-draft",
  sequence: 2,
  description: "Brouillon secret",
  domainId: null,
  completedOn: null,
  status: "draft",
  images: [{ url: "https://images.example/draft.jpg" }],
};

const metal = {
  id: "realization-metal",
  sequence: 3,
  description: "",
  domainId: "domain-metal",
  completedOn: null,
  status: "published",
  images: [{ url: "https://images.example/metal.jpg" }],
};

async function setLocale(page: Page, locale: "fr" | "en") {
  await page.addInitScript((value) => {
    window.localStorage.setItem("sawaka-locale", value);
  }, locale);
}

async function authenticate(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "user",
      JSON.stringify({
        token: "user-jwt-token",
        roles: ["acheteur"],
        username: "amina",
        firstName: "Amina",
      })
    );
  });
}

async function mockPortfolio(
  page: Page,
  realizations: unknown[],
  options?: { status?: number; body?: unknown }
) {
  let articleCalls = 0;
  let ownerCalls = 0;
  await page.route("**/api/seller/articles**", async (route) => {
    articleCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], total: 0, page: 1, pages: 1 }),
    });
  });
  await page.route("**/api/contributors/domains", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ domains }),
    });
  });
  await page.route("**/api/contributors/me/realizations", async (route) => {
    ownerCalls += 1;
    const url = new URL(route.request().url());
    expect(url.pathname.endsWith("/api/contributors/me/realizations")).toBe(true);
    expect(url.searchParams.has("ownerId")).toBe(false);
    expect(route.request().headers().authorization).toBe("Bearer user-jwt-token");
    await route.fulfill({
      status: options?.status ?? 200,
      contentType: "application/json",
      body: JSON.stringify(options?.body ?? { realizations }),
    });
  });
  return {
    articleCalls: () => articleCalls,
    ownerCalls: () => ownerCalls,
  };
}

async function openPortfolio(page: Page, locale: "fr" | "en") {
  await setLocale(page, locale);
  await page.goto("/vendeur/articles");
  await page.getByRole("button", { name: locale === "fr" ? "FR" : "EN", exact: true }).click();
}

test.describe("My Realizations portfolio page", () => {
  test("French portfolio page replaces the product inventory", async ({ page }) => {
    await authenticate(page);
    const calls = await mockPortfolio(page, []);
    await openPortfolio(page, "fr");

    await expect(page.getByRole("heading", { name: "Mes réalisations" })).toBeVisible();
    await expect(
      page.getByText(
        "Présentez votre savoir-faire à travers vos projets terminés. Les brouillons restent privés."
      )
    ).toBeVisible();
    await expect(page.getByTestId("portfolio-empty")).toContainText(
      "Vous n'avez encore publié aucune réalisation."
    );
    await expect(page.getByTestId("portfolio-search")).toHaveAttribute(
      "placeholder",
      "Rechercher une réalisation"
    );
    await expect(page.getByTestId("portfolio-status")).toContainText("Tous les statuts");
    await expect(page.getByTestId("portfolio-status")).toContainText("Publiée");
    await expect(page.getByTestId("portfolio-status")).toContainText("Brouillon");
    await expect(page.getByTestId("portfolio-category")).toContainText("Toutes les catégories");
    await expect(page.getByTestId("portfolio-category")).toContainText("Menuiserie");
    await expect(page.getByTestId("portfolio-add")).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByTestId("portfolio-import")).toHaveAttribute("href", "/realizations/import");
    await expect(page.getByText("Prix")).toHaveCount(0);
    await expect(page.getByText("Stock")).toHaveCount(0);
    await expect(page.getByText("SKU")).toHaveCount(0);
    await expect(page.getByText(/82\s*%/)).toHaveCount(0);
    await expect(page.getByText("24")).toHaveCount(0);
    expect(calls.articleCalls()).toBe(0);
    expect(calls.ownerCalls()).toBeGreaterThan(0);
  });

  test("English labels, keyboard access, and list toggle", async ({ page }) => {
    await authenticate(page);
    await mockPortfolio(page, []);
    await openPortfolio(page, "en");

    await expect(page.getByRole("heading", { name: "My Realizations" })).toBeVisible();
    await expect(
      page.getByText("Show your craft through finished projects. Drafts stay private.")
    ).toBeVisible();
    await expect(page.getByTestId("portfolio-empty")).toContainText(
      "You have not published any realizations yet."
    );
    await expect(page.getByTestId("portfolio-search")).toHaveAttribute(
      "placeholder",
      "Search realizations"
    );
    await expect(page.getByTestId("portfolio-category")).toContainText("Woodwork");

    const search = page.getByTestId("portfolio-search");
    await search.focus();
    await expect(search).toBeFocused();
    const listToggle = page.getByTestId("portfolio-view-list");
    await listToggle.focus();
    await expect(listToggle).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(listToggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("portfolio-view-grid")).toHaveAttribute("aria-pressed", "false");

    const add = page.getByTestId("portfolio-add");
    await add.focus();
    await expect(add).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/vendeur\/articles$/);
  });

  test("an unsigned visit does not show an empty portfolio or call the owner API", async ({ page }) => {
    let ownerCalls = 0;
    await page.route("**/api/contributors/me/realizations", async (route) => {
      ownerCalls += 1;
      await route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    });
    await setLocale(page, "en");
    await page.goto("/vendeur/articles");
    await expect(page.getByTestId("portfolio-signed-out")).toContainText(
      "Sign in to see your realizations."
    );
    await expect(page.getByTestId("portfolio-empty")).toHaveCount(0);
    await expect(page.getByTestId("portfolio-sign-in")).toHaveAttribute(
      "href",
      "/login?redirect=/vendeur/articles"
    );
    expect(ownerCalls).toBe(0);
  });

  test("draft and published realizations stay visible to their owner", async ({ page }) => {
    await authenticate(page);
    const calls = await mockPortfolio(page, [published]);
    await openPortfolio(page, "en");
    await expect(page.getByTestId("portfolio-card")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Woodwork" })).toBeVisible();
    await expect(page.getByTestId("portfolio-card")).toContainText("Published");
    await expect(page.getByText("Chaise en noyer")).toBeVisible();
    await expect(page.getByText("2 photos")).toBeVisible();
    await expect(page.getByRole("img", { name: "Woodwork" })).toBeVisible();
    await expect(page.getByText("May 2024")).toBeVisible();
    expect(calls.articleCalls()).toBe(0);

    await page.route("**/api/contributors/me/realizations", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ realizations: [draft] }),
      });
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Brouillon secret" })).toBeVisible();
    await expect(page.getByTestId("portfolio-card")).toContainText("Draft");
    await expect(page.getByText("1 photo")).toBeVisible();
    await expect(page.getByTestId("portfolio-empty")).toHaveCount(0);
  });

  test("filters, search, refresh, list view, and responsive cards use persisted realizations", async ({
    page,
  }) => {
    await authenticate(page);
    const calls = await mockPortfolio(page, [published, draft, metal]);
    await openPortfolio(page, "fr");

    await expect(page.getByTestId("portfolio-card")).toHaveCount(3);
    await expect(page.getByRole("heading", { name: "Menuiserie" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Brouillon secret" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ferronnerie" })).toBeVisible();
    await expect(page.getByTestId("portfolio-card").filter({ hasText: "Menuiserie" })).toContainText("Publiée");
    await expect(page.getByTestId("portfolio-card").filter({ hasText: "Brouillon secret" })).toContainText("Brouillon");
    await expect(page.getByText(/82\s*%/)).toHaveCount(0);

    await page.getByTestId("portfolio-search").fill("noyer");
    await expect(page.getByTestId("portfolio-card")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Menuiserie" })).toBeVisible();

    await page.getByTestId("portfolio-search").fill("titre inventé");
    await expect(page.getByTestId("portfolio-no-results")).toBeVisible();
    await expect(page.getByTestId("portfolio-empty")).toHaveCount(0);

    await page.getByTestId("portfolio-search").fill("menuiserie");
    await expect(page.getByTestId("portfolio-card")).toHaveCount(1);

    await page.getByTestId("portfolio-search").fill("");
    await page.getByTestId("portfolio-status").selectOption("draft");
    await expect(page.getByTestId("portfolio-card")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Brouillon secret" })).toBeVisible();

    await page.getByTestId("portfolio-status").selectOption("published");
    await expect(page.getByTestId("portfolio-card")).toHaveCount(2);
    await expect(page.getByRole("heading", { name: "Brouillon secret" })).toHaveCount(0);

    await page.getByTestId("portfolio-status").selectOption("");
    await page.getByTestId("portfolio-category").selectOption("domain-metal");
    await expect(page.getByTestId("portfolio-card")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Ferronnerie" })).toBeVisible();

    await page.getByTestId("portfolio-category").selectOption("");
    const checkbox = page.getByRole("checkbox", { name: "Sélectionner Menuiserie" });
    await checkbox.focus();
    await expect(checkbox).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.getByTestId("portfolio-selection-toolbar")).toContainText("1 réalisation sélectionnée");

    await page.getByTestId("portfolio-view-list").click();
    await expect(page.getByTestId("portfolio-view-list")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("portfolio-results")).toBeVisible();

    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({ width, height: 800 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(overflow).toBe(false);
    }

    const before = calls.ownerCalls();
    await page.reload();
    await expect(page.getByTestId("portfolio-card")).toHaveCount(3);
    expect(calls.ownerCalls()).toBeGreaterThan(before);
    expect(calls.articleCalls()).toBe(0);
  });

  test("a failed load is not presented as an empty portfolio", async ({ page }) => {
    await authenticate(page);
    await mockPortfolio(page, [], { status: 500, body: { error: { code: "SERVER_ERROR" } } });
    await openPortfolio(page, "en");
    await expect(page.getByTestId("portfolio-error")).toContainText("Realizations could not be loaded.");
    await expect(page.getByTestId("portfolio-empty")).toHaveCount(0);
    const retry = page.getByTestId("portfolio-retry");
    await retry.focus();
    await expect(retry).toBeFocused();
  });

  test("View My Portfolio shows the realization persisted by publication", async ({ page }) => {
    await authenticate(page);
    await setLocale(page, "en");
    let publishCalls = 0;
    let articleCalls = 0;
    await page.route("**/api/seller/articles**", async (route) => {
      articleCalls += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await page.route("**/api/contributors/domains", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ domains: [{ id: "domain-wood", nameFR: "Menuiserie", nameEN: "Woodwork" }] }),
      });
    });
    await page.route("**/api/contributors/me/import-photos/validate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accepted: [{ index: 0, name: "chair.jpg", size: 16 }], rejected: [] }),
      });
    });
    await page.route("**/api/contributors/me/realizations", async (route: Route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ realizations: [published] }),
        });
        return;
      }
      publishCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          outcome: "success",
          publishedCount: 1,
          draftCount: 0,
          failedCount: 0,
          items: [],
        }),
      });
    });

    await page.goto("/realizations/import");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.getByTestId("portfolio-file-input").setInputFiles({
      name: "chair.jpg",
      mimeType: "image/jpeg",
      buffer: jpeg,
    });
    await page.getByTestId("portfolio-import-continue").click();
    await page.getByRole("button", { name: "Select chair.jpg" }).click();
    await page.getByTestId("portfolio-group-one").click();
    await page.getByTestId("portfolio-organize-continue").click();
    await page.getByTestId("portfolio-complete-continue").click();
    await page.getByTestId("portfolio-review-publish").click();
    await expect(page).toHaveURL(/\/realizations\/confirmation/);
    await page.getByTestId("portfolio-confirmation-portfolio").click();
    await expect(page).toHaveURL(/\/vendeur\/articles$/);
    await expect(page.getByRole("heading", { name: "Woodwork" })).toBeVisible();
    await expect(page.getByTestId("portfolio-card")).toContainText("Chaise en noyer");
    await expect(page.getByTestId("portfolio-card")).toContainText("Published");
    expect(publishCalls).toBe(1);
    expect(articleCalls).toBe(0);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Woodwork" })).toBeVisible();
    expect(publishCalls).toBe(1);
  });

  test("portfolio page has no horizontal overflow", async ({ page }) => {
    await authenticate(page);
    await mockPortfolio(page, [published, draft]);
    await openPortfolio(page, "fr");
    await expect(page.getByTestId("portfolio-card").first()).toBeVisible();
    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({ width, height: 800 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(overflow).toBe(false);
    }
  });
});
