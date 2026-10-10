import { expect, test, type Page } from "@playwright/test";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

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
    const rejected = [];
    const names: string[] = [];
    const pattern = /filename="([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(body))) names.push(match[1]);
    names.forEach((name, index) => {
      if (name.endsWith(".svg") || name.endsWith(".txt")) {
        rejected.push({ index, name, code: "UNSUPPORTED_IMAGE_TYPE" });
      } else {
        accepted.push({ index, name, size: 16 });
      }
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accepted, rejected }),
    });
  });
}

test.describe("Bulk realization photo selection", () => {
  test("an unauthenticated visit is sent to login", async ({ page }) => {
    await page.goto("/realizations/import");
    await expect(page).toHaveURL(/\/login\?redirect=\/realizations\/import/);
  });

  test("French page selects valid photos and reports invalid ones", async ({ page }) => {
    await authenticate(page);
    await mockValidation(page);
    await page.goto("/realizations/import");
    await page.getByRole("button", { name: "FR", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Ajouter des réalisations" })).toBeVisible();
    await expect(page.getByText("Déposez vos photos ici")).toBeVisible();
    await expect(page.getByText("JPG, PNG ou WEBP · 2 Mo maximum par photo")).toBeVisible();
    await expect(page.getByText("Astuce")).toBeVisible();
    await expect(page.getByTestId("portfolio-import-single")).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByTestId("portfolio-import-bulk")).toHaveAttribute("aria-current", "step");

    const select = page.getByTestId("portfolio-select-photos");
    await select.focus();
    await expect(select).toBeFocused();

    await page.getByTestId("portfolio-file-input").setInputFiles([
      { name: "chair.jpg", mimeType: "image/jpeg", buffer: jpeg },
      { name: "gate.png", mimeType: "image/png", buffer: png },
      { name: "icon.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg></svg>") },
    ]);

    await expect(page.getByTestId("portfolio-selected-count")).toHaveText("2 photos sélectionnées");
    await expect(page.getByTestId("portfolio-import-errors")).toContainText(
      "icon.svg n'est pas une image JPG, PNG ou WEBP."
    );
    await expect(page.getByText("Prix")).toHaveCount(0);
  });

  test("English labels, oversized file, drag-and-drop, and no horizontal overflow", async ({ page }) => {
    await authenticate(page);
    let validateCalls = 0;
    await page.route("**/api/contributors/me/import-photos/validate", async (route) => {
      validateCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accepted: [{ index: 0, name: "dropped.jpg", size: 12 }], rejected: [] }),
      });
    });
    await page.goto("/realizations/import");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Add realizations" })).toBeVisible();
    await expect(page.getByText("JPG, PNG or WEBP · 2 MB maximum per photo")).toBeVisible();

    const oversized = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(2 * 1024 * 1024)]);
    await page.getByTestId("portfolio-file-input").setInputFiles({
      name: "huge.jpg",
      mimeType: "image/jpeg",
      buffer: oversized,
    });
    await expect(page.getByTestId("portfolio-import-errors")).toContainText("huge.jpg is over 2 MB.");
    expect(validateCalls).toBe(0);

    await page.getByTestId("portfolio-dropzone").evaluate((zone) => {
      const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0, 1, 2, 3, 4, 5, 6, 7, 8]);
      const file = new File([bytes], "dropped.jpg", { type: "image/jpeg" });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      zone.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer }));
      zone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    });
    await expect(page.getByTestId("portfolio-selected-count")).toHaveText("1 photo selected");

    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(overflow).toBe(false);
    }
  });
});
