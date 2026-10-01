import { expect, test, type Page, type Route } from "@playwright/test";

const USER = {
  token: "user-jwt-token",
  roles: ["acheteur"],
  username: "wilson",
  firstName: "Wilson",
};

const PROFILE = {
  id: "profile-1",
  displayName: "Wilson M.",
  biography: "Mobilier en bois local.",
  country: "Cameroun",
  region: "Littoral",
  city: "Douala",
  domain: {
    id: "domain-1",
    nameFR: "Menuiserie, travail du bois et mobilier",
    nameEN: "Carpentry, Woodworking & Furniture",
  },
  skills: [
    {
      id: "skill-1",
      nameFR: "Fabrication de meubles",
      nameEN: "Furniture making",
      isCustom: false,
    },
  ],
  status: "Active",
  isVisible: true,
};

async function setLocale(page: Page, locale: "fr" | "en") {
  await page.addInitScript((value) => {
    window.localStorage.setItem("sawaka-locale", value);
  }, locale);
}

async function seedUser(page: Page, roles: string[] = ["acheteur"]) {
  await page.addInitScript((stored) => {
    window.localStorage.setItem("user", JSON.stringify(stored));
  }, { ...USER, roles });
}

async function mockOwnProfile(
  page: Page,
  profile: typeof PROFILE,
  options?: {
    deactivateStatus?: number;
    deactivateBody?: unknown;
    delayDeactivate?: boolean;
  }
) {
  const calls: { url: string; body: string | null }[] = [];
  await page.route("**/api/contributors/me**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (method === "POST" && path.endsWith("/api/contributors/me/deactivate")) {
      calls.push({ url: request.url(), body: request.postData() });
      if (options?.delayDeactivate) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      await route.fulfill({
        status: options?.deactivateStatus ?? 200,
        contentType: "application/json",
        body: JSON.stringify(
          options?.deactivateBody ?? {
            profile: { ...profile, status: "Inactive", isVisible: false },
          }
        ),
      });
      return;
    }

    if (method === "GET" && path.endsWith("/api/contributors/me")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ profile }),
      });
      return;
    }

    await route.fallback();
  });
  return calls;
}

test.describe("Owner contributor deactivation", () => {
  test("shows the owner action and opens the dialog without calling the API", async ({
    page,
  }) => {
    await setLocale(page, "en");
    await seedUser(page);
    const calls = await mockOwnProfile(page, PROFILE);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/profile");

    const open = page.getByTestId("contributor-profile-deactivate-open");
    await expect(open).toBeVisible();
    await expect(page.getByTestId("admin-deactivate-contributor")).toHaveCount(0);
    await open.click();
    await expect(page.getByTestId("contributor-profile-deactivate-dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(calls).toHaveLength(0);
  });

  test("explains the impact in English", async ({ page }) => {
    await setLocale(page, "en");
    await seedUser(page);
    await mockOwnProfile(page, PROFILE);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/profile");
    await page.getByTestId("contributor-profile-deactivate-open").click();

    const dialog = page.getByRole("dialog", {
      name: "Deactivate your contributor profile?",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("no longer be publicly visible");
    await expect(dialog).toContainText("no longer be publicly discoverable");
    await expect(dialog).toContainText("does not delete your account");
    await expect(dialog).toContainText("history remains preserved");
    await expect(dialog).not.toContainText(/reactivat/i);
    await expect(page.getByTestId("contributor-profile-deactivate-confirm")).toHaveText(
      "Confirm deactivation"
    );
  });

  test("explains the impact in French", async ({ page }) => {
    await setLocale(page, "fr");
    await seedUser(page);
    await mockOwnProfile(page, PROFILE);
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/profile");
    await page.getByTestId("contributor-profile-deactivate-open").click();

    const dialog = page.getByRole("dialog", {
      name: "Désactiver votre profil contributeur ?",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("ne sera plus visible publiquement");
    await expect(dialog).toContainText("ne sera plus découvrable publiquement");
    await expect(dialog).toContainText("ne supprime pas votre compte");
    await expect(dialog).toContainText("reste conservé");
    await expect(dialog).not.toContainText(/réactiv/i);
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(768);
    expect(box!.x).toBeGreaterThanOrEqual(0);
  });

  test("cancel closes the dialog and sends no request", async ({ page }) => {
    await setLocale(page, "en");
    await seedUser(page);
    const calls = await mockOwnProfile(page, PROFILE);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/profile");
    await page.getByTestId("contributor-profile-deactivate-open").click();
    await page.getByTestId("contributor-profile-deactivate-cancel").click();

    await expect(page.getByTestId("contributor-profile-deactivate-dialog")).toHaveCount(0);
    expect(calls).toHaveLength(0);
    await expect(page.getByTestId("contributor-profile-display-name")).toHaveText("Wilson M.");
    await expect(page.getByTestId("contributor-profile-inactive")).toHaveCount(0);
  });

  test("confirm sends one owner request and reaches the dashboard", async ({ page }) => {
    await setLocale(page, "en");
    await seedUser(page);
    const calls = await mockOwnProfile(page, PROFILE, { delayDeactivate: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/profile");
    await page.getByTestId("contributor-profile-deactivate-open").click();
    const confirm = page.getByTestId("contributor-profile-deactivate-confirm");
    await confirm.click();
    await expect(confirm).toBeDisabled();
    await expect(confirm).toHaveText("Deactivating...");
    await expect(page.getByTestId("dashboard-profile-deactivated")).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("button", { name: /reactivat/i })).toHaveCount(0);
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0].url).pathname).toBe("/api/contributors/me/deactivate");
    expect(calls[0].body ?? "").not.toMatch(/userId|contributorProfileId|profileId/i);
  });

  test("shows a functional error and keeps the profile active", async ({ page }) => {
    await setLocale(page, "fr");
    await seedUser(page);
    await mockOwnProfile(page, PROFILE, {
      deactivateStatus: 500,
      deactivateBody: {
        error: { code: "SERVER_ERROR", message: "MongoServerError secret-token" },
      },
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/profile");
    await page.getByTestId("contributor-profile-deactivate-open").click();
    const dialog = page.getByTestId("contributor-profile-deactivate-dialog");
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390 + 1);

    await page.getByTestId("contributor-profile-deactivate-confirm").click();
    const alert = page.getByTestId("contributor-profile-deactivate-error");
    await expect(alert).toHaveText("Le profil n’a pas pu être désactivé. Réessayez.");
    await expect(alert).not.toContainText("Mongo");
    await expect(alert).not.toContainText("secret-token");
    await expect(page.getByTestId("contributor-profile-inactive")).toHaveCount(0);
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.getByTestId("contributor-profile-deactivate-confirm")).toBeEnabled();
  });

  test("does not offer deactivation or reactivation for an inactive profile", async ({
    page,
  }) => {
    await setLocale(page, "en");
    await seedUser(page, ["admin"]);
    await mockOwnProfile(page, { ...PROFILE, status: "Inactive", isVisible: false });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/profile");

    await expect(page.getByTestId("contributor-profile-inactive")).toBeVisible();
    await expect(page.getByTestId("contributor-profile-deactivate-open")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /reactivat/i })).toHaveCount(0);
    await expect(page.getByTestId("admin-deactivate-contributor")).toHaveCount(0);
    await expect(page.getByTestId("contributor-profile-edit")).toBeVisible();
  });

  test("supports keyboard focus and escape", async ({ page }) => {
    await setLocale(page, "en");
    await seedUser(page);
    const calls = await mockOwnProfile(page, PROFILE);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/profile");

    const open = page.getByTestId("contributor-profile-deactivate-open");
    await open.focus();
    await page.keyboard.press("Enter");
    const cancel = page.getByTestId("contributor-profile-deactivate-cancel");
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("contributor-profile-deactivate-confirm")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("contributor-profile-deactivate-dialog")).toHaveCount(0);
    await expect(open).toBeFocused();
    expect(calls).toHaveLength(0);
  });

  test("does not place deactivation in account settings", async ({ page }) => {
    await setLocale(page, "en");
    await seedUser(page, ["admin"]);
    await page.route("**/api/user/profile", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          username: "wilson",
          email: "wilson@example.com",
          firstName: "Wilson",
          lastName: "M",
        }),
      });
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/settings");
    await expect(page.getByTestId("account-settings-page")).toBeVisible();
    await expect(page.getByTestId("contributor-profile-deactivate-open")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /deactivate profile/i })).toHaveCount(0);
  });
});
