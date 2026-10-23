import { expect, test, type Page } from "@playwright/test";

async function setLocale(page: Page, locale: "fr" | "en") {
  await page.addInitScript((value) => {
    window.localStorage.setItem("sawaka-locale", value);
  }, locale);
}

async function mockPublicLists(page: Page) {
  await page.route("**/api/suppliers**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.route("**/api/contributors**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    if (path.endsWith("/domains")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ domains: [] }),
      });
      return;
    }
    if (path.endsWith("/api/contributors/me")) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "CONTRIBUTOR_PROFILE_NOT_FOUND" },
        }),
      });
      return;
    }
    if (path.endsWith("/contributors")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ profiles: [] }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  await page.route("**/api/realizations**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    });
  });
}

async function assertNoHorizontalOverflow(page: Page) {
  const fits = await page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth + 1
  );
  expect(fits).toBe(true);
}

async function assertHeaderBand(page: Page) {
  const band = page.getByTestId("public-page-header");
  await expect(band).toBeVisible();
  await expect(band).toHaveClass(/border-b/);
  await expect(band).toHaveClass(/border-border/);
  await expect(band).toHaveClass(/bg-card/);
  await expect(band.locator(":scope > .wrap")).toHaveClass(/py-8/);
  await expect(band.locator(":scope > .wrap")).toHaveClass(/lg:py-12/);
}

test.describe("Public page header presentation", () => {
  test("removes the registration subtitle in French and English", async ({
    page,
  }) => {
    await mockPublicLists(page);

    await setLocale(page, "fr");
    await page.goto("/contributor/create");
    await expect(page.getByTestId("contributor-create-title")).toHaveText(
      "Créer un profil contributeur"
    );
    await expect(
      page.getByText(
        "Votre compte Sawaka et votre profil contributeur public restent distincts."
      )
    ).toHaveCount(0);
    await expect(page.getByText("Compte Sawaka", { exact: true })).toBeVisible();
    await expect(page.getByTestId("contributor-create-form")).toBeVisible();
    await assertHeaderBand(page);

    await setLocale(page, "en");
    await page.goto("/contributor/create");
    await expect(page.getByTestId("contributor-create-title")).toHaveText(
      "Create a contributor profile"
    );
    await expect(
      page.getByText(
        "Your Sawaka account and your public contributor profile stay separate."
      )
    ).toHaveCount(0);
    await expect(page.getByText("Sawaka account", { exact: true })).toBeVisible();
  });

  test("applies the supplier white header band on public content pages", async ({
    page,
  }) => {
    await setLocale(page, "fr");
    await mockPublicLists(page);

    await page.goto("/realisations");
    await expect(page.getByRole("heading", { name: "Réalisations" })).toBeVisible();
    await expect(
      page.getByText("Travaux publiés par les contributeurs.")
    ).toBeVisible();
    await assertHeaderBand(page);
    await expect(page.getByTestId("published-realizations-search")).toBeVisible();

    await page.goto("/projets");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await assertHeaderBand(page);

    await page.goto("/contributor/create");
    await assertHeaderBand(page);
    await expect(page.getByTestId("contributor-create-form")).toBeVisible();

    await page.goto("/fournisseurs");
    const supplierBand = page
      .locator("div.border-b.border-border.bg-card")
      .filter({ has: page.getByTestId("supplier-directory-title") });
    await expect(supplierBand).toBeVisible();
    await expect(supplierBand.locator(":scope > .wrap")).toHaveClass(/py-8/);
    await expect(supplierBand.locator(":scope > .wrap")).toHaveClass(/lg:py-12/);
    await expect(page.getByTestId("public-page-header")).toHaveCount(0);
    await expect(page.getByTestId("supplier-directory-title")).toHaveText(
      "Fournisseurs"
    );

    await page.goto("/");
    await expect(page.getByTestId("public-page-header")).toHaveCount(0);
  });

  test("starts the network directory at search without a heading or empty band", async ({
    page,
  }) => {
    await setLocale(page, "fr");
    await mockPublicLists(page);
    await page.goto("/reseau");

    await expect(page.getByRole("heading", { name: "Artisans" })).toHaveCount(0);
    await expect(page.getByTestId("public-page-header")).toHaveCount(0);
    await expect(page.getByTestId("contributor-directory-search")).toBeVisible();
    await expect(page.getByTestId("contributor-directory-filters")).toBeVisible();
    await expect(page.getByTestId("contributor-directory")).toHaveClass(/wrap/);
    await expect(page.getByTestId("contributor-directory")).toHaveClass(/py-8/);
  });

  test("fits registration, suppliers, realizations, projects, and network at 1280, 768, and 390", async ({
    page,
  }) => {
    await setLocale(page, "fr");
    await mockPublicLists(page);

    const paths = [
      "/contributor/create",
      "/fournisseurs",
      "/realisations",
      "/projets",
      "/reseau",
    ];

    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of paths) {
        await page.goto(path);
        await assertNoHorizontalOverflow(page);
      }
    }
  });
});
