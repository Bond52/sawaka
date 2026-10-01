import { expect, test, type Page, type Route } from "@playwright/test";

const USER = {
  token: "user-jwt-token",
  roles: ["acheteur"],
  username: "wilson",
  firstName: "Wilson",
};

const CONTRIBUTOR_PROFILE = {
  id: "profile-1",
  displayName: "Wilson M.",
  biography:
    "Je conçois et fabrique du mobilier en bois avec une attention particulière aux matériaux locaux.",
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
    {
      id: "skill-2",
      nameFR: "Finition du bois",
      nameEN: "Wood finishing",
      isCustom: false,
    },
    { customLabel: "Réemploi", isCustom: true },
  ],
  status: "Active",
  isVisible: true,
};

const PHOTO_SRC = "https://cdn.example/contributor-photo.png";

async function mockProfileImages(page: Page) {
  await page.route("https://cdn.example/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      ),
    });
  });
}

async function setLocale(page: Page, locale: "fr" | "en") {
  await page.addInitScript((value) => {
    window.localStorage.setItem("sawaka-locale", value);
  }, locale);
}

async function seedUser(page: Page) {
  await page.addInitScript((stored) => {
    window.localStorage.setItem("user", JSON.stringify(stored));
  }, USER);
}

async function mockContributorMe(
  page: Page,
  body: unknown,
  status = 200
) {
  await page.route("**/api/contributors/me", async (route: Route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

test.describe("Contributor profile overview (/profile)", () => {
  test("renders contributor data with empty dependent sections in FR", async ({
    page,
  }) => {
    await setLocale(page, "fr");
    await seedUser(page);
    await mockContributorMe(page, { profile: CONTRIBUTOR_PROFILE });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/profile");

    await expect(page.getByTestId("contributor-profile-overview")).toBeVisible();
    await expect(page.getByTestId("contributor-profile-display-name")).toHaveText(
      "Wilson M."
    );
    await expect(page.getByTestId("contributor-profile-domain")).toContainText(
      "Menuiserie"
    );
    await expect(page.getByTestId("contributor-profile-location")).toContainText(
      "Douala"
    );
    await expect(page.getByTestId("contributor-profile-biography")).toBeVisible();
    await expect(page.getByTestId("contributor-profile-skills")).toContainText(
      "Fabrication de meubles"
    );
    await expect(page.getByTestId("contributor-profile-skills")).toContainText(
      "Réemploi"
    );

    const badges = page.getByTestId("contributor-profile-badges");
    const reputation = page.getByTestId("contributor-profile-reputation");
    const realizations = page.getByTestId("contributor-profile-realizations");
    await expect(badges).toBeVisible();
    await expect(page.getByTestId("contributor-profile-badges-empty")).toBeVisible();
    await expect(reputation).toBeVisible();
    await expect(realizations).toBeVisible();
    await expect(
      page.getByTestId("contributor-profile-collaborations-empty")
    ).toBeVisible();
    await expect(page.getByTestId("contributor-profile-reviews-empty")).toBeVisible();

    // Badges must appear before Reputation in the document order.
    const order = await page.evaluate(() => {
      const badgesEl = document.querySelector(
        '[data-testid="contributor-profile-badges"]'
      );
      const reputationEl = document.querySelector(
        '[data-testid="contributor-profile-reputation"]'
      );
      if (!badgesEl || !reputationEl) return -1;
      return badgesEl.compareDocumentPosition(reputationEl) &
        Node.DOCUMENT_POSITION_FOLLOWING
        ? 1
        : 0;
    });
    expect(order).toBe(1);

    // Privacy: account email / password must not appear on contributor overview.
    await expect(page.getByText(/@example\.com/i)).toHaveCount(0);
    await expect(page.getByLabel(/email/i)).toHaveCount(0);
    await expect(page.getByText(/password|mot de passe/i)).toHaveCount(0);
  });

  test("shows empty onboarding state when contributor profile is missing", async ({
    page,
  }) => {
    await setLocale(page, "en");
    await seedUser(page);
    await mockContributorMe(
      page,
      { error: { code: "CONTRIBUTOR_PROFILE_NOT_FOUND" } },
      404
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/profile");

    await expect(page.getByTestId("contributor-profile-empty")).toBeVisible();
    await expect(page.getByTestId("contributor-profile-create-cta")).toHaveAttribute(
      "href",
      "/contributor/create"
    );
  });

  test("shows generic error state for non-404 failures", async ({ page }) => {
    await setLocale(page, "en");
    await seedUser(page);
    await mockContributorMe(page, { error: { code: "SERVER_ERROR" } }, 500);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/profile");

    await expect(page.getByTestId("contributor-profile-error")).toBeVisible();
    await expect(page.getByTestId("contributor-profile-overview")).toHaveCount(0);
    await expect(page.getByTestId("contributor-profile-empty")).toHaveCount(0);
  });

  test("account settings remain available on /settings", async ({ page }) => {
    await setLocale(page, "en");
    await seedUser(page);
    await page.route("**/api/user/profile", async (route: Route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
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
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.locator('input[value="wilson@example.com"]')).toBeVisible();
  });
});

const DOMAIN_ID = "domain-1";
const SKILL_ID = "skill-1";

async function installProfileApi(
  page: Page,
  initial: typeof CONTRIBUTOR_PROFILE & { photoUrl?: string | null } = CONTRIBUTOR_PROFILE
) {
  const state: {
    patches: unknown[];
    photoUploads: number;
    photoRemovals: number;
    profile: typeof CONTRIBUTOR_PROFILE & { photoUrl?: string | null };
  } = {
    patches: [],
    photoUploads: 0,
    photoRemovals: 0,
    profile: structuredClone(initial),
  };

  await page.route(/\/api\/contributors(\/|$|\?)/, async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (method === "GET" && path.endsWith("/api/contributors/domains")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          domains: [
            state.profile.domain,
            {
              id: "domain-2",
              nameFR: "Maçonnerie",
              nameEN: "Masonry",
            },
          ],
        }),
      });
      return;
    }

    const skillsMatch = path.match(/\/domains\/([^/]+)\/skills$/);
    if (method === "GET" && skillsMatch) {
      const skills =
        skillsMatch[1] === DOMAIN_ID
          ? [
              {
                id: SKILL_ID,
                nameFR: "Fabrication de meubles",
                nameEN: "Furniture making",
              },
              {
                id: "skill-2",
                nameFR: "Finition du bois",
                nameEN: "Wood finishing",
              },
            ]
          : [{ id: "skill-3", nameFR: "Enduit", nameEN: "Plaster" }];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ skills }),
      });
      return;
    }

    if (method === "GET" && path.endsWith("/api/contributors/me")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ profile: state.profile }),
      });
      return;
    }

    if (method === "PATCH" && path.endsWith("/api/contributors/me")) {
      const body = request.postDataJSON();
      state.patches.push(body);
      if (!body.displayName || String(body.displayName).trim().length < 2) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "VALIDATION_ERROR", fields: { displayName: "DISPLAY_NAME_REQUIRED" } },
          }),
        });
        return;
      }
      state.profile = {
        ...state.profile,
        displayName: body.displayName,
        biography: body.biography,
        country: body.country,
        region: body.region || "",
        city: body.city || "",
        domain: state.profile.domain,
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ profile: state.profile }),
      });
      return;
    }

    if (method === "POST" && path.endsWith("/api/contributors/me/photo")) {
      state.photoUploads += 1;
      state.profile = {
        ...state.profile,
        photoUrl: PHOTO_SRC,
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ profile: state.profile }),
      });
      return;
    }

    if (method === "DELETE" && path.endsWith("/api/contributors/me/photo")) {
      state.photoRemovals += 1;
      state.profile = { ...state.profile, photoUrl: null };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ profile: state.profile }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "NOT_FOUND" } }),
    });
  });

  return state;
}

test.describe("Contributor profile owner edit mode", () => {
  test("owner sees the edit action and can save updated values", async ({ page }) => {
    await setLocale(page, "fr");
    await seedUser(page);
    const state = await installProfileApi(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/profile");

    const edit = page.getByTestId("contributor-profile-edit");
    await expect(edit).toBeVisible();
    await expect(edit).toHaveText(/Modifier mon profil/);
    await edit.focus();
    await expect(edit).toBeFocused();
    await edit.click();

    await expect(page.getByTestId("contributor-profile-edit-form")).toBeVisible();
    await expect(page.getByLabel("Nom affiché")).toHaveValue("Wilson M.");
    await expect(page.getByLabel(/^Pays$/)).toHaveValue("Cameroun");
    await expect(page.getByLabel("Ville ou localité")).toHaveValue("Douala");
    await expect(page.getByLabel("Biographie")).toHaveValue(CONTRIBUTOR_PROFILE.biography);
    await expect(page.getByTestId("contributor-profile-edit-form")).toContainText("Réemploi");
    await expect(page.getByLabel(/e-mail|email|mot de passe|password/i)).toHaveCount(0);

    await page.getByLabel("Nom affiché").fill("Wilson Menuisier");
    await page.getByLabel("Ville ou localité").fill("Yaoundé");
    await page.getByTestId("contributor-profile-save").click();

    await expect(page.getByTestId("contributor-profile-overview")).toBeVisible();
    await expect(page.getByTestId("contributor-profile-display-name")).toHaveText(
      "Wilson Menuisier"
    );
    await expect(page.getByTestId("contributor-profile-location")).toContainText("Yaoundé");
    await expect(page.getByTestId("contributor-profile-save-success")).toBeVisible();
    await expect(page.getByTestId("contributor-profile-badges")).toBeVisible();
    expect(state.patches).toHaveLength(1);
    expect(state.patches[0]).toMatchObject({
      displayName: "Wilson Menuisier",
      city: "Yaoundé",
      domainId: DOMAIN_ID,
    });
    expect(state.patches[0]).not.toHaveProperty("status");
    expect(state.patches[0]).not.toHaveProperty("email");
    expect(state.patches[0]).not.toHaveProperty("userId");
    expect(state.photoUploads).toBe(0);
  });

  test("cancel discards edits and validation keeps entered values", async ({ page }) => {
    await setLocale(page, "en");
    await seedUser(page);
    const state = await installProfileApi(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/profile");

    await expect(page.getByTestId("contributor-profile-edit")).toHaveText("Edit my profile");
    await page.getByTestId("contributor-profile-edit").click();
    await page.getByLabel("City or locality").fill("Kribi");
    await page.getByTestId("contributor-profile-cancel").click();

    await expect(page.getByTestId("contributor-profile-edit-form")).toHaveCount(0);
    await expect(page.getByTestId("contributor-profile-location")).toContainText("Douala");
    expect(state.patches).toHaveLength(0);

    await page.getByTestId("contributor-profile-edit").click();
    await page.getByLabel("Display name").fill("W");
    await page.getByTestId("contributor-profile-save").click();
    await expect(page.getByTestId("contributor-profile-edit-form")).toBeVisible();
    await expect(page.getByLabel("Display name")).toHaveValue("W");
    await expect(page.getByRole("alert").first()).toBeVisible();
    expect(state.patches).toHaveLength(0);
  });

  test("missing profile does not show the edit action", async ({ page }) => {
    await setLocale(page, "en");
    await seedUser(page);
    await mockContributorMe(
      page,
      { error: { code: "CONTRIBUTOR_PROFILE_NOT_FOUND" } },
      404
    );
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/profile");
    await expect(page.getByTestId("contributor-profile-empty")).toBeVisible();
    await expect(page.getByTestId("contributor-profile-edit")).toHaveCount(0);
  });

  test("owner can preview, save and cancel a profile photo", async ({ page }) => {
    await setLocale(page, "fr");
    await seedUser(page);
    const state = await installProfileApi(page);
    await mockProfileImages(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/profile");

    await expect(page.getByTestId("contributor-profile-avatar")).toBeVisible();
    await expect(page.getByTestId("contributor-profile-photo")).toHaveCount(0);

    await page.getByTestId("contributor-profile-edit").click();
    const section = page.getByTestId("contributor-profile-photo-section");
    await expect(section).toBeVisible();
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(section).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(section).toContainText("Photo de profil");
    await expect(section.getByText("Choisir une photo")).toBeVisible();
    await expect(page.getByLabel("Nom affiché")).toBeVisible();
    const nameBox = await page.getByLabel("Nom affiché").boundingBox();
    const photoBox = await section.boundingBox();
    expect(photoBox && nameBox && photoBox.y < nameBox.y).toBe(true);

    await page.getByTestId("contributor-profile-photo-input").setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an image"),
    });
    await expect(page.getByTestId("contributor-profile-photo-error")).toContainText(
      "Format de fichier non pris en charge"
    );
    await expect(page.getByLabel("Nom affiché")).toHaveValue("Wilson M.");
    expect(state.photoUploads).toBe(0);

    await page.getByTestId("contributor-profile-photo-input").setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      ),
    });
    const preview = page.getByTestId("contributor-profile-photo-preview");
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute("alt", "Photo de profil de Wilson M.");
    await expect(section.getByText("Remplacer la photo")).toBeVisible();

    await page.getByTestId("contributor-profile-cancel").click();
    await expect(page.getByTestId("contributor-profile-edit-form")).toHaveCount(0);
    await expect(page.getByTestId("contributor-profile-avatar")).toBeVisible();
    expect(state.photoUploads).toBe(0);
    expect(state.patches).toHaveLength(0);

    await page.getByTestId("contributor-profile-edit").click();
    await page.getByLabel("Nom affiché").fill("Wilson Menuisier");
    await page.getByTestId("contributor-profile-photo-input").setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      ),
    });
    await page.getByTestId("contributor-profile-save").click();

    await expect(page.getByTestId("contributor-profile-display-name")).toHaveText(
      "Wilson Menuisier"
    );
    const photo = page.getByTestId("contributor-profile-photo");
    await expect(photo).toBeVisible();
    await expect(photo).toHaveAttribute("src", PHOTO_SRC);
    await expect(page.getByTestId("contributor-profile-avatar")).toHaveCount(0);
    expect(state.photoUploads).toBe(1);
    expect(state.patches[0]).toMatchObject({ displayName: "Wilson Menuisier" });
    expect(state.patches[0]).not.toHaveProperty("photoUrl");
  });

  test("owner can remove a photo and the control fits a phone width", async ({ page }) => {
    await setLocale(page, "en");
    await seedUser(page);
    const state = await installProfileApi(page, {
      ...CONTRIBUTOR_PROFILE,
      photoUrl: "https://cdn.example/existing.png",
    });
    await mockProfileImages(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/profile");

    const photo = page.getByTestId("contributor-profile-photo");
    await expect(photo).toBeVisible();
    await expect(photo).toHaveAttribute("alt", "Profile photo of Wilson M.");

    await page.getByTestId("contributor-profile-edit").click();
    await expect(page.getByText("Profile photo")).toBeVisible();
    await expect(page.getByText("Replace photo")).toBeVisible();
    await expect(page.getByTestId("contributor-profile-photo-preview")).toBeVisible();
    await page.getByTestId("contributor-profile-photo-remove").click();
    await expect(page.getByTestId("contributor-profile-avatar")).toBeVisible();
    await expect(page.getByText("Choose photo")).toBeVisible();
    await page.getByTestId("contributor-profile-save").click();

    await expect(page.getByTestId("contributor-profile-edit-form")).toHaveCount(0);
    await expect(page.getByTestId("contributor-profile-avatar")).toBeVisible();
    await expect(page.getByTestId("contributor-profile-photo")).toHaveCount(0);
    expect(state.photoRemovals).toBe(1);
    expect(state.photoUploads).toBe(0);
    await expect(page.getByTestId("contributor-profile-skills")).toBeVisible();
  });
});
