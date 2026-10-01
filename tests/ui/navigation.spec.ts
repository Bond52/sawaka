import { expect, test, type Page } from "@playwright/test";

async function setLocale(page: Page, locale: "fr" | "en") {
  await page.addInitScript((value) => {
    window.localStorage.setItem("sawaka-locale", value);
  }, locale);
}

async function openMobileMenu(page: Page) {
  await page.getByRole("button", { name: /ouvrir le menu|open menu/i }).click();
}

test.describe("Public navigation", () => {
  test("French desktop navigation matches the contributor onboarding flow", async ({
    page,
  }) => {
    await setLocale(page, "fr");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: "Accueil", exact: true })).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Réalisations", exact: true })
    ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Réalisations", exact: true })
    ).toHaveAttribute("href", "/produits");
    await expect(nav.getByRole("link", { name: "Fournisseurs", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Projets", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Réseau", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Concours" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Marché" })).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Créer un profil contributeur" })
    ).toHaveCount(0);

    const signUp = page.getByTestId("header-register");
    await expect(signUp).toHaveText("S'inscrire");
    await expect(signUp).toHaveAttribute("href", "/contributor/create");
    await expect(page.getByTestId("header-login")).toHaveText("Se connecter");

    await signUp.focus();
    await expect(signUp).toBeFocused();
    await signUp.click();
    await expect(page).toHaveURL(/\/contributor\/create$/);
  });

  test("English desktop navigation matches the contributor onboarding flow", async ({
    page,
  }) => {
    await setLocale(page, "en");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: "Home", exact: true })).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Realizations", exact: true })
    ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Realizations", exact: true })
    ).toHaveAttribute("href", "/produits");
    await expect(nav.getByRole("link", { name: "Contest" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Market", exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Create contributor profile" })
    ).toHaveCount(0);

    const signUp = page.getByTestId("header-register");
    await expect(signUp).toHaveText("Sign up");
    await expect(signUp).toHaveAttribute("href", "/contributor/create");
    const logIn = page.getByTestId("header-login");
    await expect(logIn).toHaveText("Log in");

    await logIn.click();
    await expect(page.getByTestId("login-modal")).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("French mobile menu matches the public navigation", async ({ page }) => {
    await setLocale(page, "fr");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Réalisations" })).toHaveCount(0);
    await openMobileMenu(page);

    const nav = page.getByRole("navigation");
    await expect(
      nav.getByRole("link", { name: "Réalisations", exact: true })
    ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Réalisations", exact: true })
    ).toHaveAttribute("href", "/produits");
    await expect(nav.getByRole("link", { name: "Concours" })).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Créer un profil contributeur" })
    ).toHaveCount(0);
    await expect(page.getByTestId("header-login-mobile")).toHaveText("Se connecter");

    const signUp = page.getByTestId("header-register-mobile");
    await expect(signUp).toHaveText("S'inscrire");
    await expect(signUp).toHaveAttribute("href", "/contributor/create");
    await signUp.focus();
    await expect(signUp).toBeFocused();
    await signUp.click();
    await expect(page).toHaveURL(/\/contributor\/create$/);
  });

  test("English mobile menu matches the public navigation", async ({ page }) => {
    await setLocale(page, "en");
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");
    await openMobileMenu(page);

    const nav = page.getByRole("navigation");
    await expect(
      nav.getByRole("link", { name: "Realizations", exact: true })
    ).toBeVisible();
    await expect(nav.getByRole("link", { name: "Contest" })).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Create contributor profile" })
    ).toHaveCount(0);

    const signUp = page.getByTestId("header-register-mobile");
    await expect(signUp).toHaveText("Sign up");
    await expect(signUp).toHaveAttribute("href", "/contributor/create");
    const logIn = page.getByTestId("header-login-mobile");
    await expect(logIn).toHaveText("Log in");
    await logIn.click();
    await expect(page.getByTestId("login-modal")).toBeVisible();
  });

  test("authenticated French desktop menu follows the approved structure", async ({
    page,
  }) => {
    await setLocale(page, "fr");
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "user",
        JSON.stringify({
          token: "user-jwt-token",
          roles: ["acheteur"],
          username: "amina",
          firstName: "Amina",
        })
      );
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    await expect(page.getByTestId("header-register")).toHaveCount(0);
    await expect(page.getByTestId("header-create-contributor")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Créer un profil contributeur" })
    ).toHaveCount(0);

    await page.getByTestId("header-user-menu").click();
    await expect(page.getByTestId("header-user-menu")).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    const panel = page.getByTestId("header-user-menu-panel");
    await expect(panel).toBeVisible();

    await expect(page.getByTestId("header-dashboard-link")).toHaveText(
      "Tableau de bord"
    );
    await expect(page.getByTestId("header-dashboard-link")).toHaveAttribute(
      "href",
      "/dashboard"
    );
    await expect(page.getByTestId("header-profile-link")).toHaveText("Mon profil");
    await expect(page.getByTestId("header-profile-link")).toHaveAttribute(
      "href",
      "/profile"
    );
    await expect(page.getByTestId("header-my-realizations")).toHaveText(
      "Mes réalisations"
    );
    await expect(page.getByTestId("header-my-realizations")).toBeDisabled();
    await expect(page.getByTestId("header-my-projects")).toHaveText("Mes projets");
    await expect(page.getByTestId("header-my-projects")).toBeDisabled();
    await expect(page.getByTestId("header-my-collaborations")).toHaveText(
      "Mes collaborations"
    );
    await expect(page.getByTestId("header-my-collaborations")).toBeDisabled();
    await expect(page.getByTestId("header-settings")).toHaveText("Paramètres");
    await expect(page.getByTestId("header-settings")).toHaveAttribute(
      "href",
      "/settings"
    );
    await expect(page.getByTestId("header-logout")).toHaveText("Se déconnecter");
    await expect(page.getByTestId("header-my-creations-link")).toHaveCount(0);
    await expect(page.getByTestId("header-create-contributor")).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
  });

  test("authenticated English desktop menu follows the approved structure", async ({
    page,
  }) => {
    await setLocale(page, "en");
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "user",
        JSON.stringify({
          token: "user-jwt-token",
          roles: ["acheteur"],
          username: "amina",
          firstName: "Amina",
        })
      );
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    await page.getByTestId("header-user-menu").click();
    await expect(page.getByTestId("header-create-contributor")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /create contributor profile/i })
    ).toHaveCount(0);
    await expect(page.getByTestId("header-dashboard-link")).toHaveText("Dashboard");
    await expect(page.getByTestId("header-profile-link")).toHaveText("My Profile");
    await expect(page.getByTestId("header-my-realizations")).toHaveText(
      "My Realizations"
    );
    await expect(page.getByTestId("header-my-projects")).toHaveText("My Projects");
    await expect(page.getByTestId("header-my-collaborations")).toHaveText(
      "My Collaborations"
    );
    await expect(page.getByTestId("header-settings")).toHaveText("Settings");
    await expect(page.getByTestId("header-settings")).toHaveAttribute(
      "href",
      "/settings"
    );
    await expect(page.getByTestId("header-my-realizations")).toBeDisabled();
    await expect(page.getByTestId("header-my-projects")).toBeDisabled();
    await expect(page.getByTestId("header-my-collaborations")).toBeDisabled();
    await expect(page.getByTestId("header-logout")).toHaveText("Log out");
  });

  test("authenticated mobile menu exposes the same account options", async ({
    page,
  }) => {
    await setLocale(page, "fr");
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "user",
        JSON.stringify({
          token: "user-jwt-token",
          roles: ["acheteur"],
          username: "amina",
          firstName: "Amina",
        })
      );
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await openMobileMenu(page);

    const account = page.getByTestId("header-mobile-account-menu");
    await expect(account).toBeVisible();
    await expect(page.getByTestId("header-mobile-dashboard")).toHaveText(
      "Tableau de bord"
    );
    await expect(page.getByTestId("header-mobile-profile")).toHaveAttribute(
      "href",
      "/profile"
    );
    await expect(page.getByTestId("header-mobile-realizations")).toBeDisabled();
    await expect(page.getByTestId("header-mobile-my-projects")).toBeDisabled();
    await expect(page.getByTestId("header-mobile-collaborations")).toBeDisabled();
    await expect(page.getByTestId("header-mobile-settings")).toHaveAttribute(
      "href",
      "/settings"
    );
    await expect(page.getByTestId("header-logout-mobile")).toHaveText(
      "Se déconnecter"
    );
    await expect(
      page.getByRole("link", { name: "Créer un profil contributeur" })
    ).toHaveCount(0);
  });
});
