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
