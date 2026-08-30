import { test, expect, type Page, type Route } from "@playwright/test";

const STANDARD_USER = {
  token: "user-jwt-token",
  roles: ["acheteur", "vendeur"],
  username: "standarduser",
  firstName: "Amina",
  lastName: "Nguema",
};

const ADMIN_USER = {
  token: "admin-jwt-token",
  roles: ["admin"],
  username: "adminuser",
  firstName: "Admin",
  lastName: "Sawaka",
};

async function mockAuthApis(
  page: Page,
  options: {
    loginStatus?: number;
    loginBody?: Record<string, unknown>;
  } = {}
) {
  await page.route("**/api/auth/**", async (route: Route) => {
    const request = route.request();
    const url = request.url();
    const method = request.method();

    if (method === "POST" && url.includes("/api/auth/login")) {
      const status = options.loginStatus ?? 200;
      const body =
        options.loginBody ??
        (status === 200
          ? STANDARD_USER
          : { error: "Mot de passe invalide" });
      await route.fulfill({
        status,
        contentType: "application/json",
        headers: {
          "set-cookie":
            status === 200
              ? "token=user-jwt-token; Path=/; HttpOnly"
              : "",
        },
        body: JSON.stringify(body),
      });
      return;
    }

    if (method === "GET" && url.includes("/api/auth/me")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "1", roles: STANDARD_USER.roles }),
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

test.describe("User & admin account authentication (#337)", () => {
  test("header Sign In opens the login modal instead of a blocking alert", async ({
    page,
  }) => {
    page.on("dialog", () => {
      throw new Error("Unexpected blocking alert on login");
    });

    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "fr");
    });
    await page.goto("/");

    await expect(page.getByTestId("header-login")).toBeVisible();
    await page.getByTestId("header-login").click();
    await expect(page.getByTestId("login-modal")).toBeVisible();
    await expect(page.getByTestId("login-form")).toBeVisible();
    await expect(page.getByText("Connexion")).toBeVisible();
  });

  test("EN authentication interface labels", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
    await page.goto("/login");

    await expect(page.getByTestId("login-page-title")).toHaveText("Log in");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByTestId("login-submit")).toHaveText("Log in");
  });

  test("FR authentication interface labels", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "fr");
    });
    await page.goto("/login");

    await expect(page.getByTestId("login-page-title")).toHaveText(
      "Se connecter"
    );
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Mot de passe")).toBeVisible();
    await expect(page.getByTestId("login-submit")).toHaveText("Se connecter");
  });

  test("standard user can log in from the login page", async ({ page }) => {
    await mockAuthApis(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
    await page.goto("/login");

    await page.getByTestId("login-input-email").fill("user@example.com");
    await page.getByTestId("login-input-password").fill("Secret123!");
    await page.getByTestId("login-submit").click();

    await expect(page).toHaveURL(/\/$/);
    const stored = await page.evaluate(() =>
      window.localStorage.getItem("user")
    );
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toMatchObject({
      username: "standarduser",
      roles: expect.arrayContaining(["acheteur", "vendeur"]),
    });
  });

  test("administrator can log in and sees admin entry", async ({ page }) => {
    await mockAuthApis(page, { loginBody: ADMIN_USER });
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
    await page.goto("/login");

    await page.getByTestId("login-input-email").fill("admin@example.com");
    await page.getByTestId("login-input-password").fill("AdminPass1!");
    await page.getByTestId("login-submit").click();

    await expect(page).toHaveURL(/\/$/);
    await page.getByTestId("header-user-menu").click();
    await expect(page.getByTestId("header-admin-link")).toBeVisible();
  });

  test("invalid login shows an error and does not persist a session", async ({
    page,
  }) => {
    let dialogMessage = "";
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await mockAuthApis(page, {
      loginStatus: 401,
      loginBody: { error: "Mot de passe invalide" },
    });
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "fr");
    });
    await page.goto("/login");

    await page.getByTestId("login-input-email").fill("user@example.com");
    await page.getByTestId("login-input-password").fill("bad");
    await page.getByTestId("login-submit").click();

    await expect.poll(() => dialogMessage).toMatch(/Mot de passe invalide|Identifiants incorrects/i);
    const stored = await page.evaluate(() =>
      window.localStorage.getItem("user")
    );
    expect(stored).toBeNull();
  });

  test("logout clears the authenticated session", async ({ page }) => {
    await seedLoggedInUser(page, STANDARD_USER);
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "fr");
    });
    await page.goto("/");

    await page.getByTestId("header-user-menu").click();
    await page.getByTestId("header-logout").click();

    await expect(page.getByTestId("header-login")).toBeVisible();
    const stored = await page.evaluate(() =>
      window.localStorage.getItem("user")
    );
    expect(stored).toBeNull();
  });

  test("administrator logout clears the session", async ({ page }) => {
    await seedLoggedInUser(page, ADMIN_USER);
    await page.goto("/");

    await page.getByTestId("header-user-menu").click();
    await expect(page.getByTestId("header-admin-link")).toBeVisible();
    await page.getByTestId("header-logout").click();

    await expect(page.getByTestId("header-login")).toBeVisible();
    const stored = await page.evaluate(() =>
      window.localStorage.getItem("user")
    );
    expect(stored).toBeNull();
  });

  test("standard user does not see administrator navigation", async ({
    page,
  }) => {
    await seedLoggedInUser(page, STANDARD_USER);
    await page.goto("/");

    await page.getByTestId("header-user-menu").click();
    await expect(page.getByTestId("header-admin-link")).toHaveCount(0);
  });

  test("session persists across reload", async ({ page }) => {
    await seedLoggedInUser(page, STANDARD_USER);
    await page.goto("/");
    await expect(page.getByTestId("header-user-menu")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("header-user-menu")).toBeVisible();
  });

  test("register entry point is available from the header", async ({
    page,
  }) => {
    page.on("dialog", () => {
      throw new Error("Unexpected blocking alert on register");
    });
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "fr");
    });
    await page.goto("/");
    await page.getByTestId("header-register").click();
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByTestId("register-page-title")).toBeVisible();
    await expect(page.getByTestId("register-form")).toBeVisible();
  });

  test("login modal create-account link navigates to register", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "en");
    });
    await page.goto("/");
    await page.getByTestId("header-login").click();
    await page.getByTestId("login-modal-register-link").click();
    await expect(page).toHaveURL(/\/register/);
  });
});

test.describe("Supplier Magic Link non-regression with account auth restored", () => {
  test("add supplier page still loads without requiring a Sawaka account", async ({
    page,
  }) => {
    await page.goto("/add-supplier");
    await expect(page.getByTestId("add-supplier-page-title")).toBeVisible();
    await expect(page.getByTestId("supplier-form")).toBeVisible();
    await expect(page.getByTestId("header-login")).toBeVisible();
  });

  test("supplier directory still loads independently of account session", async ({
    page,
  }) => {
    await page.route("**/api/suppliers**", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [],
          total: 0,
          page: 1,
          pageSize: 12,
        }),
      });
    });

    await page.goto("/fournisseurs");
    await expect(page).toHaveURL(/\/fournisseurs/);
  });
});
