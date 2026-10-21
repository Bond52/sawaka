import { test, expect, type Page, type Route } from "@playwright/test";

const STANDARD_USER = {
  token: "user-jwt-token",
  roles: ["acheteur", "vendeur"],
  username: "standarduser",
  firstName: "Amina",
  lastName: "Nguema",
};

const USER_WITHOUT_NAME = {
  token: "user-jwt-token",
  roles: ["acheteur"],
  username: "orphanuser",
  firstName: "",
  lastName: "",
};

const USER_NO_IDENTITY = {
  token: "user-jwt-token",
  roles: ["acheteur"],
  username: "",
  firstName: "",
  lastName: "",
};

async function mockAuthApis(page: Page) {
  await page.route("**/api/auth/**", async (route: Route) => {
    const request = route.request();
    const url = request.url();
    const method = request.method();

    if (method === "POST" && url.includes("/api/auth/login")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "set-cookie": "token=user-jwt-token; Path=/; HttpOnly",
        },
        body: JSON.stringify(STANDARD_USER),
      });
      return;
    }

    await route.continue();
  });
}

async function seedLoggedInUser(page: Page, user = STANDARD_USER) {
  await page.addInitScript((stored) => {
    window.localStorage.setItem("user", JSON.stringify(stored));
  }, user);
}

type DashboardMetricMock = {
  profileStatus?: number;
  profileBody?: unknown;
  realizationsStatus?: number;
  realizations?: Array<Record<string, unknown>>;
  delayMs?: number;
  onRequest?: (url: URL) => void;
};

function completionCriteria(incompleteKey = "") {
  return ["displayName", "domain", "skills", "country", "biography", "photo"].map((key) => ({
    key,
    complete: key !== incompleteKey,
  }));
}

function ownedRealization(id: string, status: "draft" | "published", sequence: number) {
  return {
    id,
    sequence,
    status,
    title: `Piece ${sequence}`,
    description: "Chaise en noyer",
    domainId: null,
    completedOn: null,
    mainMaterial: "",
    images: [{ url: "https://images.example/chair.jpg" }],
  };
}

async function mockDashboardMetrics(page: Page, options: DashboardMetricMock = {}) {
  const profileStatus = options.profileStatus ?? 404;
  const profileBody =
    options.profileBody ??
    { error: { code: "CONTRIBUTOR_PROFILE_NOT_FOUND" } };
  const realizationsStatus = options.realizationsStatus ?? 200;
  const realizations = options.realizations ?? [];

  await page.route("**/api/contributors/me**", async (route: Route) => {
    const url = new URL(route.request().url());
    options.onRequest?.(url);
    if (options.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
    if (url.pathname.endsWith("/api/contributors/me/activity")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ activities: [] }),
      });
      return;
    }
    if (url.pathname.endsWith("/api/contributors/me/realizations")) {
      await route.fulfill({
        status: realizationsStatus,
        contentType: "application/json",
        body: JSON.stringify(
          realizationsStatus === 200
            ? { realizations }
            : { error: { code: "SERVER_ERROR" } }
        ),
      });
      return;
    }
    if (url.pathname.endsWith("/api/contributors/me")) {
      await route.fulfill({
        status: profileStatus,
        contentType: "application/json",
        body: JSON.stringify(profileBody),
      });
      return;
    }
    await route.fallback();
  });
}

test.describe("Authenticated user dashboard (#362)", () => {
  test.beforeEach(async ({ page }) => {
    await mockDashboardMetrics(page);
  });

  test("successful login redirects to /dashboard", async ({ page }) => {
    await mockAuthApis(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
    await page.goto("/login");

    await page.getByTestId("login-input-email").fill("user@example.com");
    await page.getByTestId("login-input-password").fill("Secret123!");
    await page.getByTestId("login-submit").click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByTestId("user-dashboard")).toBeVisible();
  });

  test("authenticated user can access /dashboard", async ({ page }) => {
    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
    await page.goto("/dashboard");

    await expect(page.getByTestId("user-dashboard")).toBeVisible();
    await expect(page.getByTestId("dashboard-summary-cards")).toBeVisible();
    await expect(page.getByTestId("dashboard-recent-activity")).toBeVisible();
    await expect(page.getByTestId("dashboard-badges")).toHaveCount(1);
    await expect(page.getByTestId("dashboard-quick-actions-sidebar")).toHaveCount(0);
    await expect(page.getByTestId("dashboard-quick-actions-mobile")).toHaveCount(0);
  });

  test("unauthenticated access redirects to login", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem("user");
      window.localStorage.setItem("sawaka-locale", "en");
    });
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login\?redirect=.*dashboard/);
  });

  test("authenticated user first name is displayed", async ({ page }) => {
    await seedLoggedInUser(page, STANDARD_USER);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "fr");
    });
    await page.goto("/dashboard");

    await expect(page.getByTestId("dashboard-greeting")).toHaveText(
      "Bonjour Amina"
    );
  });

  test("fallback uses username when first name is unavailable", async ({
    page,
  }) => {
    await seedLoggedInUser(page, USER_WITHOUT_NAME);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "fr");
    });
    await page.goto("/dashboard");

    await expect(page.getByTestId("dashboard-greeting")).toHaveText(
      "Bonjour orphanuser"
    );
  });

  test("fallback greeting when no name fields are available", async ({
    page,
  }) => {
    await seedLoggedInUser(page, USER_NO_IDENTITY);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "fr");
    });
    await page.goto("/dashboard");

    await expect(page.getByTestId("dashboard-greeting")).toHaveText("Bonjour");
  });

  test("no waving-hand emoji or greeting icon is displayed", async ({
    page,
  }) => {
    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "fr");
    });
    await page.goto("/dashboard");

    const greeting = page.getByTestId("dashboard-greeting");
    await expect(greeting).toBeVisible();
    const text = await greeting.innerText();
    expect(text).not.toMatch(/👋|🤚|✋|wave/i);
  });

  test("excluded prototype sections are absent", async ({ page }) => {
    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
    await page.goto("/dashboard");

    await expect(page.getByText(/My Reputation/i)).toHaveCount(0);
    await expect(page.getByText(/Your Public Profile/i)).toHaveCount(0);
    await expect(page.getByText(/My Progress/i)).toHaveCount(0);
    await expect(page.getByText(/Challenges in Progress|Challenge in progress/i)).toHaveCount(0);

    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "fr");
    });
    await page.reload();

    await expect(page.getByText(/Ma réputation/i)).toHaveCount(0);
    await expect(page.getByText(/Votre profil public/i)).toHaveCount(0);
    await expect(page.getByText(/Ma progression/i)).toHaveCount(0);
    await expect(page.getByText(/Défi en cours/i)).toHaveCount(0);
  });

  test("empty states work when dashboard data is unavailable", async ({
    page,
  }) => {
    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
    await page.goto("/dashboard");

    await expect(page.getByTestId("dashboard-activity-empty")).toBeVisible();
    await expect(page.getByTestId("dashboard-badges-empty")).toBeVisible();
    await expect(page.getByTestId("dashboard-summary-realizations")).toContainText(
      "0"
    );
    await expect(page.getByTestId("dashboard-summary-projects")).toContainText(
      "0"
    );
  });

  test("removed quick actions leave no controls, and remaining actions stay inert", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
    await page.goto("/dashboard");

    await expect(page.getByTestId("dashboard-quick-actions-sidebar")).toHaveCount(0);
    await expect(page.getByTestId("dashboard-quick-actions-mobile")).toHaveCount(0);
    await expect(page.locator("[data-testid^='dashboard-action-']")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Quick actions" })).toHaveCount(0);
    await expect(page).toHaveURL(/\/dashboard/);

    const history = page.getByTestId("dashboard-activity-history");
    await expect(history).toHaveAttribute("href", "/dashboard/activity");
    await history.focus();
    await expect(history).toBeFocused();
    const viewAll = page.getByTestId("dashboard-badges-view-all");
    await expect(viewAll).toBeDisabled();
    await viewAll.focus();
    await expect(viewAll).not.toBeFocused();

    expect(errors).toEqual([]);
  });

  test("French dashboard rendering", async ({ page }) => {
    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "fr");
    });
    await page.goto("/dashboard");

    await expect(page.getByTestId("dashboard-greeting")).toHaveText(
      "Bonjour Amina"
    );
    await expect(page.getByTestId("dashboard-subtitle")).toHaveText(
      "Voici un aperçu de votre activité sur Sawaka."
    );
    await expect(page.getByRole("heading", { name: "Actions rapides" })).toHaveCount(0);
    await expect(page.getByTestId("dashboard-badges").getByRole("heading")).toHaveText(
      "Mes badges"
    );
    await expect(page.getByTestId("dashboard-badges-empty")).toHaveText(
      "Aucun badge pour le moment."
    );
  });

  test("English dashboard rendering", async ({ page }) => {
    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
    await page.goto("/dashboard");

    await expect(page.getByTestId("dashboard-greeting")).toHaveText(
      "Hello Amina"
    );
    await expect(page.getByTestId("dashboard-subtitle")).toHaveText(
      "Here is an overview of your activity on Sawaka."
    );
    await expect(page.getByRole("heading", { name: "Quick actions" })).toHaveCount(0);
    await expect(page.getByTestId("dashboard-badges").getByRole("heading")).toHaveText(
      "My badges"
    );
    await expect(page.getByTestId("dashboard-badges-empty")).toHaveText("No badges yet.");
  });

  test("badges stay in one place across desktop, tablet, and mobile", async ({
    page,
  }) => {
    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
    await page.goto("/dashboard");

    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByTestId("dashboard-badges")).toHaveCount(1);
      await expect(page.getByTestId("dashboard-badges")).toBeVisible();
      await expect(page.getByTestId("dashboard-quick-actions-sidebar")).toHaveCount(0);
      await expect(page.getByTestId("dashboard-quick-actions-mobile")).toHaveCount(0);
      await expect(page.getByTestId("dashboard-summary-cards")).toBeVisible();
      await expect(page.getByTestId("dashboard-recent-activity")).toBeVisible();
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 1;
      });
      expect(hasHorizontalOverflow).toBe(false);
    }
  });

  test("logout prevents subsequent dashboard access", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
    await page.goto("/");
    await page.evaluate((stored) => {
      window.localStorage.setItem("user", JSON.stringify(stored));
      window.dispatchEvent(new Event("sawaka-auth-changed"));
    }, STANDARD_USER);
    await page.goto("/dashboard");
    await expect(page.getByTestId("user-dashboard")).toBeVisible();

    await page.getByTestId("header-user-menu").click();
    await page.getByTestId("header-logout").click();

    await expect(page.getByTestId("header-login")).toBeVisible();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?redirect=.*dashboard/);
  });
});

test.describe("Dashboard profile and published realization metrics (#466)", () => {
  test("profile card uses completionPercent and realizations card counts published items", async ({
    page,
  }) => {
    const requests: string[] = [];
    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
    await mockDashboardMetrics(page, {
      profileStatus: 200,
      profileBody: {
        profile: {
          id: "profile-1",
          displayName: "Amina",
          completionPercent: 67,
        },
      },
      realizations: [
        ownedRealization("published-1", "published", 1),
        ownedRealization("draft-1", "draft", 2),
        ownedRealization("published-2", "published", 3),
        ownedRealization("published-3", "published", 4),
      ],
      onRequest: (url) => {
        requests.push(`${url.pathname}${url.search}`);
      },
    });

    await page.goto("/dashboard");

    await expect(page.getByTestId("dashboard-summary-profile-value")).toHaveText("67%");
    await expect(page.getByTestId("dashboard-summary-realizations-value")).toHaveText("3");
    await expect(page.getByTestId("dashboard-summary-profile-cta")).toHaveText(
      "Complete my profile →"
    );
    await expect(page.getByTestId("dashboard-summary-profile-cta")).toHaveAttribute(
      "href",
      "/profile"
    );
    await expect(page.getByTestId("dashboard-summary-projects-value")).toHaveText("0");
    await expect(page.getByTestId("dashboard-summary-reputation-value")).toHaveText("N/A");
    await expect(page.getByTestId("dashboard-recent-activity")).toBeVisible();
    await expect(page.getByTestId("dashboard-badges")).toBeVisible();
    expect(requests.some((url) => url.includes("ownerId"))).toBe(false);
  });

  test("does not show a numeric zero while metrics are still loading", async ({ page }) => {
    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/contributors/me**", async (route: Route) => {
      await gate;
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/activity")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ activities: [] }),
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

    await page.goto("/dashboard");

    const profileValue = page.getByTestId("dashboard-summary-profile-value");
    const realizationValue = page.getByTestId("dashboard-summary-realizations-value");
    await expect(profileValue).toHaveAttribute("aria-busy", "true");
    await expect(realizationValue).toHaveAttribute("aria-busy", "true");
    await expect(profileValue).not.toContainText("0");
    await expect(realizationValue).not.toContainText("0");
    await expect(page.getByTestId("dashboard-summary-projects-value")).toHaveText("0");

    release();
    await expect(profileValue).toHaveText("0%");
    await expect(realizationValue).toHaveText("0");
  });

  test("a missing profile is 0% and is not an error", async ({ page }) => {
    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "fr");
    });
    await mockDashboardMetrics(page, {
      profileStatus: 404,
      realizations: [ownedRealization("published-1", "published", 1)],
    });

    await page.goto("/dashboard");

    await expect(page.getByTestId("dashboard-summary-profile-value")).toHaveText("0%");
    await expect(page.getByTestId("dashboard-summary-profile")).toContainText("complété");
    await expect(page.getByTestId("dashboard-summary-profile-cta")).toHaveText(
      "Compléter mon profil →"
    );
    await expect(page.getByTestId("dashboard-summary-realizations-value")).toHaveText("1");
    await expect(page.getByTestId("dashboard-summary-realizations")).toContainText("publiée");
  });

  test("a profile failure leaves the realizations card intact", async ({ page }) => {
    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
    await mockDashboardMetrics(page, {
      profileStatus: 500,
      profileBody: { error: { code: "SERVER_ERROR" } },
      realizations: [
        ownedRealization("published-1", "published", 1),
        ownedRealization("published-2", "published", 2),
      ],
    });

    await page.goto("/dashboard");

    await expect(page.getByTestId("dashboard-summary-profile-value")).toHaveText("N/A");
    await expect(page.getByTestId("dashboard-summary-realizations-value")).toHaveText("2");
    await expect(page.getByTestId("user-dashboard")).toBeVisible();
    await expect(page.getByTestId("dashboard-badges")).toBeVisible();
    await expect(page.getByTestId("dashboard-recent-activity")).toBeVisible();
  });

  test("a realizations failure leaves the profile card intact", async ({ page }) => {
    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
    await mockDashboardMetrics(page, {
      profileStatus: 200,
      profileBody: {
        profile: { id: "profile-1", displayName: "Amina", completionPercent: 83 },
      },
      realizationsStatus: 500,
    });

    await page.goto("/dashboard");

    await expect(page.getByTestId("dashboard-summary-profile-value")).toHaveText("83%");
    await expect(page.getByTestId("dashboard-summary-realizations-value")).toHaveText("N/A");
    await expect(page.getByTestId("dashboard-summary-projects-value")).toHaveText("0");
    await expect(page.getByTestId("user-dashboard")).toBeVisible();
  });

  test("a complete profile uses the view label and still opens /profile", async ({ page }) => {
    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
    await mockDashboardMetrics(page, {
      profileStatus: 200,
      profileBody: {
        profile: { id: "profile-1", displayName: "Amina", completionPercent: 100 },
      },
    });

    await page.goto("/dashboard");

    const cta = page.getByTestId("dashboard-summary-profile-cta");
    await expect(page.getByTestId("dashboard-summary-profile-value")).toHaveText("100%");
    await expect(page.getByTestId("dashboard-summary-profile")).toContainText("completed");
    await expect(cta).toHaveText("Edit my profile →");
    await expect(cta).toHaveAttribute("href", "/profile");
  });

  test("French plural subtitles and the 100% view label", async ({ page }) => {
    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "fr");
    });
    let published = 0;
    await page.route("**/api/contributors/me**", async (route: Route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/activity")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ activities: [] }),
        });
        return;
      }
      if (url.pathname.endsWith("/realizations")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            realizations: Array.from({ length: published }, (_, index) =>
              ownedRealization(`published-${index + 1}`, "published", index + 1)
            ),
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          profile: { id: "profile-1", displayName: "Amina", completionPercent: 100 },
        }),
      });
    });

    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard-summary-profile")).toContainText("Profil");
    await expect(page.getByTestId("dashboard-summary-profile")).toContainText("complété");
    await expect(page.getByTestId("dashboard-summary-profile-cta")).toHaveText(
      "Modifier mon profil →"
    );
    await expect(page.getByTestId("dashboard-summary-realizations")).toContainText("publiées");
    await expect(page.getByTestId("dashboard-summary-realizations-value")).toHaveText("0");

    published = 1;
    await page.reload();
    await expect(page.getByTestId("dashboard-summary-realizations-value")).toHaveText("1");
    await expect(page.getByTestId("dashboard-summary-realizations")).toContainText("publiée");
    await expect(page.getByTestId("dashboard-summary-realizations")).not.toContainText(
      "publiées"
    );

    published = 2;
    await page.reload();
    await expect(page.getByTestId("dashboard-summary-realizations-value")).toHaveText("2");
    await expect(page.getByTestId("dashboard-summary-realizations")).toContainText("publiées");
  });

  test("published count follows publish, draft, and delete after each dashboard load", async ({
    page,
  }) => {
    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
    const items = [
      ownedRealization("live", "published", 1),
      ownedRealization("draft", "draft", 2),
    ];
    await mockDashboardMetrics(page, {
      profileStatus: 200,
      profileBody: {
        profile: { id: "profile-1", displayName: "Amina", completionPercent: 67 },
      },
      realizations: items,
    });

    const value = page.getByTestId("dashboard-summary-realizations-value");
    await page.goto("/dashboard");
    await expect(value).toHaveText("1");

    items.splice(
      0,
      items.length,
      ownedRealization("live", "published", 1),
      ownedRealization("draft", "published", 2)
    );
    await page.reload();
    await expect(value).toHaveText("2");

    items.splice(
      0,
      items.length,
      ownedRealization("live", "draft", 1),
      ownedRealization("draft", "published", 2)
    );
    await page.reload();
    await expect(value).toHaveText("1");

    items.splice(0, items.length, ownedRealization("live", "draft", 1));
    await page.reload();
    await expect(value).toHaveText("0");

    items.splice(
      0,
      items.length,
      ownedRealization("kept", "published", 1),
      ownedRealization("extra-draft", "draft", 2)
    );
    await page.reload();
    await expect(value).toHaveText("1");

    items.splice(0, items.length, ownedRealization("kept", "published", 1));
    await page.reload();
    await expect(value).toHaveText("1");
  });

  test("view my realizations opens the owner portfolio", async ({ page }) => {
    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "fr");
    });
    await mockDashboardMetrics(page, {
      realizations: [ownedRealization("published-1", "published", 1)],
    });
    await page.route("**/api/contributors/domains**", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ domains: [] }),
      });
    });

    await page.goto("/dashboard");
    const cta = page.getByTestId("dashboard-summary-realizations-cta");
    await expect(cta).toHaveText("Voir mes réalisations →");
    await expect(cta).toHaveAttribute("href", "/vendeur/articles");
    await cta.click();
    await expect(page).toHaveURL(/\/vendeur\/articles/);
    await expect(page.getByTestId("portfolio-management")).toBeVisible();
  });

  test("summary cards stay within the viewport at desktop, tablet, and mobile", async ({
    page,
  }) => {
    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "fr");
    });
    await mockDashboardMetrics(page, {
      profileStatus: 200,
      profileBody: {
        profile: { id: "profile-1", displayName: "Amina", completionPercent: 100 },
      },
      realizations: [
        ownedRealization("published-1", "published", 1),
        ownedRealization("published-2", "published", 2),
        ownedRealization("published-3", "published", 3),
      ],
    });

    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard-summary-profile-value")).toHaveText("100%");

    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByTestId("dashboard-summary-cards")).toBeVisible();
      await expect(page.getByTestId("dashboard-summary-profile-cta")).toBeVisible();
      await expect(page.getByTestId("dashboard-summary-realizations-cta")).toBeVisible();
      await expect(page.getByTestId("dashboard-recent-activity")).toBeVisible();
      await expect(page.getByTestId("dashboard-badges")).toBeVisible();
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 1;
      });
      expect(hasHorizontalOverflow).toBe(false);
    }
  });
});

test.describe("Profile completion guidance (#468)", () => {
  test("shows 5 of 6 criteria from the owner payload", async ({ page }) => {
    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
    await mockDashboardMetrics(page, {
      profileStatus: 200,
      profileBody: {
        profile: {
          id: "profile-amina",
          displayName: "Amina",
          completionPercent: 83,
          completionCriteria: completionCriteria("photo"),
        },
      },
    });

    await page.goto("/dashboard");

    await expect(page.getByTestId("dashboard-summary-profile-value")).toHaveText("83%");
    await expect(page.getByTestId("dashboard-summary-profile")).toContainText("5 / 6 completed");
    await expect(page.getByTestId("dashboard-summary-profile-cta")).toHaveText(
      "Complete my profile →"
    );
    await expect(page.getByTestId("dashboard-summary-profile-cta")).toHaveAttribute(
      "href",
      "/profile"
    );

    const toggle = page.getByTestId("dashboard-summary-profile-criteria-toggle");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("dashboard-summary-profile-criteria")).toHaveCount(0);
    await toggle.focus();
    await expect(toggle).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    const list = page.getByTestId("dashboard-summary-profile-criteria");
    await expect(list).toBeVisible();
    await expect(list.getByRole("listitem")).toHaveCount(6);
    await expect(page.getByTestId("dashboard-summary-profile-criterion-displayName")).toHaveAttribute(
      "data-complete",
      "true"
    );
    await expect(page.getByTestId("dashboard-summary-profile-criterion-displayName")).toContainText(
      "Display name"
    );
    await expect(page.getByTestId("dashboard-summary-profile-criterion-displayName")).toContainText(
      "Complete"
    );
    const photo = page.getByTestId("dashboard-summary-profile-criterion-photo");
    await expect(photo).toHaveAttribute("data-complete", "false");
    await expect(photo).toContainText("Profile photo");
    await expect(photo).toContainText("Incomplete");
    await expect(page.getByTestId("dashboard-summary-reputation-value")).toHaveText("N/A");
    await expect(page.getByTestId("dashboard-summary-reputation-cta")).toHaveAttribute(
      "href",
      "/contributors/profile-amina"
    );
  });

  test("a complete profile lists 6 of 6 and edits at /profile", async ({ page }) => {
    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
    await mockDashboardMetrics(page, {
      profileStatus: 200,
      profileBody: {
        profile: {
          id: "profile-complete",
          displayName: "Amina",
          completionPercent: 100,
          completionCriteria: completionCriteria(),
        },
      },
    });

    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard-summary-profile")).toContainText("6 / 6 completed");
    const cta = page.getByTestId("dashboard-summary-profile-cta");
    await expect(cta).toHaveText("Edit my profile →");
    await expect(cta).toHaveAttribute("href", "/profile");
    await page.getByTestId("dashboard-summary-profile-criteria-toggle").click();
    for (const key of ["displayName", "domain", "skills", "country", "biography", "photo"]) {
      await expect(page.getByTestId(`dashboard-summary-profile-criterion-${key}`)).toHaveAttribute(
        "data-complete",
        "true"
      );
    }
  });

  test("a missing profile keeps the public profile action unavailable", async ({ page }) => {
    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
    await mockDashboardMetrics(page);

    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard-summary-profile-value")).toHaveText("0%");
    await expect(page.getByTestId("dashboard-summary-profile")).toContainText("0 / 6 completed");
    await expect(page.getByTestId("dashboard-summary-profile-cta")).toHaveAttribute("href", "/profile");
    const publicCta = page.getByTestId("dashboard-summary-reputation-cta");
    await expect(publicCta).toHaveAttribute("aria-disabled", "true");
    await expect(publicCta).not.toHaveAttribute("href", /.+/);
    await expect(page.locator("a[href*='/contributors/']")).toHaveCount(0);
    await expect(page.getByTestId("dashboard-summary-reputation-value")).toHaveText("N/A");
    await expect(page.getByTestId("dashboard-summary-projects-value")).toHaveText("0");
  });

  test("French checklist labels and the public profile route", async ({ page }) => {
    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "fr");
    });
    await mockDashboardMetrics(page, {
      profileStatus: 200,
      profileBody: {
        profile: {
          id: "64b000000000000000000010",
          displayName: "Amina",
          completionPercent: 83,
          completionCriteria: completionCriteria("photo"),
        },
      },
    });

    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard-summary-profile")).toContainText("5 / 6 complété");
    await expect(page.getByTestId("dashboard-summary-profile-criteria-toggle")).toHaveText(
      "Voir ce qu’il manque"
    );
    await page.getByTestId("dashboard-summary-profile-criteria-toggle").click();
    await expect(page.getByTestId("dashboard-summary-profile-criteria-toggle")).toHaveText(
      "Masquer le détail"
    );
    await expect(page.getByTestId("dashboard-summary-profile-criterion-photo")).toContainText(
      "Photo de profil"
    );
    await expect(page.getByTestId("dashboard-summary-profile-criterion-skills")).toContainText(
      "Compétences"
    );
    await expect(page.getByTestId("dashboard-summary-reputation-cta")).toHaveAttribute(
      "href",
      "/contributors/64b000000000000000000010"
    );
    await expect(page.getByTestId("dashboard-summary-profile-cta")).toHaveAttribute(
      "href",
      "/profile"
    );
  });

  test("the checklist stays inside the viewport when expanded", async ({ page }) => {
    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "fr");
    });
    await mockDashboardMetrics(page, {
      profileStatus: 200,
      profileBody: {
        profile: {
          id: "profile-layout",
          displayName: "Amina",
          completionPercent: 83,
          completionCriteria: completionCriteria("biography"),
        },
      },
      realizations: [ownedRealization("published-1", "published", 1)],
    });

    await page.goto("/dashboard");
    await page.getByTestId("dashboard-summary-profile-criteria-toggle").click();
    await expect(page.getByTestId("dashboard-summary-profile-criteria")).toBeVisible();

    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByTestId("dashboard-summary-profile-criterion-biography")).toBeVisible();
      await expect(page.getByTestId("dashboard-recent-activity")).toBeVisible();
      await expect(page.getByTestId("dashboard-badges")).toBeVisible();
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 1;
      });
      expect(hasHorizontalOverflow).toBe(false);
    }
  });
});
