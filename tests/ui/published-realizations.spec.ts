import { expect, test, type Page, type Route } from "@playwright/test";

const WOOD = { id: "domain-wood", nameFR: "Menuiserie", nameEN: "Carpentry" };
const CLAY = { id: "domain-clay", nameFR: "Poterie", nameEN: "Pottery" };

const LONG_DESCRIPTION =
  "Table en bois local fabriquée avec des assemblages traditionnels et une finition à l'huile. " +
  "La description reste lisible lorsqu'elle est longue, sans créer de défilement horizontal. " +
  "SupercalifragilisticexpialidociousSupercalifragilisticexpialidocious";

const MULTI_PHOTO = {
  id: "real-table",
  sequence: 2,
  description: LONG_DESCRIPTION,
  domainId: WOOD.id,
  completedOn: "2024-06-02",
  title: "Invented title",
  email: "owner@example.com",
  status: "published",
  ownerId: "user-secret",
  images: [
    { url: "https://cdn.example/table-1.jpg", publicId: "secret-cover" },
    { url: "https://cdn.example/table-2.jpg" },
    { url: "https://cdn.example/table-3.jpg" },
    { url: "https://cdn.example/table-4.jpg" },
  ],
};

const BOWL = {
  id: "real-bowl",
  sequence: 3,
  description: "Bol émaillé",
  domainId: CLAY.id,
  completedOn: null,
  status: "published",
  images: [{ url: "https://cdn.example/bowl.jpg" }],
};

const DRAFT = {
  id: "real-draft",
  sequence: 1,
  description: "Brouillon secret",
  domainId: WOOD.id,
  completedOn: null,
  status: "draft",
  images: [{ url: "https://cdn.example/draft.jpg", publicId: "draft-secret" }],
};

async function setLocale(page: Page, locale: "fr" | "en") {
  await page.addInitScript((value) => {
    window.localStorage.setItem("sawaka-locale", value);
  }, locale);
}

async function seedUser(page: Page) {
  await page.addInitScript((stored) => {
    window.localStorage.setItem("user", JSON.stringify(stored));
  }, {
    token: "user-jwt-token",
    roles: ["acheteur"],
    username: "wilson",
    firstName: "Wilson",
  });
}

async function mockImages(page: Page) {
  await page.route("https://cdn.example/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      ),
    });
  });
}

async function mockDomains(page: Page) {
  await page.route("**/api/contributors/domains", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ domains: [WOOD, CLAY] }),
    });
  });
}

async function mockCatalog(
  page: Page,
  realizations: unknown[] | ((url: URL) => unknown[]),
  options?: { status?: number; hold?: Promise<void>; failTimes?: number }
) {
  const calls: { url: string; authorization: string | undefined }[] = [];
  const ownerCalls: string[] = [];
  let attempts = 0;
  await page.route("**/api/contributors/me/realizations", async (route) => {
    ownerCalls.push(route.request().url());
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "OWNER_ENDPOINT" } }),
    });
  });
  await page.route("**/api/realizations**", async (route: Route) => {
    const requestUrl = route.request().url();
    if (new URL(requestUrl).pathname.includes("/contributors/")) {
      await route.fallback();
      return;
    }
    calls.push({
      url: requestUrl,
      authorization: route.request().headers().authorization,
    });
    attempts += 1;
    if (options?.hold && attempts === 1) await options.hold;
    const failTimes = options?.failTimes ?? 0;
    if (attempts <= failTimes || options?.status) {
      await route.fulfill({
        status: options?.status ?? 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "SERVER_ERROR" } }),
      });
      return;
    }
    const url = new URL(requestUrl);
    const items = typeof realizations === "function" ? realizations(url) : realizations;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ realizations: items }),
    });
  });
  return { calls, ownerCalls };
}

function filterCatalog(url: URL) {
  const q = (url.searchParams.get("q") || "").toLowerCase();
  const domainId = url.searchParams.get("domainId") || "";
  return [DRAFT, MULTI_PHOTO, BOWL].filter((item) => {
    if (item.status === "draft") return false;
    if (domainId && item.domainId !== domainId) return false;
    if (!q) return true;
    const domain = item.domainId === WOOD.id ? WOOD : CLAY;
    return (
      item.description.toLowerCase().includes(q) ||
      domain.nameFR.toLowerCase().includes(q) ||
      domain.nameEN.toLowerCase().includes(q)
    );
  });
}

async function fitsViewport(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
  );
}

test.describe("Published realizations catalog", () => {
  test("shows loading, then one card for a realization with several photos", async ({ page }) => {
    await setLocale(page, "en");
    await mockImages(page);
    await mockDomains(page);
    let release = () => {};
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { calls, ownerCalls } = await mockCatalog(page, [DRAFT, MULTI_PHOTO], { hold });
    await page.goto("/realisations");

    const loading = page.getByTestId("published-realizations-loading");
    await expect(loading).toBeVisible();
    await expect(loading).toHaveAttribute("role", "status");
    await expect(page.getByTestId("published-realizations-empty")).toHaveCount(0);
    await expect(page.getByTestId("published-realizations-error")).toHaveCount(0);
    release();

    await expect(page.getByTestId("published-realization")).toHaveCount(1);
    await expect(page.getByText("Brouillon secret")).toHaveCount(0);
    await expect(page.getByTestId("published-realization-title")).toHaveText("Invented title");
    await expect(page.getByText("owner@example.com")).toHaveCount(0);
    const card = page.getByTestId("published-realization");
    await expect(card.locator("a")).toHaveCount(1);
    await expect(card.getByTestId("published-realization-image")).toHaveCount(1);
    await expect(card.getByTestId("published-realization-link")).toHaveAttribute(
      "href",
      "/realisations/real-table"
    );
    await expect(card.getByTestId("published-realization-image")).toHaveAttribute(
      "alt",
      "Photo of a published realization, 4 photos"
    );
    await expect(card.getByTestId("published-realization-count")).toHaveText("4 photos");
    await expect(card.getByTestId("published-realization-domain")).toHaveText("Carpentry");
    await expect(card.getByTestId("published-realization-description")).toContainText(
      LONG_DESCRIPTION.slice(0, 40)
    );
    await expect(card.getByTestId("published-realization-date")).toContainText("2024");
    await expect(page.getByTestId("published-realizations-list")).toBeVisible();
    await card.getByTestId("published-realization-link").click();
    await expect(page).toHaveURL(/\/realisations\/real-table$/);
    expect(calls.every((call) => call.url.includes("/api/realizations"))).toBe(true);
    expect(calls.every((call) => !call.url.includes("/me/realizations"))).toBe(true);
    expect(calls.every((call) => !call.authorization)).toBe(true);
    expect(ownerCalls).toEqual([]);
  });

  test("keeps an empty success distinct from an error", async ({ page }) => {
    await setLocale(page, "fr");
    await mockImages(page);
    await mockDomains(page);
    let release = () => {};
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    await mockCatalog(page, [], { hold, failTimes: 1 });
    await page.goto("/realisations");

    await expect(page.getByRole("heading", { name: "Réalisations" })).toBeVisible();
    await expect(page.getByText("Travaux publiés par les contributeurs.")).toBeVisible();
    await expect(page.getByTestId("published-realizations-loading")).toHaveText(
      "Chargement des réalisations…"
    );
    release();

    const alert = page.getByTestId("published-realizations-error");
    await expect(alert).toBeVisible();
    await expect(alert).toHaveAttribute("role", "alert");
    await expect(alert).toContainText("Les réalisations publiées n'ont pas pu être chargées.");
    await expect(page.getByTestId("published-realizations-empty")).toHaveCount(0);
    await expect(page.getByTestId("published-realization")).toHaveCount(0);

    const retry = page.getByTestId("published-realizations-retry");
    await retry.focus();
    await expect(retry).toBeFocused();
    await expect(retry).toHaveText("Réessayer");
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("published-realizations-empty")).toHaveText(
      "Aucune réalisation publiée pour le moment."
    );
    await expect(page.getByTestId("published-realizations-error")).toHaveCount(0);
    await expect(page.getByLabel("Rechercher une réalisation")).toBeVisible();
    await expect(page.getByLabel("Catégorie")).toBeVisible();
    await expect(page.getByTestId("published-realizations-category")).toContainText(
      "Toutes les catégories"
    );
  });

  test("searches description and category for a signed-in visitor", async ({ page }) => {
    await setLocale(page, "en");
    await seedUser(page);
    await mockImages(page);
    await mockDomains(page);
    const { calls, ownerCalls } = await mockCatalog(page, filterCatalog);
    await page.goto("/realisations");

    await expect(page.getByTestId("published-realization")).toHaveCount(2);
    await expect(page.getByText("Brouillon secret")).toHaveCount(0);

    const search = page.getByTestId("published-realizations-search");
    await search.focus();
    await expect(search).toBeFocused();
    await search.fill("table");
    await expect(page.getByTestId("published-realization")).toHaveCount(1);
    await expect(page.getByTestId("published-realization-description")).toContainText("Table");

    await search.fill("pottery");
    await expect(page.getByTestId("published-realization-description")).toHaveText("Bol émaillé");

    await search.fill("zzzz-absent");
    await expect(page.getByTestId("published-realizations-no-results")).toHaveText(
      "No realizations match your search."
    );
    await expect(page.getByTestId("published-realizations-empty")).toHaveCount(0);
    await expect(page.getByTestId("published-realizations-error")).toHaveCount(0);

    await search.fill("");
    await page.getByTestId("published-realizations-category").selectOption(CLAY.id);
    await expect(page.getByTestId("published-realization")).toHaveCount(1);
    await expect(page.getByTestId("published-realization-domain")).toHaveText("Pottery");
    expect(calls.some((call) => call.url.includes(`domainId=${CLAY.id}`))).toBe(true);
    expect(calls.some((call) => call.url.includes("q=pottery"))).toBe(true);
    expect(calls.every((call) => !call.authorization)).toBe(true);
    expect(ownerCalls).toEqual([]);
    await expect(page.getByRole("combobox", { name: "Status" })).toHaveCount(0);
  });

  test("stays within the viewport at desktop, tablet, and phone widths", async ({ page }) => {
    await setLocale(page, "fr");
    await mockImages(page);
    await mockDomains(page);
    await mockCatalog(page, [MULTI_PHOTO, BOWL]);

    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/realisations");
      await expect(page.getByTestId("published-realization")).toHaveCount(2);
      await expect(page.getByTestId("published-realization-description").first()).toContainText(
        "Table en bois"
      );
      await expect(page.getByTestId("published-realization-count").first()).toHaveText("4 photos");
      expect(await fitsViewport(page)).toBe(true);
    }
  });
});
