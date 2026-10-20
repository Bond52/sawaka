import { expect, test, type Page, type Route } from "@playwright/test";

type Item = {
  id: string;
  sequence: number;
  title: string;
  description: string;
  domainId: string | null;
  completedOn: string | null;
  mainMaterial: string;
  status: "draft" | "published";
  images: { url: string }[];
};

const domains = [
  { id: "domain-wood", nameFR: "Menuiserie", nameEN: "Woodwork" },
  { id: "domain-metal", nameFR: "Ferronnerie", nameEN: "Metalwork" },
];

function item(partial: Partial<Item> & Pick<Item, "id" | "status" | "sequence">): Item {
  return {
    title: "",
    description: "",
    domainId: null,
    completedOn: null,
    mainMaterial: "",
    images: [{ url: "https://images.example/photo.jpg" }],
    ...partial,
  };
}

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

async function mockOwner(page: Page, seed: Item[]) {
  const items = seed.map((entry) => ({ ...entry, images: entry.images.map((image) => ({ ...image })) }));
  const patches: Record<string, unknown>[] = [];
  const publicHits: string[] = [];

  await page.route("**/api/realizations**", async (route) => {
    publicHits.push(route.request().url());
    await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });

  await page.route("**/api/contributors/domains", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ domains }),
    });
  });

  await page.route("**/api/contributors/me/realizations/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    expect(url.searchParams.has("ownerId")).toBe(false);
    expect(route.request().headers().authorization).toBe("Bearer user-jwt-token");
    const match = url.pathname.match(/\/realizations\/([^/]+)$/);
    if (!match || method === "POST") {
      await route.fallback();
      return;
    }
    const id = decodeURIComponent(match[1]);
    const current = items.find((entry) => entry.id === id);
    if (!current) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "NOT_FOUND" } }),
      });
      return;
    }
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ realization: current }),
      });
      return;
    }
    if (method === "PATCH") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      patches.push(body);
      expect(body.ownerId).toBeUndefined();
      expect(body.status).toBeUndefined();
      expect(body.images).toBeUndefined();
      if (typeof body.title === "string" && body.title.length > 120) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "VALIDATION_ERROR", fields: { title: "TITLE_TOO_LONG" } } }),
        });
        return;
      }
      current.title = String(body.title ?? "");
      current.description = String(body.description ?? "");
      current.domainId = typeof body.domainId === "string" ? body.domainId : null;
      current.completedOn = typeof body.completedOn === "string" ? body.completedOn : null;
      current.mainMaterial = String(body.mainMaterial ?? "");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ realization: current }),
      });
      return;
    }
    if (method === "DELETE") {
      const index = items.findIndex((entry) => entry.id === id);
      items.splice(index, 1);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ deleted: true }),
      });
      return;
    }
    await route.fallback();
  });

  await page.route("**/api/contributors/me/realizations", async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.endsWith("/api/contributors/me/realizations")) {
      await route.fallback();
      return;
    }
    expect(url.searchParams.has("ownerId")).toBe(false);
    expect(route.request().headers().authorization).toBe("Bearer user-jwt-token");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ realizations: items }),
    });
  });

  return { items, patches, publicHits };
}

async function openPortfolio(page: Page, locale: "fr" | "en") {
  await setLocale(page, locale);
  await page.goto("/vendeur/articles");
  await page.getByRole("button", { name: locale === "fr" ? "FR" : "EN", exact: true }).click();
}

async function swipeLightbox(page: Page, direction: "next" | "previous") {
  await page.getByTestId("portfolio-preview-lightbox").evaluate((element, dir) => {
    const startX = dir === "next" ? 280 : 80;
    const endX = dir === "next" ? 80 : 280;
    const emit = (type: "touchstart" | "touchend", clientX: number) => {
      const touch = new Touch({ identifier: 1, target: element, clientX, clientY: 240 });
      element.dispatchEvent(
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          touches: type === "touchstart" ? [touch] : [],
          changedTouches: [touch],
        })
      );
    };
    emit("touchstart", startX);
    emit("touchend", endX);
  }, direction);
}

const draft = item({
  id: "draft-1",
  sequence: 1,
  status: "draft",
  title: "Banc",
  description: "Brouillon secret",
  domainId: "domain-wood",
  completedOn: "2024-05-01",
  mainMaterial: "Noyer",
  images: [
    { url: "https://images.example/a1.jpg" },
    { url: "https://images.example/a2.jpg" },
    { url: "https://images.example/a3.jpg" },
  ],
});

const published = item({
  id: "live-1",
  sequence: 2,
  status: "published",
  title: "Table basse",
  description: "Chaise en noyer",
  domainId: "domain-wood",
  completedOn: "2024-06-02",
  mainMaterial: "Chêne",
  images: [
    { url: "https://images.example/b1.jpg" },
    { url: "https://images.example/b2.jpg" },
  ],
});

test.describe("Owner edit and preview on My Realizations", () => {
  test("shows edit, preview, and delete beside the lifecycle action", async ({ page }) => {
    await authenticate(page);
    await mockOwner(page, [draft, published, item({ id: "empty", sequence: 3, status: "draft", description: "Sans photo", images: [] })]);
    await openPortfolio(page, "fr");

    const draftCard = page.getByTestId("portfolio-card").filter({ hasText: "Banc" });
    await expect(draftCard.getByTestId("portfolio-publish")).toHaveText("Publier");
    await expect(draftCard.getByTestId("portfolio-edit")).toHaveText("Modifier");
    await expect(draftCard.getByTestId("portfolio-edit")).toHaveAttribute("href", "/vendeur/articles/draft-1");
    await expect(draftCard.getByTestId("portfolio-preview")).toHaveText("Aperçu");
    await expect(draftCard.getByTestId("portfolio-preview")).not.toHaveAttribute("aria-disabled", "true");
    await expect(draftCard.getByTestId("portfolio-delete")).toHaveText("Supprimer");
    await expect(draftCard.getByTestId("portfolio-move-draft")).toHaveCount(0);

    const liveCard = page.getByTestId("portfolio-card").filter({ hasText: "Table basse" });
    await expect(liveCard.getByTestId("portfolio-move-draft")).toHaveText("Mettre en brouillon");
    await expect(liveCard.getByTestId("portfolio-edit")).toBeVisible();
    await expect(liveCard.getByTestId("portfolio-preview")).toBeVisible();
    await expect(liveCard.getByTestId("portfolio-delete")).toBeVisible();
    await expect(liveCard.getByTestId("portfolio-publish")).toHaveCount(0);

    const emptyCard = page.getByTestId("portfolio-card").filter({ hasText: "Sans photo" });
    await expect(emptyCard.getByTestId("portfolio-preview")).toHaveAttribute("aria-disabled", "true");
    await emptyCard.getByTestId("portfolio-preview").click({ force: true });
    await expect(page.getByTestId("portfolio-preview-lightbox")).toHaveCount(0);

    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(draftCard.getByTestId("portfolio-edit")).toHaveText("Edit");
    await expect(draftCard.getByTestId("portfolio-preview")).toHaveText("Preview");
    await expect(draftCard.getByTestId("portfolio-delete")).toHaveText("Delete");
    await expect(liveCard.getByTestId("portfolio-move-draft")).toHaveText("Move to Draft");

    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(overflow).toBe(false);
      await expect(draftCard.getByTestId("portfolio-edit")).toBeVisible();
      await expect(liveCard.getByTestId("portfolio-preview")).toBeVisible();
    }
  });

  test("edits a draft and keeps it a draft", async ({ page }) => {
    await authenticate(page);
    const state = await mockOwner(page, [draft]);
    await openPortfolio(page, "en");
    await page.getByTestId("portfolio-edit").click();
    await expect(page).toHaveURL(/\/vendeur\/articles\/draft-1$/);
    await expect(page.getByTestId("portfolio-edit-status")).toHaveAttribute("data-status", "draft");
    await expect(page.getByTestId("portfolio-edit-title")).toHaveValue("Banc");
    await expect(page.getByTestId("portfolio-edit-description")).toHaveValue("Brouillon secret");
    await expect(page.getByTestId("portfolio-edit-domain")).toHaveValue("domain-wood");
    await expect(page.getByTestId("portfolio-edit-completed")).toHaveValue("2024-05-01");
    await expect(page.getByTestId("portfolio-edit-material")).toHaveValue("Noyer");
    await expect(page.getByTestId("portfolio-edit-photo")).toHaveCount(3);
    await expect(page.locator("input[type='file']")).toHaveCount(0);

    await page.getByTestId("portfolio-edit-title").fill("x".repeat(121));
    await page.getByTestId("portfolio-edit-save").click();
    await expect(page.getByTestId("portfolio-edit-field-error")).toHaveText("The title is too long.");
    await expect(page.getByTestId("portfolio-edit-title")).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(/\/vendeur\/articles\/draft-1$/);

    await page.getByTestId("portfolio-edit-title").fill("Banc d'entrée");
    await page.getByTestId("portfolio-edit-description").fill("Assise en chêne");
    await page.getByTestId("portfolio-edit-domain").selectOption("domain-metal");
    await page.getByTestId("portfolio-edit-completed").fill("2025-02-03");
    await page.getByTestId("portfolio-edit-material").fill("Chêne");
    await page.getByTestId("portfolio-edit-save").click();

    await expect(page).toHaveURL(/\/vendeur\/articles$/);
    await expect(page.getByRole("heading", { name: "Banc d'entrée" })).toBeVisible();
    const card = page.getByTestId("portfolio-card");
    await expect(card).toHaveAttribute("data-status", "draft");
    await expect(card.getByTestId("portfolio-publish")).toBeVisible();
    await expect(card.getByTestId("portfolio-move-draft")).toHaveCount(0);
    expect(state.patches.at(-1)).toMatchObject({
      title: "Banc d'entrée",
      description: "Assise en chêne",
      domainId: "domain-metal",
      completedOn: "2025-02-03",
      mainMaterial: "Chêne",
    });
    expect(state.publicHits).toEqual([]);
    expect(state.items[0].status).toBe("draft");
    expect(state.items[0].images.map((image) => image.url)).toEqual([
      "https://images.example/a1.jpg",
      "https://images.example/a2.jpg",
      "https://images.example/a3.jpg",
    ]);
  });

  test("edits a published realization without returning it to draft", async ({ page }) => {
    await authenticate(page);
    const state = await mockOwner(page, [published]);
    await openPortfolio(page, "fr");
    await page.getByTestId("portfolio-edit").click();
    await expect(page.getByTestId("portfolio-edit-status")).toHaveAttribute("data-status", "published");
    await expect(page.getByRole("heading", { name: "Modifier la réalisation" })).toBeVisible();
    await page.getByTestId("portfolio-edit-title").fill("Console murale");
    await page.getByTestId("portfolio-edit-description").fill("Acier brossé");
    await page.getByTestId("portfolio-edit-domain").selectOption("domain-metal");
    await page.getByTestId("portfolio-edit-completed").fill("2023-11-09");
    await page.getByTestId("portfolio-edit-material").fill("Acier");
    await page.getByTestId("portfolio-edit-save").click();
    await expect(page.getByRole("heading", { name: "Console murale" })).toBeVisible();
    const card = page.getByTestId("portfolio-card");
    await expect(card).toHaveAttribute("data-status", "published");
    await expect(card.getByTestId("portfolio-move-draft")).toBeVisible();
    await expect(card.getByTestId("portfolio-publish")).toHaveCount(0);
    expect(state.items[0].status).toBe("published");
    expect(state.patches[0]).not.toHaveProperty("status");
  });

  test("cancel leaves the realization unchanged and an unknown id stays private", async ({ page }) => {
    await authenticate(page);
    const state = await mockOwner(page, [draft]);
    await openPortfolio(page, "en");
    await page.getByTestId("portfolio-edit").click();
    await page.getByTestId("portfolio-edit-title").fill("Ne pas enregistrer");
    await page.getByTestId("portfolio-edit-cancel").click();
    await expect(page.getByRole("heading", { name: "Banc" })).toBeVisible();
    expect(state.patches).toEqual([]);

    await page.goto("/vendeur/articles/missing-id");
    await expect(page.getByTestId("portfolio-edit-not-found")).toBeVisible();
    await expect(page.getByText("This realization is not available.")).toBeVisible();

    for (const width of [1280, 768, 390]) {
      await page.goto("/vendeur/articles/draft-1");
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByTestId("portfolio-edit-save")).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(overflow).toBe(false);
    }
  });

  test("previews a draft in the owner lightbox without publishing it", async ({ page }) => {
    await authenticate(page);
    const state = await mockOwner(page, [draft, published]);
    await openPortfolio(page, "fr");
    const draftCard = page.getByTestId("portfolio-card").filter({ hasText: "Banc" });
    const preview = draftCard.getByTestId("portfolio-preview");
    await preview.click();
    const dialog = page.getByTestId("portfolio-preview-lightbox");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(page.getByTestId("portfolio-preview-position")).toHaveText("1 / 3");
    await expect(dialog.locator("img")).toHaveAttribute("src", "https://images.example/a1.jpg");
    await expect(page).toHaveURL(/\/vendeur\/articles$/);
    expect(state.publicHits).toEqual([]);
    expect(state.items.find((entry) => entry.id === "draft-1")?.status).toBe("draft");

    await page.getByTestId("portfolio-preview-next").click();
    await expect(dialog.locator("img")).toHaveAttribute("src", "https://images.example/a2.jpg");
    await page.keyboard.press("ArrowRight");
    await expect(dialog.locator("img")).toHaveAttribute("src", "https://images.example/a3.jpg");
    await page.keyboard.press("ArrowLeft");
    await expect(dialog.locator("img")).toHaveAttribute("src", "https://images.example/a2.jpg");
    await swipeLightbox(page, "next");
    await expect(dialog.locator("img")).toHaveAttribute("src", "https://images.example/a3.jpg");
    await expect(dialog.locator("img")).toHaveCount(1);
    await expect(page.locator("img")).not.toHaveAttribute("src", "https://images.example/b1.jpg");

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(preview).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
    await expect(draftCard).toHaveAttribute("data-status", "draft");
    expect(state.publicHits).toEqual([]);

    await page.setViewportSize({ width: 390, height: 800 });
    await preview.click();
    await expect(page.getByTestId("portfolio-preview-lightbox")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(overflow).toBe(false);
    await page.getByTestId("portfolio-preview-close").click();
  });

  test("previews a published realization in the same viewer and a single image has no arrows", async ({ page }) => {
    await authenticate(page);
    const single = item({
      id: "one",
      sequence: 3,
      status: "published",
      title: "Lampe",
      images: [{ url: "https://images.example/only.jpg" }],
    });
    const state = await mockOwner(page, [published, single]);
    await openPortfolio(page, "en");

    const liveCard = page.getByTestId("portfolio-card").filter({ hasText: "Table basse" });
    await liveCard.getByTestId("portfolio-preview").click();
    await expect(page.getByTestId("portfolio-preview-position")).toHaveText("1 / 2");
    await expect(page.getByTestId("portfolio-preview-lightbox").locator("img")).toHaveAttribute(
      "src",
      "https://images.example/b1.jpg"
    );
    await page.getByTestId("portfolio-preview-next").click();
    await expect(page.getByTestId("portfolio-preview-lightbox").locator("img")).toHaveAttribute(
      "src",
      "https://images.example/b2.jpg"
    );
    await page.keyboard.press("Escape");
    expect(state.publicHits).toEqual([]);
    await expect(page).toHaveURL(/\/vendeur\/articles$/);

    const oneCard = page.getByTestId("portfolio-card").filter({ hasText: "Lampe" });
    await oneCard.getByTestId("portfolio-preview").click();
    await expect(page.getByTestId("portfolio-preview-position")).toHaveText("1 / 1");
    await expect(page.getByTestId("portfolio-preview-previous")).toHaveCount(0);
    await expect(page.getByTestId("portfolio-preview-next")).toHaveCount(0);
    await page.getByTestId("portfolio-preview-close").click();
    await expect(page.getByTestId("portfolio-preview-lightbox")).toHaveCount(0);
    await expect(oneCard.getByTestId("portfolio-preview")).toBeFocused();
  });

  test("still deletes through the existing confirmation dialog", async ({ page }) => {
    await authenticate(page);
    await mockOwner(page, [draft]);
    await openPortfolio(page, "fr");
    await page.getByTestId("portfolio-delete").click();
    await expect(page.getByTestId("portfolio-delete-dialog")).toHaveCount(1);
    await expect(page.getByTestId("portfolio-delete-dialog")).toContainText("Supprimer cette réalisation ?");
    await page.getByTestId("portfolio-delete-cancel").click();
    await expect(page.getByTestId("portfolio-card")).toHaveCount(1);
    await page.getByTestId("portfolio-delete").click();
    await page.getByTestId("portfolio-delete-confirm").click();
    await expect(page.getByTestId("portfolio-card")).toHaveCount(0);
    await expect(page.getByTestId("portfolio-lifecycle-status")).toHaveText("La réalisation a été supprimée.");
  });
});
