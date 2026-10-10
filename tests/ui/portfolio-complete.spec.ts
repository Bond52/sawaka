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
    const accepted = [];
    const names: string[] = [];
    const pattern = /filename="([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(body))) names.push(match[1]);
    names.forEach((name, index) => accepted.push({ index, name, size: 16 }));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accepted, rejected: [] }),
    });
  });
  await page.route("**/api/contributors/domains", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        domains: [
          { id: "wood", nameFR: "Bois", nameEN: "Wood" },
          { id: "metal", nameFR: "Métal", nameEN: "Metal" },
        ],
      }),
    });
  });
}

async function importAndOpenComplete(page: Page, names: string[]) {
  await page.goto("/realizations/import");
  await page.getByTestId("portfolio-file-input").setInputFiles(
    names.map((name) => ({ name, mimeType: "image/jpeg", buffer: jpeg }))
  );
  await page.getByTestId("portfolio-import-continue").click();
  await expect(page).toHaveURL(/\/realizations\/organize/);
}

test.describe("Complete realization metadata", () => {
  test("an unauthenticated visit is sent to login", async ({ page }) => {
    await page.goto("/realizations/complete");
    await expect(page).toHaveURL(/\/login\?redirect=\/realizations\/complete/);
  });

  test("a visit without imported photos shows a recovery state", async ({ page }) => {
    await authenticate(page);
    await page.goto("/realizations/complete");
    await expect(page.getByTestId("portfolio-complete-recovery")).toBeVisible();
    await expect(page.getByTestId("portfolio-complete-editor")).toHaveCount(0);
  });

  test("French details stay with each group and continue does not open review", async ({ page }) => {
    await authenticate(page);
    await mockApis(page);
    await importAndOpenComplete(page, ["chair-1.jpg", "chair-2.jpg", "chair-3.jpg", "gate.jpg"]);
    await page.getByRole("button", { name: "FR", exact: true }).click();

    for (const name of ["chair-1.jpg", "chair-2.jpg", "chair-3.jpg"]) {
      await page.getByRole("button", { name: `Sélectionner ${name}` }).click();
    }
    await page.getByTestId("portfolio-group-one").click();
    await page.getByRole("button", { name: "Sélectionner gate.jpg" }).click();
    await page.getByTestId("portfolio-group-one").click();
    await page.getByTestId("portfolio-new-group").click();
    await page.getByTestId("portfolio-organize-continue").click();
    await expect(page).toHaveURL(/\/realizations\/complete/);

    await expect(page.getByRole("heading", { name: "Compléter les détails" })).toBeVisible();
    await expect(page.getByLabel("Description")).toBeVisible();
    await expect(page.getByLabel("Métier ou catégorie")).toBeVisible();
    await expect(page.getByLabel("Date d'achèvement")).toBeVisible();
    await expect(page.getByLabel("Titre")).toHaveCount(0);
    await expect(page.getByLabel("Projet")).toHaveCount(0);
    await expect(page.getByText("Sauvegarde automatique")).toHaveCount(0);
    await expect(page.locator("[aria-current='step']")).toContainText("Compléter");

    const groups = page.getByTestId("portfolio-complete-group");
    await expect(groups).toHaveCount(3);
    await expect(groups.nth(0)).toContainText("3 photos");
    await expect(groups.nth(0)).toContainText("Prête");
    await expect(groups.nth(2)).toContainText("Incomplète");
    await expect(page.getByTestId("portfolio-complete-photos")).toContainText("chair-1.jpg");
    await expect(page.getByTestId("portfolio-complete-photos")).toContainText("chair-3.jpg");

    const description = page.getByTestId("portfolio-complete-description");
    await description.focus();
    await expect(description).toBeFocused();
    await description.fill("Chaise sculptée");
    await page.getByTestId("portfolio-complete-category").selectOption("wood");
    await page.getByTestId("portfolio-complete-date").fill("2024-05-01");
    await expect(page.getByTestId("portfolio-complete-status")).toHaveText("Prête");

    await page.getByTestId("portfolio-complete-next").click();
    await expect(page.getByTestId("portfolio-complete-description")).toHaveValue("");
    await page.getByTestId("portfolio-complete-description").fill("Portail");
    await page.getByTestId("portfolio-complete-previous").click();
    await expect(page.getByTestId("portfolio-complete-description")).toHaveValue("Chaise sculptée");
    await expect(page.getByTestId("portfolio-complete-category")).toHaveValue("wood");
    await expect(page.getByTestId("portfolio-complete-date")).toHaveValue("2024-05-01");

    await description.fill("");
    await page.getByTestId("portfolio-complete-category").selectOption("");
    await page.getByTestId("portfolio-complete-date").fill("");
    await expect(page.getByTestId("portfolio-complete-status")).toHaveText("Prête");

    await description.fill("x".repeat(2001));
    await expect(page.getByText("La description dépasse 2000 caractères.")).toBeVisible();
    await expect(page.getByTestId("portfolio-complete-status")).toHaveText("Prête");

    await page.getByTestId("portfolio-complete-continue").click();
    await expect(page).toHaveURL(/\/realizations\/complete/);
    await expect(page.getByTestId("portfolio-complete-review-pending")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Vérifier les réalisations" })).toHaveCount(0);
    await expect(page.getByText("Publier")).toHaveCount(0);

    await page.getByTestId("portfolio-complete-back").click();
    await expect(page).toHaveURL(/\/realizations\/organize/);
    await expect(page.getByTestId("portfolio-group")).toHaveCount(3);
  });

  test("English labels, blank optional fields, and responsive layout", async ({ page }) => {
    await authenticate(page);
    await mockApis(page);
    await importAndOpenComplete(page, ["chair.jpg"]);
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.getByRole("button", { name: "Select chair.jpg" }).click();
    await page.getByTestId("portfolio-group-one").click();
    await page.getByTestId("portfolio-organize-continue").click();

    await expect(page.getByRole("heading", { name: "Complete the details" })).toBeVisible();
    await expect(page.getByLabel("Description")).toBeVisible();
    await expect(page.getByLabel("Craft or category")).toBeVisible();
    await expect(page.getByLabel("Completion date")).toBeVisible();
    await expect(page.getByTestId("portfolio-complete-status")).toHaveText("Ready");
    await expect(page.getByText("Auto-save")).toHaveCount(0);
    await expect(page.getByTestId("portfolio-complete-description")).toHaveValue("");
    await expect(page.getByTestId("portfolio-complete-category")).toHaveValue("");
    await expect(page.getByTestId("portfolio-complete-date")).toHaveValue("");

    const description = page.getByTestId("portfolio-complete-description");
    await description.focus();
    await expect(description).toBeFocused();
    await page.keyboard.type("Solar gate");
    await expect(description).toHaveValue("Solar gate");

    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(overflow).toBe(false);
      const list = await page.getByRole("region", { name: "Realizations" }).boundingBox();
      const editor = await page.getByTestId("portfolio-complete-editor").boundingBox();
      expect(list).not.toBeNull();
      expect(editor).not.toBeNull();
      if (width >= 1024) {
        expect(editor!.x).toBeGreaterThan(list!.x + list!.width - 8);
      } else {
        expect(editor!.y).toBeGreaterThan(list!.y + list!.height - 8);
      }
    }
  });
});
