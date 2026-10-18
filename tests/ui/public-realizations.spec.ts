import { expect, test, type Page, type Route } from "@playwright/test";

const PROFILE_ID = "111111111111111111111111";
const DOMAIN = {
  id: "domain-wood",
  nameFR: "Menuiserie",
  nameEN: "Carpentry",
};

const PROFILE = {
  id: PROFILE_ID,
  displayName: "Wilson M.",
  biography: "Je conçois du mobilier en bois local.",
  country: "Cameroun",
  region: "Littoral",
  city: "Douala",
  domain: DOMAIN,
  skills: [
    {
      id: "skill-1",
      nameFR: "Fabrication de meubles",
      nameEN: "Furniture making",
      isCustom: false,
    },
  ],
  photoUrl: null,
  status: "Active",
  isVisible: true,
};

const LONG_DESCRIPTION =
  "Table en bois local fabriquée avec des assemblages traditionnels et une finition à l'huile. " +
  "La description reste lisible lorsqu'elle est longue, sans créer de défilement horizontal. " +
  "SupercalifragilisticexpialidociousSupercalifragilisticexpialidocious";

const MULTI_PHOTO = {
  id: "real-table",
  sequence: 2,
  description: LONG_DESCRIPTION,
  domainId: DOMAIN.id,
  completedOn: "2024-06-02",
  title: "Invented title",
  status: "published",
  images: [
    { url: "https://cdn.example/table-1.jpg", publicId: "secret-cover" },
    { url: "https://cdn.example/table-2.jpg" },
    { url: "https://cdn.example/table-3.jpg" },
    { url: "https://cdn.example/table-4.jpg" },
  ],
};

const UNDATED = {
  id: "real-bowl",
  sequence: 3,
  description: "",
  domainId: "missing-domain",
  completedOn: null,
  images: [{ url: "https://cdn.example/bowl.jpg" }],
};

const DRAFT = {
  id: "real-draft",
  sequence: 1,
  description: "Brouillon secret",
  domainId: null,
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

async function mockProfile(page: Page) {
  await page.route(`**/api/contributors/${PROFILE_ID}`, async (route: Route) => {
    if (new URL(route.request().url()).pathname.endsWith("/realizations")) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ profile: PROFILE }),
    });
  });
  await page.route("**/api/contributors/me", async (route: Route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ profile: PROFILE }),
    });
  });
  await page.route("**/api/contributors/domains", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ domains: [DOMAIN] }),
    });
  });
}

async function mockRealizations(
  page: Page,
  realizations: unknown,
  options?: { status?: number; hold?: Promise<void>; failTimes?: number }
) {
  const calls: string[] = [];
  let attempts = 0;
  await page.route("**/api/contributors/*/realizations", async (route: Route) => {
    const url = route.request().url();
    calls.push(url);
    if (url.includes("/me/realizations")) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "OWNER_ENDPOINT" } }),
      });
      return;
    }
    attempts += 1;
    if (options?.hold && attempts === 1) await options.hold;
    if (options?.failTimes && attempts <= options.failTimes) {
      await route.fulfill({
        status: options.status ?? 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "SERVER_ERROR" } }),
      });
      return;
    }
    await route.fulfill({
      status: options?.status && !options.failTimes ? options.status : 200,
      contentType: "application/json",
      body: JSON.stringify({ realizations }),
    });
  });
  return calls;
}

async function fitsViewport(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
  );
}

test.describe("Public contributor realizations", () => {
  test("shows the public empty state when nothing is published", async ({ page }) => {
    await setLocale(page, "fr");
    await mockImages(page);
    await mockProfile(page);
    const calls = await mockRealizations(page, [DRAFT]);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/contributors/${PROFILE_ID}`);

    await expect(page.getByTestId("contributor-profile-realizations-empty")).toHaveText(
      "Aucune réalisation publiée pour le moment."
    );
    await expect(page.getByText("Brouillon secret")).toHaveCount(0);
    await expect(page.getByTestId("contributor-profile-realization")).toHaveCount(0);
    await expect(page.getByTestId("contributor-profile-realizations-error")).toHaveCount(0);
    expect(calls.some((url) => url.includes("/me/realizations"))).toBe(false);
    expect(calls.some((url) => url.endsWith(`/contributors/${PROFILE_ID}/realizations`))).toBe(
      true
    );

    await setLocale(page, "en");
    await page.goto(`/contributors/${PROFILE_ID}`);
    await expect(page.getByTestId("contributor-profile-realizations-empty")).toHaveText(
      "No realizations published yet."
    );
    await expect(page.getByTestId("contributor-profile-tab-collaborations")).toHaveText(
      "Collaborations"
    );
    await expect(page.getByTestId("contributor-profile-badges")).toBeVisible();
    await expect(page.getByTestId("contributor-profile-reviews")).toBeVisible();
    await expect(page.getByTestId("contributor-profile-edit")).toHaveCount(0);
  });

  test("renders published realizations as one card per realization", async ({ page }) => {
    await setLocale(page, "en");
    await mockImages(page);
    await mockProfile(page);
    await mockRealizations(page, [DRAFT, MULTI_PHOTO, UNDATED]);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/contributors/${PROFILE_ID}`);

    const cards = page.getByTestId("contributor-profile-realization");
    await expect(cards).toHaveCount(2);
    await expect(page.getByText("Brouillon secret")).toHaveCount(0);
    await expect(page.getByText("Invented title")).toHaveCount(0);
    await expect(cards.nth(0).getByRole("heading")).toHaveCount(0);
    await expect(cards.nth(0).getByRole("link")).toHaveCount(0);
    await expect(cards.nth(0).getByTestId("contributor-profile-realization-image")).toHaveCount(1);
    await expect(cards.nth(0).getByTestId("contributor-profile-realization-image")).toHaveAttribute(
      "alt",
      "Photo of a published realization, 4 photos"
    );
    await expect(cards.nth(0).getByTestId("contributor-profile-realization-count")).toHaveText(
      "4 photos"
    );
    await expect(cards.nth(0).getByTestId("contributor-profile-realization-domain")).toHaveText(
      "Carpentry"
    );
    await expect(cards.nth(0).getByTestId("contributor-profile-realization-description")).toContainText(
      "Table en bois local"
    );
    await expect(cards.nth(0).getByTestId("contributor-profile-realization-date")).toContainText(
      "Completed"
    );
    await expect(cards.nth(0).getByTestId("contributor-profile-realization-date")).toContainText(
      "2024"
    );
    await expect(cards.nth(1).getByTestId("contributor-profile-realization-domain")).toHaveCount(0);
    await expect(cards.nth(1).getByTestId("contributor-profile-realization-date")).toHaveCount(0);
    await expect(cards.nth(1).getByTestId("contributor-profile-realization-description")).toHaveCount(
      0
    );
    await expect(cards.nth(1).getByTestId("contributor-profile-realization-count")).toHaveText(
      "1 photo"
    );
    await expect(cards.nth(1).getByTestId("contributor-profile-realization-image")).toHaveAttribute(
      "alt",
      "Photo of a published realization"
    );
    await expect(page.getByTestId("contributor-profile-realizations").getByRole("list")).toBeVisible();
    await expect(page.getByTestId("contributor-profile-skills")).toBeVisible();
    await expect(page.getByTestId("contributor-profile-collaborations")).toBeHidden();
    expect(await fitsViewport(page)).toBe(true);
  });

  test("uses French labels for the populated public tab", async ({ page }) => {
    await setLocale(page, "fr");
    await mockImages(page);
    await mockProfile(page);
    await mockRealizations(page, [MULTI_PHOTO]);
    await page.goto(`/contributors/${PROFILE_ID}`);

    await expect(page.getByTestId("contributor-profile-tab-realizations")).toHaveText(
      "Réalisations"
    );
    const card = page.getByTestId("contributor-profile-realization");
    await expect(card.getByTestId("contributor-profile-realization-domain")).toHaveText(
      "Menuiserie"
    );
    await expect(card.getByTestId("contributor-profile-realization-count")).toHaveText("4 photos");
    await expect(card.getByTestId("contributor-profile-realization-date")).toContainText(
      "Terminée le"
    );
    await expect(card.getByTestId("contributor-profile-realization-image")).toHaveAttribute(
      "alt",
      "Photo d'une réalisation publiée, 4 photos"
    );
  });

  test("keeps loading, error, and empty states distinct", async ({ page }) => {
    await setLocale(page, "en");
    await mockImages(page);
    await mockProfile(page);
    let release = () => {};
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    await mockRealizations(page, [MULTI_PHOTO], { hold, failTimes: 1 });
    await page.goto(`/contributors/${PROFILE_ID}`);

    await expect(page.getByTestId("contributor-profile-realizations-loading")).toHaveText(
      "Loading realizations…"
    );
    await expect(page.getByTestId("contributor-profile-realizations-empty")).toHaveCount(0);
    await expect(page.getByTestId("contributor-profile-realizations-error")).toHaveCount(0);
    release();

    const alert = page.getByTestId("contributor-profile-realizations-error");
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText(/Published realizations could not be loaded/);
    await expect(page.getByTestId("contributor-profile-realizations-empty")).toHaveCount(0);
    await expect(page.getByTestId("contributor-profile-realization")).toHaveCount(0);

    const retry = page.getByTestId("contributor-profile-realizations-retry");
    await retry.focus();
    await expect(retry).toBeFocused();
    await expect(retry).toHaveText("Try again");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("contributor-profile-realization")).toHaveCount(1);
    await expect(page.getByTestId("contributor-profile-realizations-error")).toHaveCount(0);
  });

  test("shows only published realizations on the owner's consultation profile", async ({
    page,
  }) => {
    await setLocale(page, "en");
    await mockImages(page);
    await seedUser(page);
    await mockProfile(page);
    const calls = await mockRealizations(page, [DRAFT, MULTI_PHOTO]);
    await page.goto("/profile");

    await expect(page.getByTestId("contributor-profile-edit")).toBeVisible();
    await expect(page.getByTestId("contributor-profile-deactivate-open")).toBeVisible();
    await expect(page.getByTestId("contributor-profile-realization")).toHaveCount(1);
    await expect(page.getByText("Brouillon secret")).toHaveCount(0);
    await expect(page.getByTestId("contributor-profile-collaborations")).toBeHidden();
    await page.getByTestId("contributor-profile-tab-collaborations").click();
    await expect(page.getByTestId("contributor-profile-collaborations-empty")).toBeVisible();
    await expect(page.getByTestId("contributor-profile-realizations")).toBeHidden();
    await expect(page.getByTestId("contributor-profile-reviews")).toBeVisible();
    expect(calls.some((url) => url.includes("/me/realizations"))).toBe(false);
  });

  test("stays usable at desktop, tablet, and phone widths", async ({ page }) => {
    await setLocale(page, "fr");
    await mockImages(page);
    await mockProfile(page);
    await mockRealizations(page, [MULTI_PHOTO, UNDATED]);

    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/contributors/${PROFILE_ID}`);
      await expect(page.getByTestId("contributor-profile-realization")).toHaveCount(2);
      await expect(page.getByTestId("contributor-profile-realization-description")).toContainText(
        LONG_DESCRIPTION.slice(0, 40)
      );
      await expect(page.getByTestId("contributor-profile-tab-realizations")).toBeVisible();
      expect(await fitsViewport(page)).toBe(true);
    }
  });
});
