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

async function mockValidation(page: Page) {
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
}

async function importPhotos(page: Page, names: string[]) {
  await page.goto("/realizations/import");
  await page.getByTestId("portfolio-file-input").setInputFiles(
    names.map((name) => ({ name, mimeType: "image/jpeg", buffer: jpeg }))
  );
  await page.getByTestId("portfolio-import-continue").click();
  await expect(page).toHaveURL(/\/realizations\/organize/);
  await expect(page.getByTestId("portfolio-imported-panel")).toBeVisible();
}

test.describe("Organize imported photos", () => {
  test("an unauthenticated visit is sent to login", async ({ page }) => {
    await page.goto("/realizations/organize");
    await expect(page).toHaveURL(/\/login\?redirect=\/realizations\/organize/);
  });

  test("a visit without imported photos shows a recovery state", async ({ page }) => {
    await authenticate(page);
    await page.goto("/realizations/organize");
    await page.getByRole("button", { name: "FR", exact: true }).click();
    await expect(page.getByTestId("portfolio-organize-recovery")).toBeVisible();
    await expect(page.getByTestId("portfolio-photo-grid")).toHaveCount(0);
    await expect(page.getByTestId("portfolio-organize-back")).toHaveAttribute("href", "/realizations/import");
  });

  test("French grouping, corrections, navigation, and refresh recovery", async ({ page }) => {
    await authenticate(page);
    await mockValidation(page);
    await importPhotos(page, ["chair-1.jpg", "chair-2.jpg", "chair-3.jpg", "chair-4.jpg"]);
    await page.getByRole("button", { name: "FR", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Organiser vos photos" })).toBeVisible();
    await expect(page.getByText("Photos importées")).toBeVisible();
    await expect(page.getByTestId("portfolio-unassigned-count")).toHaveText("4 non classées");
    await expect(page.getByTestId("portfolio-groups-empty")).toContainText("Aucun groupe");
    await expect(page.getByText("Sauvegarde automatique")).toHaveCount(0);
    await expect(page.getByLabel("Titre")).toHaveCount(0);
    await expect(page.locator("[aria-current='step']")).toContainText("Organiser");

    const first = page.getByRole("button", { name: "Sélectionner chair-1.jpg" });
    const second = page.getByRole("button", { name: "Sélectionner chair-2.jpg" });
    await first.focus();
    await expect(first).toBeFocused();
    await first.press("Enter");
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await second.click();
    await expect(page.getByTestId("portfolio-organize-selected-count")).toHaveText("2 sélectionnées");
    await first.click();
    await expect(first).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("portfolio-organize-selected-count")).toHaveText("1 sélectionnée");

    await page.getByTestId("portfolio-select-all").click();
    await expect(page.getByTestId("portfolio-photo")).toHaveCount(4);
    for (const name of ["chair-1.jpg", "chair-2.jpg", "chair-3.jpg", "chair-4.jpg"]) {
      await expect(page.getByRole("button", { name: `Sélectionner ${name}` })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    }
    await expect(page.getByTestId("portfolio-select-all")).toHaveText("Retirer la sélection");
    await page.getByTestId("portfolio-select-all").click();
    await expect(first).toHaveAttribute("aria-pressed", "false");

    await page.getByTestId("portfolio-select-all").click();
    await page.getByTestId("portfolio-group-one").click();
    await expect(page.getByTestId("portfolio-group")).toHaveCount(1);
    await expect(page.getByTestId("portfolio-groups-summary")).toHaveText("1 groupe · 4 photos");
    await expect(page.getByTestId("portfolio-unassigned-count")).toHaveText("0 non classées");
    await expect(page.getByRole("heading", { name: "Réalisation 1" })).toBeVisible();

    const group = page.getByTestId("portfolio-group");
    await group.getByTestId("portfolio-group-actions").click();
    await group.getByRole("button", { name: "Retirer chair-4.jpg du groupe" }).click();
    await expect(page.getByTestId("portfolio-unassigned-count")).toHaveText("1 non classée");
    await expect(group).toContainText("3 photos");

    await group.getByTestId("portfolio-dissolve").click();
    await expect(page.getByTestId("portfolio-groups-empty")).toBeVisible();
    await expect(page.getByTestId("portfolio-unassigned-count")).toHaveText("4 non classées");

    await page.getByTestId("portfolio-select-all").click();
    await page.getByTestId("portfolio-group-each").click();
    await expect(page.getByTestId("portfolio-group")).toHaveCount(4);
    await expect(page.getByTestId("portfolio-groups-summary")).toHaveText("4 groupes · 4 photos");

    await page.getByTestId("portfolio-organize-back").click();
    await expect(page).toHaveURL(/\/realizations\/import/);
    await expect(page.getByTestId("portfolio-selected-count")).toHaveText("4 photos sélectionnées");
    await page.getByTestId("portfolio-import-continue").click();
    await expect(page.getByTestId("portfolio-group")).toHaveCount(4);

    await page.getByTestId("portfolio-organize-continue").click();
    await expect(page).toHaveURL(/\/realizations\/complete/);
    await page.getByTestId("portfolio-complete-back").click();
    await expect(page).toHaveURL(/\/realizations\/organize/);
    await expect(page.getByTestId("portfolio-group")).toHaveCount(4);

    await page.reload();
    await expect(page.getByTestId("portfolio-organize-recovery")).toBeVisible();
    await expect(page.getByTestId("portfolio-photo-grid")).toHaveCount(0);
  });

  test("English labels, removal, adding to a group, and responsive layout", async ({ page }) => {
    await authenticate(page);
    await mockValidation(page);
    await importPhotos(page, ["chair.jpg", "gate.jpg", "table.jpg"]);
    await page.getByRole("button", { name: "EN", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Organize your photos" })).toBeVisible();
    await expect(page.getByText("Imported photos")).toBeVisible();
    await expect(page.getByText("Realizations created")).toBeVisible();
    await expect(page.getByTestId("portfolio-group-one")).toHaveText(/Group into one realization/);
    await expect(page.getByTestId("portfolio-group-each")).toHaveText("1 realization per photo");
    await expect(page.getByTestId("portfolio-groups-empty")).toContainText("No groups");
    await expect(page.getByText("Auto-save")).toHaveCount(0);

    const chair = page.getByRole("button", { name: "Select chair.jpg" });
    await chair.focus();
    await expect(chair).toBeFocused();
    await chair.press("Space");
    await expect(chair).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("portfolio-remove-selected").click();
    await expect(page.getByRole("button", { name: "Select chair.jpg" })).toHaveCount(0);
    await expect(page.getByTestId("portfolio-unassigned-count")).toHaveText("2 unassigned");

    await page.getByRole("button", { name: "Select gate.jpg" }).click();
    await page.getByTestId("portfolio-group-one").click();
    await page.getByRole("button", { name: "Select table.jpg" }).click();
    await page.getByTestId("portfolio-group").getByTestId("portfolio-group-actions").click();
    await page.getByTestId("portfolio-add-to-group").click();
    await expect(page.getByTestId("portfolio-groups-summary")).toHaveText("1 group · 2 photos");
    await expect(page.getByTestId("portfolio-unassigned-count")).toHaveText("0 unassigned");

    await page.getByTestId("portfolio-new-group").click();
    await expect(page.getByTestId("portfolio-group")).toHaveCount(2);
    await expect(page.getByTestId("portfolio-groups-summary")).toHaveText("2 groups · 2 photos");

    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(overflow).toBe(false);
      const photos = await page.getByTestId("portfolio-imported-panel").boundingBox();
      const groups = await page.getByTestId("portfolio-created-panel").boundingBox();
      expect(photos).not.toBeNull();
      expect(groups).not.toBeNull();
      if (width >= 1024) {
        expect(groups!.x).toBeGreaterThan(photos!.x + photos!.width - 8);
      } else {
        expect(groups!.y).toBeGreaterThan(photos!.y + photos!.height - 8);
      }
    }
  });
});
