import { expect, test, type Page, type Route } from "@playwright/test";

const DOMAIN_ID = "64b0000000000000000000a1";
const OTHER_DOMAIN_ID = "64b0000000000000000000a2";
const SKILL_ID = "64b0000000000000000000b1";
const OTHER_SKILL_ID = "64b0000000000000000000b2";

const DOMAINS = [
  { id: DOMAIN_ID, nameFR: "Maçonnerie", nameEN: "Masonry" },
  { id: OTHER_DOMAIN_ID, nameFR: "Menuiserie", nameEN: "Carpentry" },
];

const SKILLS: Record<string, { id: string; nameFR: string; nameEN: string }[]> = {
  [DOMAIN_ID]: [{ id: SKILL_ID, nameFR: "Enduit", nameEN: "Plaster" }],
  [OTHER_DOMAIN_ID]: [{ id: OTHER_SKILL_ID, nameFR: "Portes", nameEN: "Doors" }],
};

type ApiState = {
  meStatus: number;
  meBody: unknown;
  createStatus: number;
  createBody: unknown;
  resendStatus: number;
  resendBody: unknown;
  lastCreate: unknown;
};

function pendingProfile(displayName = "Amina Nguema") {
  return {
    id: "64b0000000000000000000c1",
    displayName,
    status: "Pending Email Verification",
    isVisible: false,
  };
}

function activeProfile(displayName = "Amina Nguema") {
  return {
    id: "64b0000000000000000000c1",
    displayName,
    status: "Active",
    isVisible: true,
  };
}

async function installApi(page: Page, state: ApiState) {
  await page.route(/\/api\/contributors(\/|$|\?)/, async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (method === "GET" && path.endsWith("/api/contributors/domains")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ domains: DOMAINS }),
      });
      return;
    }

    const skillsMatch = path.match(/\/domains\/([^/]+)\/skills$/);
    if (method === "GET" && skillsMatch) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ skills: SKILLS[skillsMatch[1]] ?? [] }),
      });
      return;
    }

    if (method === "GET" && path.endsWith("/api/contributors/me")) {
      await route.fulfill({
        status: state.meStatus,
        contentType: "application/json",
        body: JSON.stringify(state.meBody),
      });
      return;
    }

    if (method === "POST" && path.endsWith("/verification-email")) {
      await route.fulfill({
        status: state.resendStatus,
        contentType: "application/json",
        body: JSON.stringify(state.resendBody),
      });
      return;
    }

    if (method === "POST" && path.endsWith("/email-verification")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          emailVerified: true,
          profileActivated: true,
          profileId: "64b0000000000000000000c1",
        }),
      });
      return;
    }

    if (method === "POST" && /\/api\/contributors\/?$/.test(path)) {
      state.lastCreate = request.postDataJSON();
      await route.fulfill({
        status: state.createStatus,
        contentType: "application/json",
        body: JSON.stringify(state.createBody),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "NOT_FOUND" } }),
    });
  });
}

function baseState(): ApiState {
  return {
    meStatus: 404,
    meBody: { error: { code: "CONTRIBUTOR_PROFILE_NOT_FOUND" } },
    createStatus: 201,
    createBody: {
      profile: pendingProfile(),
      accountCreated: true,
      verificationRequired: true,
      verificationEmailSent: true,
      token: "session-token",
      roles: ["acheteur"],
      username: "amina",
    },
    resendStatus: 200,
    resendBody: {
      emailVerified: false,
      verificationEmailSent: true,
      status: "Pending Email Verification",
      isVisible: false,
    },
    lastCreate: null,
  };
}

async function useEnglish(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("sawaka-locale", "en");
  });
}

async function fillAccount(page: Page) {
  await page.getByLabel("Username").fill("amina");
  await page.getByLabel("Account email").fill("amina@example.com");
  await page.getByLabel("Password").fill("Secret123!");
}

async function fillProfile(
  page: Page,
  labels: { domain: string; skill: string; country: string; display?: string }
) {
  await page.getByLabel(/Display name|Nom affiché/).fill(labels.display ?? "Amina Nguema");
  await page.getByLabel(/Primary domain|Domaine principal/).selectOption({
    label: labels.domain,
  });
  await page.getByRole("button", { name: labels.skill, exact: true }).click();
  await page.getByLabel(/Custom skills|Compétences personnalisées/).fill("Lime wash");
  await page.getByTestId("contributor-add-custom-skill").click();
  await page.getByLabel(/^Country$|^Pays$/).fill(labels.country);
}

test.describe("Contributor profile creation", () => {
  test("new visitor creates a profile, resends, then reaches the dashboard", async ({
    page,
  }) => {
    const state = baseState();
    await useEnglish(page);
    await installApi(page, state);
    await page.goto("/contributor/create");

    await expect(page.getByTestId("contributor-create-title")).toBeVisible();
    await fillAccount(page);
    await fillProfile(page, {
      domain: "Masonry",
      skill: "Plaster",
      country: "Cameroon",
    });
    await page.getByLabel("City or locality").fill("Yaoundé");
    await page.getByTestId("contributor-submit").click();

    await expect(page.getByTestId("contributor-pending-verification")).toBeVisible();
    await expect(page.getByTestId("contributor-pending-verification")).toContainText(
      "Email verification pending"
    );
    await expect(page.getByTestId("contributor-pending-verification")).toContainText(
      "not public yet"
    );
    await expect(page.getByText("amina@example.com")).toHaveCount(0);

    await page.getByTestId("contributor-resend").click();
    await expect(page.getByTestId("contributor-resend-message")).toContainText(
      "not public"
    );
    await expect(page.getByTestId("contributor-pending-verification")).toBeVisible();

    const stored = await page.evaluate(() => window.localStorage.getItem("user"));
    expect(stored).toContain("session-token");
    expect(stored).not.toContain("Secret123!");
    expect(stored).not.toContain("amina@example.com");

    await page.goto("/contributor/verify-email?token=valid-user-token");
    await expect(page.getByTestId("contributor-verify-email-success")).toBeVisible();
    await page.getByTestId("contributor-verify-email-dashboard").click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("French copy shows pending verification", async ({ page }) => {
    const state = baseState();
    await page.addInitScript(() => {
      window.localStorage.setItem("sawaka-locale", "fr");
    });
    await installApi(page, state);
    await page.goto("/contributor/create");
    await page.getByLabel("Nom d’utilisateur").fill("amina");
    await page.getByLabel("E-mail du compte").fill("amina@example.com");
    await page.getByLabel("Mot de passe").fill("Secret123!");
    await fillProfile(page, {
      domain: "Maçonnerie",
      skill: "Enduit",
      country: "Cameroun",
    });
    await page.getByTestId("contributor-submit").click();
    await expect(page.getByRole("heading", { name: "Vérification de l’e-mail en attente" })).toBeVisible();
    await expect(page.getByTestId("contributor-resend")).toHaveText(
      "Renvoyer l’e-mail de vérification"
    );
  });

  test("signed-in visitor reuses the account and sees immediate activation", async ({
    page,
  }) => {
    const state = baseState();
    state.createBody = {
      profile: activeProfile(),
      accountCreated: false,
      verificationRequired: false,
      verificationEmailSent: false,
    };
    await useEnglish(page);
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "user",
        JSON.stringify({
          token: "user-jwt-token",
          roles: ["acheteur"],
          username: "amina",
          firstName: "Amina",
          lastName: "Nguema",
        })
      );
    });
    await installApi(page, state);
    await page.goto("/contributor/create");

    await expect(page.getByLabel("Username")).toHaveCount(0);
    await expect(page.getByLabel("Account email")).toHaveCount(0);
    await expect(page.getByLabel("Display name")).toHaveValue("Amina Nguema");
    await page.getByLabel("Primary domain").selectOption({ label: "Masonry" });
    await page.getByRole("button", { name: "Plaster", exact: true }).click();
    await page.getByLabel("Country").fill("Cameroon");
    await page.getByTestId("contributor-submit").click();

    await expect(page.getByTestId("contributor-active-confirmation")).toContainText(
      "Your contributor profile is active"
    );
    await expect(page.getByTestId("contributor-resend")).toHaveCount(0);
    expect(state.lastCreate).not.toHaveProperty("account");
  });

  test("an existing pending profile is not sent through creation again", async ({
    page,
  }) => {
    const state = baseState();
    state.meStatus = 200;
    state.meBody = { profile: pendingProfile() };
    await useEnglish(page);
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "user",
        JSON.stringify({
          token: "user-jwt-token",
          roles: ["acheteur"],
          username: "amina",
        })
      );
    });
    await installApi(page, state);
    await page.goto("/contributor/create");
    await expect(page.getByTestId("contributor-create-form")).toHaveCount(0);
    await expect(page.getByTestId("contributor-pending-verification")).toContainText(
      "not public"
    );
    await expect(page.getByTestId("contributor-resend")).toBeVisible();
  });

  test("required fields stay filled after a validation error", async ({ page }) => {
    await useEnglish(page);
    await installApi(page, baseState());
    await page.goto("/contributor/create");
    await page.getByLabel("Display name").fill("Amina Nguema");
    await page.getByLabel("Primary domain").selectOption({ label: "Masonry" });
    await page.getByRole("button", { name: "Plaster", exact: true }).click();
    await page.getByTestId("contributor-submit").click();
    await expect(page.getByText("Enter a country.")).toBeVisible();
    await expect(page.getByLabel("Display name")).toHaveValue("Amina Nguema");
    await expect(page.getByRole("button", { name: /Plaster/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("rejects a duplicate custom skill and keeps the first one", async ({ page }) => {
    await useEnglish(page);
    await installApi(page, baseState());
    await page.goto("/contributor/create");
    await page.getByLabel("Custom skills").fill("Lime wash");
    await page.getByTestId("contributor-add-custom-skill").click();
    await page.getByLabel("Custom skills").fill("lime wash");
    await page.getByTestId("contributor-add-custom-skill").click();
    await expect(page.getByText("already in the list")).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove Lime wash" })).toHaveCount(1);
  });

  test("keeps valid values when the server rejects a field", async ({ page }) => {
    const state = baseState();
    state.createStatus = 400;
    state.createBody = {
      error: { code: "VALIDATION_ERROR", fields: { displayName: "DISPLAY_NAME_LENGTH" } },
    };
    await useEnglish(page);
    await installApi(page, state);
    await page.goto("/contributor/create");
    await fillAccount(page);
    await fillProfile(page, {
      domain: "Masonry",
      skill: "Plaster",
      country: "Cameroon",
    });
    await page.getByTestId("contributor-submit").click();
    await expect(page.getByText("Use between 2 and 80 characters.")).toBeVisible();
    await expect(page.getByLabel("Country")).toHaveValue("Cameroon");
    await expect(page.getByTestId("contributor-pending-verification")).toHaveCount(0);
  });

  test("account collision invites sign-in and does not show a created profile", async ({
    page,
  }) => {
    const state = baseState();
    state.createStatus = 400;
    state.createBody = { error: { code: "ACCOUNT_ALREADY_EXISTS" } };
    await useEnglish(page);
    await installApi(page, state);
    await page.goto("/contributor/create");
    await fillAccount(page);
    await fillProfile(page, {
      domain: "Masonry",
      skill: "Plaster",
      country: "Cameroon",
    });
    await page.getByTestId("contributor-submit").click();
    await expect(page.getByTestId("contributor-form-error")).toContainText("Sign in");
    await expect(page.getByTestId("contributor-pending-verification")).toHaveCount(0);
    await expect(page.getByTestId("contributor-active-confirmation")).toHaveCount(0);
  });

  test("a second profile is refused", async ({ page }) => {
    const state = baseState();
    state.createStatus = 409;
    state.createBody = {
      error: { code: "CONTRIBUTOR_PROFILE_EXISTS", profileId: "64b0000000000000000000c1" },
    };
    await useEnglish(page);
    await installApi(page, state);
    await page.goto("/contributor/create");
    await fillAccount(page);
    await fillProfile(page, {
      domain: "Masonry",
      skill: "Plaster",
      country: "Cameroon",
    });
    await page.getByTestId("contributor-submit").click();
    await expect(page.getByTestId("contributor-profile-exists")).toBeVisible();
    await expect(page.getByTestId("contributor-resend")).toHaveCount(0);
  });

  test("rate-limited resend stays on the pending state", async ({ page }) => {
    const state = baseState();
    state.resendStatus = 429;
    state.resendBody = { error: "Too many requests. Please try again later." };
    await useEnglish(page);
    await installApi(page, state);
    await page.goto("/contributor/create");
    await fillAccount(page);
    await fillProfile(page, {
      domain: "Masonry",
      skill: "Plaster",
      country: "Cameroon",
    });
    await page.getByTestId("contributor-submit").click();
    await page.getByTestId("contributor-resend").click();
    await expect(page.getByTestId("contributor-resend-message")).toContainText(
      "Too many requests"
    );
    await expect(page.getByTestId("contributor-pending-verification")).toBeVisible();
    await expect(page.getByTestId("contributor-active-confirmation")).toHaveCount(0);
  });

  test("changing the domain clears skills from the previous domain", async ({ page }) => {
    await useEnglish(page);
    await installApi(page, baseState());
    await page.goto("/contributor/create");
    await page.getByLabel("Primary domain").selectOption({ label: "Masonry" });
    await page.getByRole("button", { name: "Plaster", exact: true }).click();
    await page.getByLabel("Primary domain").selectOption({ label: "Carpentry" });
    await expect(page.getByText("previous domain were cleared")).toBeVisible();
    await expect(page.getByRole("button", { name: "Plaster", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Doors", exact: true })).toBeVisible();
  });

  test("skill selection works from the keyboard", async ({ page }) => {
    await useEnglish(page);
    await installApi(page, baseState());
    await page.goto("/contributor/create");
    await page.getByLabel("Primary domain").selectOption({ label: "Masonry" });
    const skill = page.getByTestId(`contributor-skill-${SKILL_ID}`);
    await skill.focus();
    await page.keyboard.press("Enter");
    await expect(skill).toHaveAttribute("aria-pressed", "true");
  });

  test("the form fits a mobile viewport", async ({ page }) => {
    await useEnglish(page);
    await installApi(page, baseState());
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/contributor/create");
    await expect(page.getByTestId("contributor-create-form")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(overflow).toBe(false);
  });

  test("dashboard and public navigation open the same creation route", async ({
    page,
  }) => {
    await useEnglish(page);
    await installApi(page, baseState());
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.getByTestId("header-register").click();
    await expect(page).toHaveURL(/\/contributor\/create/);
    await expect(page.getByLabel("Username")).toBeVisible();

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
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-quick-actions-sidebar").getByTestId(
      "dashboard-action-create-contributor"
    ).click();
    await expect(page).toHaveURL(/\/contributor\/create/);
  });
});
