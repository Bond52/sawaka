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

test.describe("Authenticated user dashboard (#362)", () => {
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
    await expect(page.getByTestId("dashboard-badges")).toBeVisible();
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

  test("unimplemented actions do not navigate or throw", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await seedLoggedInUser(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
    await page.goto("/dashboard");

    const sidebarActions = page.getByTestId("dashboard-quick-actions-sidebar");
    const addRealization = sidebarActions.getByTestId(
      "dashboard-action-add-realization"
    );
    await expect(addRealization).toBeVisible();
    await expect(addRealization).toBeDisabled();
    await expect(page).toHaveURL(/\/dashboard/);

    await expect(page.getByTestId("dashboard-activity-history")).toBeDisabled();
    await expect(page.getByTestId("dashboard-badges-view-all")).toBeDisabled();

    // Disabled CTAs must not be interactive links
    await expect(
      sidebarActions.locator('a[data-testid="dashboard-action-add-realization"]')
    ).toHaveCount(0);

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
    await expect(
      page.getByTestId("dashboard-quick-actions-sidebar").getByRole("heading")
    ).toHaveText("Actions rapides");
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
    await expect(
      page.getByTestId("dashboard-quick-actions-sidebar").getByRole("heading")
    ).toHaveText("Quick actions");
  });

  test("responsive layout shows mobile quick actions without horizontal overflow", async ({
    page,
  }) => {
    await seedLoggedInUser(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
    await page.goto("/dashboard");

    await expect(
      page.getByTestId("dashboard-quick-actions-mobile")
    ).toBeVisible();
    await expect(
      page.getByTestId("dashboard-quick-actions-sidebar")
    ).toBeHidden();

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 1;
    });
    expect(hasHorizontalOverflow).toBe(false);
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
