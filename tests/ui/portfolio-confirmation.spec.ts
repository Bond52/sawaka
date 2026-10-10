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

async function mockApis(page: Page, body: Record<string, unknown>) {
  await page.route("**/api/contributors/me/import-photos/validate", async (route) => {
    const raw = route.request().postDataBuffer()?.toString("latin1") || "";
    const names: string[] = [];
    const pattern = /filename="([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(raw))) names.push(match[1]);
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
      body: JSON.stringify({ domains: [{ id: "wood", nameFR: "Bois", nameEN: "Wood" }] }),
    });
  });
  await page.route("**/api/contributors/me/realizations", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

async function publishOne(page: Page) {
  await page.goto("/realizations/import");
  await page.getByTestId("portfolio-file-input").setInputFiles({
    name: "chair.jpg",
    mimeType: "image/jpeg",
    buffer: jpeg,
  });
  await page.getByTestId("portfolio-import-continue").click();
  await page.getByRole("button", { name: "Select chair.jpg" }).click();
  await page.getByTestId("portfolio-group-one").click();
  await page.getByTestId("portfolio-organize-continue").click();
  await page.getByTestId("portfolio-complete-continue").click();
  await page.getByTestId("portfolio-review-publish").click();
}

test.describe("Publication confirmation", () => {
  test("an unauthenticated visit is sent to login", async ({ page }) => {
    await page.goto("/realizations/confirmation");
    await expect(page).toHaveURL(/\/login\?redirect=\/realizations\/confirmation/);
  });

  test("a direct visit without a result does not show success", async ({ page }) => {
    await authenticate(page);
    await page.goto("/realizations/confirmation");
    await expect(page).toHaveURL(/\/vendeur\/articles/);
    await expect(page.getByRole("heading", { name: "Your realizations have been published." })).toHaveCount(0);
    await expect(page.getByText("15")).toHaveCount(0);
    await expect(page.getByText("3")).toHaveCount(0);
  });

  test("published-only counts, navigation, refresh, and layout", async ({ page }) => {
    await authenticate(page);
    let publishCalls = 0;
    await mockApis(page, {
      outcome: "success",
      publishedCount: 1,
      draftCount: 0,
      failedCount: 0,
      items: [],
    });
    await page.route("**/api/contributors/me/realizations", async (route) => {
      publishCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          outcome: "success",
          publishedCount: 1,
          draftCount: 0,
          failedCount: 0,
          items: [],
        }),
      });
    });

    await page.goto("/realizations/import");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await publishOne(page);

    await expect(page).toHaveURL(/\/realizations\/confirmation/);
    await expect(page.getByTestId("portfolio-confirmation-eyebrow")).toHaveText("PUBLICATION COMPLETE");
    await expect(page.getByRole("heading", { name: "Your realizations have been published." })).toBeVisible();
    await expect(page.getByText("Your portfolio is up to date. Published realizations appear in the public Realizations tab of your profile.")).toBeVisible();
    await expect(page.getByTestId("portfolio-confirmation-published-count")).toHaveText("1");
    await expect(page.getByTestId("portfolio-confirmation-published-label")).toHaveText("realization published");
    await expect(page.getByTestId("portfolio-confirmation-draft-count")).toHaveText("0");
    await expect(page.getByTestId("portfolio-confirmation-draft-label")).toHaveText("saved as drafts");
    await expect(page.getByTestId("portfolio-confirmation-privacy")).toContainText(
      "Only published realizations are visible."
    );
    await expect(page.getByTestId("portfolio-confirmation-privacy")).toContainText(
      "Your drafts stay private until they are published."
    );
    await expect(page.getByText("15")).toHaveCount(0);
    expect(publishCalls).toBe(1);

    const portfolio = page.getByTestId("portfolio-confirmation-portfolio");
    await portfolio.focus();
    await expect(portfolio).toBeFocused();

    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(overflow).toBe(false);
      const published = await page.getByTestId("portfolio-confirmation-published-count").boundingBox();
      const drafts = await page.getByTestId("portfolio-confirmation-draft-count").boundingBox();
      expect(published).not.toBeNull();
      expect(drafts).not.toBeNull();
      if (width >= 640) {
        expect(drafts!.x).toBeGreaterThan(published!.x);
      } else {
        expect(drafts!.y).toBeGreaterThan(published!.y);
      }
    }

    await page.reload();
    await expect(page).toHaveURL(/\/vendeur\/articles/);
    await expect(page.getByRole("heading", { name: "Your realizations have been published." })).toHaveCount(0);
    expect(publishCalls).toBe(1);

    await page.goto("/realizations/import");
    await page.getByTestId("portfolio-file-input").setInputFiles({
      name: "chair.jpg",
      mimeType: "image/jpeg",
      buffer: jpeg,
    });
    await page.getByTestId("portfolio-import-continue").click();
    await page.getByRole("button", { name: "Select chair.jpg" }).click();
    await page.getByTestId("portfolio-group-one").click();
    await page.getByTestId("portfolio-organize-continue").click();
    await page.getByTestId("portfolio-complete-continue").click();
    await page.getByTestId("portfolio-review-publish").click();
    await expect(page).toHaveURL(/\/realizations\/confirmation/);
    await page.getByTestId("portfolio-confirmation-add").focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/realizations\/import/);
    expect(publishCalls).toBe(2);
  });
});
