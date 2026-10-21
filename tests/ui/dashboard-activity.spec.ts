import { expect, test, type Page } from "@playwright/test";

const user = {
  token: "user-jwt-token",
  roles: ["acheteur"],
  username: "amina",
  firstName: "Amina",
};

function activity(
  id: string,
  type: string,
  title: string | null,
  createdAt: string
) {
  return {
    id,
    type,
    entityType: type === "profile.updated" ? "contributor_profile" : "realization",
    title,
    createdAt,
    userId: "should-not-render",
    email: "secret@example.com",
  };
}

async function authenticate(page: Page, locale: "fr" | "en") {
  await page.addInitScript((value) => {
    window.localStorage.setItem("sawaka-locale", value.locale);
    window.localStorage.setItem("user", JSON.stringify(value.user));
  }, { locale, user });
}

async function mockDashboard(page: Page, activities: unknown, options?: { status?: number; hold?: Promise<void> }) {
  const calls: string[] = [];
  await page.route("**/api/contributors/me**", async (route) => {
    const url = new URL(route.request().url());
    calls.push(`${url.pathname}${url.search}`);
    if (options?.hold && url.pathname.endsWith("/activity")) await options.hold;
    if (url.pathname.endsWith("/api/contributors/me/activity")) {
      await route.fulfill({
        status: options?.status ?? 200,
        contentType: "application/json",
        body: JSON.stringify(options?.status && options.status !== 200 ? { error: { code: "SERVER_ERROR" } } : { activities }),
      });
      return;
    }
    if (url.pathname.endsWith("/realizations")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ realizations: [] }),
      });
      return;
    }
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "CONTRIBUTOR_PROFILE_NOT_FOUND" } }),
    });
  });
  return calls;
}

test.describe("Contributor recent activity", () => {
  test("shows the newest activities in French and English without a false empty state", async ({ page }) => {
    const now = Date.now();
    const activities = [
      activity("new", "realization.published", "Table basse", new Date(now - 5 * 60 * 1000).toISOString()),
      activity("edit", "realization.edited", "Table basse", new Date(now - 2 * 60 * 60 * 1000).toISOString()),
      activity("draft", "realization.moved_to_draft", "Table basse", new Date(now - 24 * 60 * 60 * 1000).toISOString()),
      activity("gone", "realization.deleted", null, new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString()),
      activity("profile", "profile.updated", null, new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString()),
      activity("extra", "realization.created", "Extra", new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString()),
    ];
    let release: () => void = () => {};
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    await authenticate(page, "fr");
    const calls = await mockDashboard(page, activities, { hold });
    await page.goto("/dashboard");

    await expect(page.getByTestId("dashboard-activity-loading")).toBeVisible();
    await expect(page.getByTestId("dashboard-activity-empty")).toHaveCount(0);
    await expect(page.getByTestId("dashboard-summary-cards")).toBeVisible();
    await expect(page.getByTestId("dashboard-badges")).toBeVisible();
    release();

    const items = page.getByTestId("dashboard-activity-item");
    await expect(items).toHaveCount(5);
    await expect(items.nth(0)).toContainText("Réalisation « Table basse » publiée");
    await expect(items.nth(0).locator("time")).toContainText(/il y a 5.+minutes/);
    await expect(items.nth(1)).toContainText("Réalisation « Table basse » modifiée");
    await expect(items.nth(2)).toContainText("Réalisation « Table basse » remise en brouillon");
    await expect(items.nth(2).locator("time")).toHaveText("hier");
    await expect(items.nth(3)).toContainText("Une réalisation a été supprimée");
    await expect(items.nth(4)).toContainText("Profil contributeur mis à jour");
    await expect(page.getByText("secret@example.com")).toHaveCount(0);
    await expect(page.getByTestId("dashboard-activity-history")).toBeDisabled();
    expect(calls.some((url) => url.includes("ownerId"))).toBe(false);

    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(items.nth(0)).toContainText("Realization “Table basse” published");
    await expect(items.nth(0).locator("time")).toHaveText("5 minutes ago");
    await expect(items.nth(1).locator("time")).toHaveText("2 hours ago");
    await expect(items.nth(2).locator("time")).toHaveText("yesterday");
    await expect(items.nth(3)).toContainText("A realization was deleted");
    await expect(items.nth(4)).toContainText("Contributor profile updated");

    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(overflow).toBe(false);
      await expect(page.getByTestId("dashboard-activity-list")).toBeVisible();
      await expect(page.getByTestId("dashboard-badges")).toBeVisible();
    }
  });

  test("shows the empty copy only after a successful response with no events", async ({ page }) => {
    await authenticate(page, "fr");
    await mockDashboard(page, []);
    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard-activity-empty")).toHaveText(
      "Aucune activité récente pour le moment."
    );
    await expect(page.getByTestId("dashboard-activity-error")).toHaveCount(0);
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.getByTestId("dashboard-activity-empty")).toHaveText("No recent activity yet.");
  });

  test("keeps the rest of the dashboard when activity cannot be loaded", async ({ page }) => {
    await authenticate(page, "en");
    await mockDashboard(page, [], { status: 500 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard-activity-error")).toHaveText("Recent activity is unavailable.");
    await expect(page.getByTestId("dashboard-activity-empty")).toHaveCount(0);
    await expect(page.getByTestId("dashboard-summary-cards")).toBeVisible();
    await expect(page.getByTestId("dashboard-summary-projects-value")).toHaveText("0");
    await expect(page.getByTestId("dashboard-badges-empty")).toBeVisible();
    await expect(page.getByTestId("user-dashboard")).toBeVisible();
  });
});
