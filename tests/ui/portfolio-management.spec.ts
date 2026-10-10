import { expect, test, type Page } from "@playwright/test";

async function setLocale(page: Page, locale: "fr" | "en") {
  await page.addInitScript((value) => {
    window.localStorage.setItem("sawaka-locale", value);
  }, locale);
}

async function openPortfolio(page: Page, locale: "fr" | "en") {
  await setLocale(page, locale);
  await page.route("**/api/contributors/domains", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        domains: [
          { id: "domain-1", nameFR: "Menuiserie", nameEN: "Woodwork" },
        ],
      }),
    });
  });
  await page.goto("/vendeur/articles");
  await page.getByRole("button", { name: locale === "fr" ? "FR" : "EN", exact: true }).click();
}

test.describe("My Realizations portfolio page", () => {
  test("French portfolio page replaces the product inventory", async ({ page }) => {
    let articleCalls = 0;
    await page.route("**/api/seller/articles**", async (route) => {
      articleCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], total: 0, page: 1, pages: 1 }),
      });
    });
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
    await expect(page.getByTestId("portfolio-status")).toContainText("Publié");
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
    expect(articleCalls).toBe(0);
  });

  test("English labels, keyboard access, and list toggle", async ({ page }) => {
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

  test("portfolio page has no horizontal overflow", async ({ page }) => {
    await openPortfolio(page, "fr");
    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({ width, height: 800 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(overflow).toBe(false);
    }
  });
});
