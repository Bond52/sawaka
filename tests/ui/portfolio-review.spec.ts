import { expect, test, type Page } from "@playwright/test";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]);

async function authenticate(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "user",
      JSON.stringify({ token: "user-jwt-token", roles: ["acheteur"], username: "amina", firstName: "Amina" })
    );
  });
}

async function mockApis(page: Page) {
  await page.route("**/api/contributors/me/import-photos/validate", async (route) => {
    const body = route.request().postDataBuffer()?.toString("latin1") || "";
    const names: string[] = [];
    const pattern = /filename="([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(body))) names.push(match[1]);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accepted: names.map((name, index) => ({ index, name, size: 16 })),
        rejected: [],
      }),
    });
  });
  await page.route("**/api/contributors/domains", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        domains: [{ id: "wood", nameFR: "Bois", nameEN: "Wood" }],
      }),
    });
  });
}

async function importPhotos(page: Page, names: string[]) {
  await page.goto("/realizations/import");
  await page.getByTestId("portfolio-file-input").setInputFiles(
    names.map((name) => ({ name, mimeType: "image/jpeg", buffer: jpeg }))
  );
  await page.getByTestId("portfolio-import-continue").click();
  await expect(page).toHaveURL(/\/realizations\/organize/);
}

test.describe("Review bulk realizations", () => {
  test("an unauthenticated visit is sent to login", async ({ page }) => {
    await page.goto("/realizations/review");
    await expect(page).toHaveURL(/\/login\?redirect=\/realizations\/review/);
  });

  test("a visit without imported photos shows a recovery state", async ({ page }) => {
    await authenticate(page);
    await page.goto("/realizations/review");
    await expect(page.getByTestId("portfolio-review-recovery")).toBeVisible();
    await expect(page.getByTestId("portfolio-review-publish")).toHaveCount(0);
  });

  test("French review counts, partial publish, and return to complete", async ({ page }) => {
    await authenticate(page);
    await mockApis(page);
    let publishedBody = "";
    await page.route("**/api/contributors/me/realizations", async (route) => {
      publishedBody = route.request().postDataBuffer()?.toString("utf8") || "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          outcome: "success",
          publishedCount: 2,
          draftCount: 1,
          failedCount: 0,
          items: [],
        }),
      });
    });

    await importPhotos(page, ["chair-1.jpg", "chair-2.jpg", "chair-3.jpg", "gate.jpg"]);
    await page.getByRole("button", { name: "FR", exact: true }).click();
    for (const name of ["chair-1.jpg", "chair-2.jpg", "chair-3.jpg"]) {
      await page.getByRole("button", { name: `Sélectionner ${name}` }).click();
    }
    await page.getByTestId("portfolio-group-one").click();
    await page.getByRole("button", { name: "Sélectionner gate.jpg" }).click();
    await page.getByTestId("portfolio-group-one").click();
    await page.getByTestId("portfolio-new-group").click();
    await page.getByTestId("portfolio-organize-continue").click();
    await page.getByTestId("portfolio-complete-description").fill("");
    await page.getByTestId("portfolio-complete-continue").click();

    await expect(page).toHaveURL(/\/realizations\/review/);
    await expect(page.getByRole("heading", { name: "Vérifier les réalisations" })).toBeVisible();
    await expect(page.getByText("Un dernier coup d'œil avant de mettre votre travail en ligne.")).toBeVisible();
    await expect(page.locator("[aria-current='step']")).toContainText("Vérifier");
    await expect(page.getByTestId("portfolio-review-realization-count")).toHaveText("3 réalisations");
    await expect(page.getByTestId("portfolio-review-photo-count")).toHaveText("4 photos");
    await expect(page.getByTestId("portfolio-review-ready-count")).toHaveText("2 prêtes à publier");
    await expect(page.getByTestId("portfolio-review-incomplete-count")).toHaveText("1 incomplète");
    await expect(page.getByTestId("portfolio-review-ready")).toHaveCount(2);
    await expect(page.getByTestId("portfolio-review-ready").first()).toContainText("chair-1.jpg");
    await expect(page.getByTestId("portfolio-review-ready").first()).toContainText("chair-3.jpg");
    await expect(page.getByRole("heading", { name: "Prêtes à publier" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Restent en brouillon" })).toBeVisible();
    await expect(page.getByTestId("portfolio-review-missing")).toContainText("Cette réalisation n'a pas de photo.");
    await expect(page.getByLabel("Titre")).toHaveCount(0);

    await page.getByTestId("portfolio-review-complete").click();
    await expect(page).toHaveURL(/\/realizations\/complete\?group=/);
    await expect(page.getByTestId("portfolio-complete-status")).toHaveText("Incomplète");
    await page.getByTestId("portfolio-complete-continue").click();
    await expect(page.getByTestId("portfolio-review-incomplete")).toHaveCount(1);

    const publish = page.getByTestId("portfolio-review-publish");
    await expect(publish).toHaveText("Publier les 2 éléments prêts");
    await publish.focus();
    await expect(publish).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/realizations\/confirmation/);
    await expect(page.getByRole("heading", { name: "Vos réalisations ont été publiées." })).toBeVisible();
    await expect(page.getByTestId("portfolio-confirmation-published-count")).toHaveText("2");
    await expect(page.getByTestId("portfolio-confirmation-draft-count")).toHaveText("1");
    expect(publishedBody).toContain("publish-ready");

    await page.getByTestId("portfolio-confirmation-portfolio").click();
    await expect(page).toHaveURL(/\/vendeur\/articles/);
  });

  test("English draft save, disabled publish, and responsive layout", async ({ page }) => {
    await authenticate(page);
    await mockApis(page);
    let intent = "";
    await page.route("**/api/contributors/me/realizations", async (route) => {
      intent = route.request().postDataBuffer()?.toString("utf8") || "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          outcome: "success",
          publishedCount: 0,
          draftCount: 1,
          failedCount: 0,
          items: [],
        }),
      });
    });

    await importPhotos(page, ["chair.jpg"]);
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.getByTestId("portfolio-new-group").click();
    await page.getByTestId("portfolio-organize-continue").click();
    await page.getByTestId("portfolio-complete-continue").click();

    await expect(page.getByRole("heading", { name: "Review realizations" })).toBeVisible();
    await expect(page.getByText("One last look before your work goes online.")).toBeVisible();
    await expect(page.getByTestId("portfolio-review-realization-count")).toHaveText("1 realization");
    await expect(page.getByTestId("portfolio-review-photo-count")).toHaveText("0 photos");
    await expect(page.getByTestId("portfolio-review-ready-count")).toHaveText("0 ready to publish");
    await expect(page.getByTestId("portfolio-review-incomplete-count")).toHaveText("1 incomplete");
    await expect(page.getByRole("heading", { name: "Ready to Publish" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Remain as Drafts" })).toBeVisible();
    await expect(page.getByTestId("portfolio-review-missing")).toContainText("This realization has no photo.");
    await expect(page.getByTestId("portfolio-review-publish")).toBeDisabled();

    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(overflow).toBe(false);
      const summary = await page.getByTestId("portfolio-review-summary").boundingBox();
      const saveBox = await page.getByTestId("portfolio-review-save-drafts").boundingBox();
      expect(summary).not.toBeNull();
      expect(saveBox).not.toBeNull();
      expect(saveBox!.y).toBeGreaterThan(summary!.y);
    }

    const save = page.getByTestId("portfolio-review-save-drafts");
    await save.focus();
    await expect(save).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/realizations\/confirmation/);
    await expect(page.getByRole("heading", { name: "Your realizations were saved as drafts." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your realizations have been published." })).toHaveCount(0);
    await expect(page.getByTestId("portfolio-confirmation-published-count")).toHaveText("0");
    await expect(page.getByTestId("portfolio-confirmation-draft-count")).toHaveText("1");
    expect(intent).toContain("save-drafts");
    expect(intent).not.toContain("publish-ready");
  });
});
