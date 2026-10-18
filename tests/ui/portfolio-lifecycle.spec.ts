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

async function mockPortfolio(page: Page, seed: Item[], options?: { cleanupFails?: boolean }) {
  const items = seed.map((entry) => ({ ...entry, images: [...entry.images] }));
  const mutations: { method: string; id: string; action: string }[] = [];

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
    const match = url.pathname.match(/\/realizations\/([^/]+)(?:\/(publish|draft))?$/);
    expect(url.searchParams.has("ownerId")).toBe(false);
    expect(route.request().headers().authorization).toBe("Bearer user-jwt-token");
    if (!match) {
      await route.fallback();
      return;
    }
    const id = decodeURIComponent(match[1]);
    const action = match[2] || (method === "DELETE" ? "delete" : "");
    mutations.push({ method, id, action });
    const current = items.find((entry) => entry.id === id);
    if (!current) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "NOT_FOUND" } }),
      });
      return;
    }
    if (action === "publish") {
      if (current.status === "published") {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "ALREADY_PUBLISHED" } }),
        });
        return;
      }
      if (current.images.length === 0) {
        await route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "NOT_READY", fields: { images: "REQUIRED" } } }),
        });
        return;
      }
      current.status = "published";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ realization: current }),
      });
      return;
    }
    if (action === "draft") {
      if (current.status === "draft") {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "ALREADY_DRAFT" } }),
        });
        return;
      }
      current.status = "draft";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ realization: current }),
      });
      return;
    }
    if (method === "DELETE") {
      if (options?.cleanupFails) {
        await route.fulfill({
          status: 502,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "IMAGE_CLEANUP_FAILED", fields: { images: "CLEANUP_FAILED" } } }),
        });
        return;
      }
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
    expect(url.pathname.endsWith("/api/contributors/me/realizations")).toBe(true);
    expect(route.request().headers().authorization).toBe("Bearer user-jwt-token");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ realizations: items }),
    });
  });

  return { mutations, items };
}

async function openPortfolio(page: Page, locale: "fr" | "en") {
  await setLocale(page, locale);
  await page.goto("/vendeur/articles");
  await page.getByRole("button", { name: locale === "fr" ? "FR" : "EN", exact: true }).click();
}

test.describe("Realization lifecycle on My Realizations", () => {
  test("shows publish or move-to-draft from the saved status, in French and English", async ({ page }) => {
    await authenticate(page);
    const titled = item({
      id: "titled",
      sequence: 1,
      status: "published",
      title: "Table basse",
      description: "Chaise en noyer",
      domainId: "domain-wood",
      mainMaterial: "Noyer",
      completedOn: "2024-05-01",
    });
    const draft = item({
      id: "draft",
      sequence: 2,
      status: "draft",
      description: "Brouillon secret",
      images: [{ url: "https://images.example/draft.jpg" }],
    });
    const plain = item({
      id: "plain",
      sequence: 3,
      status: "published",
      domainId: "domain-metal",
      description: "",
    });
    await mockPortfolio(page, [titled, draft, plain]);
    await openPortfolio(page, "fr");

    await expect(page.getByRole("heading", { name: "Table basse" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Brouillon secret" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ferronnerie" })).toBeVisible();
    await expect(page.getByText("Réalisation #")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Archiver" })).toHaveCount(0);

    const draftCard = page.getByTestId("portfolio-card").filter({ hasText: "Brouillon secret" });
    await expect(draftCard.getByTestId("portfolio-publish")).toHaveText("Publier");
    await expect(draftCard.getByTestId("portfolio-delete")).toHaveText("Supprimer");
    await expect(draftCard.getByTestId("portfolio-move-draft")).toHaveCount(0);

    const titledCard = page.getByTestId("portfolio-card").filter({ hasText: "Table basse" });
    await expect(titledCard.getByTestId("portfolio-move-draft")).toHaveText("Mettre en brouillon");
    await expect(titledCard.getByTestId("portfolio-delete")).toBeVisible();
    await expect(titledCard.getByTestId("portfolio-publish")).toHaveCount(0);

    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Table basse" })).toBeVisible();
    await expect(draftCard.getByTestId("portfolio-publish")).toHaveText("Publish");
    await expect(draftCard.getByTestId("portfolio-delete")).toHaveText("Delete");
    await expect(titledCard.getByTestId("portfolio-move-draft")).toHaveText("Move to Draft");
    await expect(page.getByRole("button", { name: "Archive" })).toHaveCount(0);

    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(overflow).toBe(false);
      await expect(draftCard.getByTestId("portfolio-publish")).toBeVisible();
      await expect(titledCard.getByTestId("portfolio-delete")).toBeVisible();
    }
  });

  test("publishes only selected drafts and reports the skipped published items", async ({ page }) => {
    await authenticate(page);
    const draft = item({
      id: "draft-1",
      sequence: 1,
      status: "draft",
      description: "Brouillon secret",
      title: "Banc",
    });
    const second = item({
      id: "draft-2",
      sequence: 2,
      status: "draft",
      description: "Second brouillon",
      images: [],
    });
    const live = item({
      id: "live",
      sequence: 3,
      status: "published",
      title: "Table basse",
      domainId: "domain-wood",
    });
    const calls = await mockPortfolio(page, [draft, second, live]);
    await openPortfolio(page, "fr");

    await page.getByRole("checkbox", { name: "Sélectionner Banc" }).check();
    await page.getByRole("checkbox", { name: "Sélectionner Second brouillon" }).check();
    await page.getByRole("checkbox", { name: "Sélectionner Table basse" }).check();
    await expect(page.getByTestId("portfolio-bulk-publish")).toBeEnabled();
    await expect(page.getByTestId("portfolio-bulk-draft")).toBeEnabled();
    await expect(page.getByRole("button", { name: "Archiver" })).toHaveCount(0);

    await page.getByTestId("portfolio-bulk-publish").click();
    await expect(page.getByTestId("portfolio-lifecycle-status")).toContainText("1 réalisation publiée.");
    await expect(page.getByTestId("portfolio-lifecycle-status")).toContainText(
      "1 sélection était déjà dans cet état."
    );
    await expect(page.getByTestId("portfolio-lifecycle-error")).toContainText(
      "Une réalisation doit contenir au moins une photo avant d'être publiée."
    );
    const publishedCard = page.getByTestId("portfolio-card").filter({ hasText: "Banc" });
    await expect(publishedCard).toHaveAttribute("data-status", "published");
    await expect(publishedCard.getByTestId("portfolio-publish")).toHaveCount(0);
    await expect(publishedCard.getByTestId("portfolio-move-draft")).toBeVisible();
    const empty = page.getByTestId("portfolio-card").filter({ hasText: "Second brouillon" });
    await expect(empty).toHaveAttribute("data-status", "draft");
    expect(calls.mutations.filter((entry) => entry.action === "publish").map((entry) => entry.id)).toEqual([
      "draft-1",
      "draft-2",
    ]);
    expect(calls.mutations.some((entry) => entry.id === "live" && entry.action === "publish")).toBe(false);

    await page.getByTestId("portfolio-clear-selection").click();
    await page.getByRole("checkbox", { name: "Sélectionner Banc" }).check();
    await page.getByRole("checkbox", { name: "Sélectionner Table basse" }).check();
    await page.getByTestId("portfolio-bulk-draft").click();
    await expect(page.getByTestId("portfolio-lifecycle-status")).toContainText("2 réalisations mises en brouillon.");
    await expect(publishedCard).toHaveAttribute("data-status", "draft");
    await expect(page.getByTestId("portfolio-card").filter({ hasText: "Table basse" })).toHaveAttribute(
      "data-status",
      "draft"
    );
  });

  test("confirms deletion from the keyboard and keeps the card when cleanup fails", async ({ page }) => {
    await authenticate(page);
    const draft = item({
      id: "draft",
      sequence: 1,
      status: "draft",
      description: "Brouillon secret",
    });
    await mockPortfolio(page, [draft], { cleanupFails: true });
    await openPortfolio(page, "en");

    const remove = page.getByTestId("portfolio-delete");
    await remove.focus();
    await expect(remove).toBeFocused();
    await page.keyboard.press("Enter");
    const dialog = page.getByTestId("portfolio-delete-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(page.getByTestId("portfolio-delete-cancel")).toBeFocused();
    await expect(dialog).toContainText("Delete this realization?");
    await expect(dialog).toContainText("This action cannot be undone.");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(remove).toBeFocused();

    await remove.click();
    await page.getByTestId("portfolio-delete-confirm").click();
    await expect(page.getByTestId("portfolio-delete-error")).toContainText(
      "The photos could not be removed, so the realization was kept."
    );
    await expect(page.getByTestId("portfolio-lifecycle-status")).toHaveCount(0);
    await expect(page.getByTestId("portfolio-card")).toHaveCount(1);

    await page.getByTestId("portfolio-delete-cancel").click();
    await expect(page.getByTestId("portfolio-delete-dialog")).toHaveCount(0);
  });

  test("deletes a realization only after confirmation", async ({ page }) => {
    await authenticate(page);
    const live = item({
      id: "live",
      sequence: 1,
      status: "published",
      title: "Table basse",
      domainId: "domain-wood",
      mainMaterial: "Noyer",
    });
    await mockPortfolio(page, [live]);
    await openPortfolio(page, "fr");
    await page.getByTestId("portfolio-delete").click();
    await expect(page.getByTestId("portfolio-delete-dialog")).toContainText("Supprimer cette réalisation ?");
    await expect(page.getByTestId("portfolio-delete-dialog")).toContainText("Cette action est irréversible.");
    await page.getByTestId("portfolio-delete-cancel").click();
    await expect(page.getByTestId("portfolio-card")).toHaveCount(1);

    await page.getByTestId("portfolio-delete").click();
    await page.getByTestId("portfolio-delete-confirm").click();
    await expect(page.getByTestId("portfolio-card")).toHaveCount(0);
    await expect(page.getByTestId("portfolio-lifecycle-status")).toHaveText("La réalisation a été supprimée.");
    await expect(page.getByTestId("portfolio-empty")).toBeVisible();
  });
});
