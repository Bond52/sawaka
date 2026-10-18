import { expect, test, type Page, type Route } from "@playwright/test";

const REALIZATION_ID = "507f1f77bcf86cd799439011";
const PROFILE_ID = "profile-amina";
const DOMAIN = { id: "domain-wood", nameFR: "Menuiserie", nameEN: "Carpentry" };

const IMAGES = [1, 2, 3, 4, 5].map((index) => ({ url: `https://cdn.example/photo-${index}.jpg` }));

function detailBody(options?: { images?: { url: string }[]; mainMaterial?: string | null }) {
  const realization: Record<string, unknown> = {
    id: REALIZATION_ID,
    description: "Table en chêne fabriquée à Douala.",
    domainId: DOMAIN.id,
    domain: DOMAIN,
    completedOn: "2024-03-12",
    mainMaterial: options?.mainMaterial === undefined ? "Chêne blanc" : options.mainMaterial,
    images: options?.images ?? IMAGES,
    email: "amina@example.com",
    ownerId: "user-secret",
    status: "published",
  };
  if (options?.mainMaterial === null) delete realization.mainMaterial;
  return {
    realization,
    contributor: {
      id: PROFILE_ID,
      displayName: "Amina Diallo",
      photoUrl: null,
      city: "Douala",
      region: "Littoral",
      country: "Cameroon",
      domain: DOMAIN,
      email: "amina@example.com",
      phone: "+1 555 0100",
    },
  };
}

async function setLocale(page: Page, locale: "fr" | "en") {
  await page.addInitScript((value) => {
    window.localStorage.setItem("sawaka-locale", value);
  }, locale);
}

async function seedUser(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "user",
      JSON.stringify({ token: "user-jwt-token", roles: ["acheteur"], username: "wilson" })
    );
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

async function mockDetail(
  page: Page,
  body: unknown,
  options?: { status?: number; hold?: Promise<void> }
) {
  const calls: { url: string; authorization: string | undefined }[] = [];
  const ownerCalls: string[] = [];
  await page.route("**/api/contributors/me/realizations", async (route) => {
    ownerCalls.push(route.request().url());
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "OWNER_ENDPOINT" } }),
    });
  });
  await page.route("**/api/realizations/**", async (route: Route) => {
    calls.push({
      url: route.request().url(),
      authorization: route.request().headers().authorization,
    });
    if (options?.hold) await options.hold;
    await route.fulfill({
      status: options?.status ?? 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  return { calls, ownerCalls };
}

test.beforeEach(async ({ page }) => {
  await mockImages(page);
});

test("shows a published realization without private or sample data", async ({ page }) => {
  await setLocale(page, "fr");
  await seedUser(page);
  const { calls, ownerCalls } = await mockDetail(page, detailBody());
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/realisations/${REALIZATION_ID}`);

  await expect(page.getByRole("heading", { level: 1, name: "Détail de la réalisation" })).toBeVisible();
  await expect(page.getByTestId("realization-detail-description")).toContainText("Table en chêne");
  await expect(page.getByTestId("realization-detail-badge")).toHaveText("Menuiserie");
  await expect(page.getByTestId("realization-detail-fact-domain")).toHaveText("Menuiserie");
  await expect(page.getByTestId("realization-detail-fact-material")).toHaveText("Chêne blanc");
  await expect(page.getByTestId("realization-detail-date")).toContainText("mars 2024");
  await expect(page.getByTestId("realization-detail-count")).toHaveText("5 photos");
  await expect(page.getByTestId("realization-detail-hero")).toHaveAttribute(
    "src",
    "https://cdn.example/photo-1.jpg"
  );
  await expect(page.getByTestId("realization-detail-hero")).toHaveAttribute("alt", "Photo 1 sur 5");
  await expect(page.getByTestId("realization-detail-contributor")).toHaveText("Amina Diallo");
  await expect(page.getByTestId("realization-detail-place")).toHaveText("Douala, Littoral, Cameroon");
  await expect(page.getByTestId("realization-detail-profile")).toHaveAttribute(
    "href",
    `/contributors/${PROFILE_ID}`
  );
  await expect(page.getByTestId("realization-detail-contact")).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("realization-detail-project")).toContainText(
    "Cette réalisation n'est associée à aucun projet public."
  );
  await expect(page.getByTestId("realization-detail-reviews")).toContainText(
    "Aucun avis pour cette réalisation pour le moment."
  );
  await expect(page.getByTestId("realization-detail-review-action")).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText("Jean Kouassi")).toHaveCount(0);
  await expect(page.getByText("Résidence Ottawa")).toHaveCount(0);
  await expect(page.getByText("4,8")).toHaveCount(0);
  await expect(page.getByText("4.8")).toHaveCount(0);
  await expect(page.getByText("amina@example.com")).toHaveCount(0);
  await expect(page.getByText("+1 555 0100")).toHaveCount(0);
  await expect(page.getByText("Profil contributeur vérifié")).toHaveCount(0);

  await page.getByTestId("realization-detail-thumb").nth(1).click();
  await expect(page.getByTestId("realization-detail-hero")).toHaveAttribute(
    "src",
    "https://cdn.example/photo-3.jpg"
  );
  await page.getByTestId("realization-detail-view-all").click();
  const dialog = page.getByTestId("realization-detail-lightbox");
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId("realization-detail-close")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.locator("img")).toHaveAttribute("src", "https://cdn.example/photo-4.jpg");
  await page.getByTestId("realization-detail-previous").click();
  await expect(dialog.locator("img")).toHaveAttribute("src", "https://cdn.example/photo-3.jpg");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("realization-detail-open")).toBeFocused();

  await page.getByTestId("realization-detail-contact").click({ force: true });
  await expect(page).toHaveURL(new RegExp(`/realisations/${REALIZATION_ID}$`));
  expect(ownerCalls).toEqual([]);
  expect(calls.every((call) => !call.authorization)).toBe(true);
  expect(calls.every((call) => !call.url.includes("/me/realizations"))).toBe(true);

  for (const width of [1280, 768, 390]) {
    await page.setViewportSize({ width, height: 800 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(overflow).toBe(false);
  }
});

test("does not offer gallery navigation for a single photo", async ({ page }) => {
  await setLocale(page, "en");
  await mockDetail(page, detailBody({ images: [{ url: "https://cdn.example/photo-1.jpg" }] }));
  await page.goto(`/realisations/${REALIZATION_ID}`);
  await expect(page.getByRole("heading", { name: "Realization Details" })).toBeVisible();
  await expect(page.getByTestId("realization-detail-count")).toHaveText("1 photo");
  await expect(page.getByTestId("realization-detail-view-all")).toHaveCount(0);
  await expect(page.getByTestId("realization-detail-thumb")).toHaveCount(0);
  await expect(page.getByTestId("realization-detail-lightbox")).toHaveCount(0);
  await expect(page.getByTestId("realization-detail-hero")).toHaveAttribute("alt", "Photo 1 of 1");
  await expect(page.getByTestId("realization-detail-project")).toContainText(
    "This realization is not associated with a public project."
  );
  await expect(page.getByTestId("realization-detail-reviews")).toContainText(
    "No reviews for this realization yet."
  );
});

test("omits the material row when the field is absent", async ({ page }) => {
  await setLocale(page, "fr");
  await mockDetail(page, detailBody({ mainMaterial: null, images: [{ url: "https://cdn.example/photo-1.jpg" }] }));
  await page.goto(`/realisations/${REALIZATION_ID}`);
  await expect(page.getByTestId("realization-detail-description")).toBeVisible();
  await expect(page.getByTestId("realization-detail-fact-material")).toHaveCount(0);
  await expect(page.getByTestId("realization-detail-fact-domain")).toHaveText("Menuiserie");
});

test("uses the same not-found state for a draft and an unknown id", async ({ page }) => {
  await setLocale(page, "fr");
  await mockDetail(page, { error: { code: "NOT_FOUND" }, description: "Brouillon secret" }, { status: 404 });
  await page.goto(`/realisations/${REALIZATION_ID}`);
  await expect(page.getByTestId("realization-detail-not-found")).toHaveText(
    "Cette réalisation n'est pas disponible."
  );
  await expect(page.getByTestId("realization-detail-error")).toHaveCount(0);
  await expect(page.getByText("Brouillon secret")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Détail de la réalisation" })).toHaveCount(0);
});

test("uses a stored title as the page heading and keeps the material", async ({ page }) => {
  await setLocale(page, "en");
  const body = detailBody({ images: [{ url: "https://cdn.example/photo-1.jpg" }] });
  body.realization.title = "Low table";
  await mockDetail(page, body);
  await page.goto(`/realisations/${REALIZATION_ID}`);
  await expect(page.getByTestId("realization-detail-heading")).toHaveText("Low table");
  await expect(page.getByTestId("realization-detail-fact-material")).toHaveText("Chêne blanc");
  await expect(page.getByTestId("realization-detail-hero")).toBeVisible();
  await expect(page.getByTestId("realization-detail-contributor")).toBeVisible();
  await expect(page.getByText("amina@example.com")).toHaveCount(0);
});

test("keeps a failed request distinct from an empty review state", async ({ page }) => {
  await setLocale(page, "en");
  let release = () => {};
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await mockDetail(page, { error: { code: "SERVER_ERROR" } }, { status: 500, hold });
  await page.goto(`/realisations/${REALIZATION_ID}`);
  await expect(page.getByTestId("realization-detail-loading")).toBeVisible();
  release();
  await expect(page.getByTestId("realization-detail-error")).toBeVisible();
  await expect(page.getByTestId("realization-detail-reviews")).toHaveCount(0);
  await expect(page.getByTestId("realization-detail-not-found")).toHaveCount(0);
  await expect(page.getByTestId("realization-detail-retry")).toBeVisible();
});
