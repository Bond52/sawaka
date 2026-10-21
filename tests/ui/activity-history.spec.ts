import { expect, test, type Page } from "@playwright/test";

const user = {
  token: "user-jwt-token",
  roles: ["acheteur"],
  username: "amina",
  firstName: "Amina",
};

function activity(id: string, type: string, title: string | null, createdAt: string) {
  return {
    id,
    type,
    entityType: type === "profile.updated" ? "contributor_profile" : "realization",
    title,
    createdAt,
    email: "secret@example.com",
  };
}

function historyRows() {
  const now = Date.now();
  const titled: Array<[string, string, string | null]> = [
    ["published", "realization.published", "Table basse en noyer massif avec un titre assez long"],
    ["edited", "realization.edited", "Console murale"],
    ["drafted", "realization.moved_to_draft", "Banc"],
    ["deleted", "realization.deleted", null],
    ["created", "realization.created", "Chaise"],
    ["profile", "profile.updated", null],
  ];
  const rows = titled.map(([id, type, title], index) =>
    activity(id, type, title, new Date(now - (index + 1) * 60 * 60 * 1000).toISOString())
  );
  for (let index = 0; index < 4; index += 1) {
    rows.push(
      activity(
        `piece-${index}`,
        "realization.edited",
        `Pièce ${index + 1}`,
        new Date(now - (10 + index) * 24 * 60 * 60 * 1000).toISOString()
      )
    );
  }
  rows.push(
    activity("older-one", "realization.created", "Older one", new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString()),
    activity("older-two", "realization.deleted", "Older two", new Date(now - 41 * 24 * 60 * 60 * 1000).toISOString())
  );
  return rows;
}

async function authenticate(page: Page, locale: "fr" | "en") {
  await page.addInitScript((value) => {
    window.localStorage.setItem("sawaka-locale", value.locale);
    window.localStorage.setItem("user", JSON.stringify(value.user));
  }, { locale, user });
}

async function mockActivity(
  page: Page,
  activities: unknown[],
  options?: { status?: number; hold?: Promise<void> }
) {
  const calls: string[] = [];
  await page.route("**/api/contributors/me/activity**", async (route) => {
    const url = new URL(route.request().url());
    calls.push(`${url.pathname}${url.search}`);
    if (options?.hold) await options.hold;
    if (options?.status && options.status !== 200) {
      await route.fulfill({
        status: options.status,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "SERVER_ERROR" } }),
      });
      return;
    }
    const pageNum = Number(url.searchParams.get("page") || "1");
    const limit = Number(url.searchParams.get("limit") || "10");
    const start = (pageNum - 1) * limit;
    const total = activities.length;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        activities: activities.slice(start, start + limit),
        page: pageNum,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      }),
    });
  });
  return calls;
}

test.describe("Contributor activity history", () => {
  test("redirects anonymous visitors to login", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem("user");
    });
    await page.goto("/dashboard/activity");
    await expect(page).toHaveURL(/\/login\?redirect=.*(dashboard%2Factivity|dashboard\/activity)/);
  });

  test("pages French and English history without a false empty state", async ({ page }) => {
    let release: () => void = () => {};
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    await authenticate(page, "fr");
    const calls = await mockActivity(page, historyRows(), { hold });
    await page.goto("/dashboard/activity");

    await expect(page.getByTestId("activity-history-loading")).toBeVisible();
    await expect(page.getByTestId("activity-history-empty")).toHaveCount(0);
    await expect(page.getByTestId("activity-history-pagination")).toHaveCount(0);
    release();

    await expect(page.getByTestId("activity-history-title")).toHaveText("Mon historique");
    const items = page.getByTestId("activity-history-item");
    await expect(items).toHaveCount(10);
    await expect(items.nth(0)).toContainText("Réalisation « Table basse en noyer massif avec un titre assez long » publiée");
    await expect(items.nth(1)).toContainText("Réalisation « Console murale » modifiée");
    await expect(items.nth(2)).toContainText("Réalisation « Banc » remise en brouillon");
    await expect(items.nth(3)).toContainText("Une réalisation a été supprimée");
    await expect(items.nth(4)).toContainText("Réalisation « Chaise » créée");
    await expect(items.nth(5)).toContainText("Profil contributeur mis à jour");
    await expect(items.nth(0).locator("time")).toHaveCount(1);
    await expect(page.getByText("secret@example.com")).toHaveCount(0);
    await expect(page.getByText("Older one")).toHaveCount(0);

    const previous = page.getByTestId("activity-history-previous");
    const next = page.getByTestId("activity-history-next");
    await expect(previous).toBeDisabled();
    await expect(next).toHaveAttribute("href", "/dashboard/activity?page=2");
    await expect(page.getByTestId("activity-history-page-status")).toHaveText("Page 1 sur 2");
    await expect(page.getByTestId("activity-history-list")).toHaveRole("list");
    await next.focus();
    await expect(next).toBeFocused();

    await next.click();
    await expect(page).toHaveURL(/\/dashboard\/activity\?page=2/);
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText("Réalisation « Older one » créée");
    await expect(items.nth(1)).toContainText("Réalisation « Older two » supprimée");
    await expect(page.getByTestId("activity-history-page-status")).toHaveText("Page 2 sur 2");
    await expect(page.getByTestId("activity-history-next")).toBeDisabled();
    await expect(page.getByTestId("activity-history-previous")).toHaveAttribute("href", "/dashboard/activity");

    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.getByTestId("activity-history-title")).toHaveText("My activity history");
    await expect(items.nth(0)).toContainText("Realization “Older one” created");
    await expect(items.nth(1)).toContainText("Realization “Older two” deleted");
    await expect(page.getByTestId("activity-history-page-status")).toHaveText("Page 2 of 2");
    await expect(page.getByTestId("activity-history-previous")).toHaveText("Previous");
    await expect(page.getByTestId("activity-history-next")).toHaveText("Next");

    await page.getByTestId("activity-history-previous").click();
    await expect(page).toHaveURL(/\/dashboard\/activity$/);
    await expect(items).toHaveCount(10);
    await expect(page.getByTestId("activity-history-previous")).toBeDisabled();

    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(overflow).toBe(false);
      await expect(page.getByTestId("activity-history-list")).toBeVisible();
      await expect(page.getByTestId("activity-history-pagination")).toBeVisible();
    }
    expect(calls.some((url) => url.includes("ownerId"))).toBe(false);
    expect(calls.some((url) => url.includes("page=2"))).toBe(true);
  });

  test("shows the empty history message only after a successful response with no events", async ({ page }) => {
    await authenticate(page, "fr");
    await mockActivity(page, []);
    await page.goto("/dashboard/activity");
    await expect(page.getByTestId("activity-history-empty")).toHaveText("Aucune activité pour le moment.");
    await expect(page.getByTestId("activity-history-pagination")).toHaveCount(0);
    await expect(page.getByTestId("activity-history-error")).toHaveCount(0);
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.getByTestId("activity-history-empty")).toHaveText("No activity yet.");
  });

  test("keeps the history page usable when activity cannot be loaded", async ({ page }) => {
    await authenticate(page, "en");
    await mockActivity(page, [], { status: 500 });
    await page.goto("/dashboard/activity");
    await expect(page.getByTestId("activity-history-error")).toHaveText("Activity history is unavailable.");
    await expect(page.getByTestId("activity-history-empty")).toHaveCount(0);
    await expect(page.getByTestId("activity-history-pagination")).toHaveCount(0);
    await expect(page.getByTestId("activity-history-title")).toHaveText("My activity history");
    await expect(page.getByRole("link", { name: /Sawaka/ })).toBeVisible();
  });
});
