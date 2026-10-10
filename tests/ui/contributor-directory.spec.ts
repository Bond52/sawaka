import { expect, test, type Page, type Route } from "@playwright/test";

const DOMAIN = {
  id: "aaaaaaaaaaaaaaaaaaaaaaaa",
  nameFR: "Menuiserie",
  nameEN: "Carpentry",
};
const SKILL_A = {
  id: "bbbbbbbbbbbbbbbbbbbbbbbb",
  nameFR: "Fabrication de meubles",
  nameEN: "Furniture making",
};
const SKILL_B = {
  id: "cccccccccccccccccccccccc",
  nameFR: "Finition",
  nameEN: "Finishing",
};

const WILSON = {
  id: "111111111111111111111111",
  displayName: "Wilson M.",
  biography: "Je conçois du mobilier en bois local.",
  country: "Cameroun",
  region: "Littoral",
  city: "Douala",
  domain: DOMAIN,
  skills: [{ ...SKILL_A, isCustom: false }],
  photoUrl: null,
  email: "hidden@example.com",
  userId: "user-private",
  status: "Active",
};

async function setLocale(page: Page, locale: "fr" | "en") {
  await page.addInitScript((value) => {
    window.localStorage.setItem("sawaka-locale", value);
  }, locale);
}

async function mockDirectory(page: Page) {
  await page.route("**/api/contributors**", async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    if (path.endsWith("/domains") && !path.includes("/skills")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ domains: [DOMAIN] }),
      });
      return;
    }
    if (path.endsWith("/skills")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ skills: [SKILL_A, SKILL_B] }),
      });
      return;
    }
    if (path.endsWith(`/contributors/${WILSON.id}`)) {
      const { email, userId, status, ...profile } = WILSON;
      void email;
      void userId;
      void status;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ profile }),
      });
      return;
    }
    if (path.endsWith("/contributors/hidden-profile")) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "CONTRIBUTOR_PROFILE_NOT_FOUND" } }),
      });
      return;
    }
    if (path.endsWith("/contributors")) {
      const q = url.searchParams.get("q") || "";
      const domainId = url.searchParams.get("domainId") || "";
      const skillIds = url.searchParams.get("skillIds") || "";
      const country = url.searchParams.get("country") || "";
      const region = url.searchParams.get("region") || "";
      const city = url.searchParams.get("city") || "";
      const filtered =
        q === "missing" ||
        (domainId && domainId !== DOMAIN.id) ||
        (skillIds && !skillIds.includes(SKILL_A.id)) ||
        (country && country.toLowerCase() !== "cameroun") ||
        (region && region.toLowerCase() !== "littoral") ||
        (city && city.toLowerCase() !== "douala");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ profiles: filtered ? [] : [WILSON] }),
      });
      return;
    }
    await route.continue();
  });
}

test.describe("Contributor directory (/reseau)", () => {
  test("opens the contributor directory without the supplier selector", async ({ page }) => {
    await setLocale(page, "fr");
    await mockDirectory(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/reseau");
    await page.getByRole("button", { name: "FR" }).click();

    await expect(page.getByRole("heading", { name: "Artisans" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Fournisseurs" })).toHaveCount(0);
    await expect(page.getByTestId("contributor-directory-search")).toBeVisible();
    await expect(page.getByTestId("contributor-directory-card")).toBeVisible();
    await expect(page.getByText("hidden@example.com")).toHaveCount(0);
    await expect(page.getByText("user-private")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Fournisseurs" })).toHaveAttribute(
      "href",
      "/fournisseurs"
    );

    const card = page.getByTestId("contributor-directory-card");
    await expect(card).toHaveAttribute("href", `/contributors/${WILSON.id}`);
    await card.focus();
    await expect(card).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/contributors/${WILSON.id}$`));
    await expect(page.getByTestId("contributor-profile-display-name")).toHaveText("Wilson M.");
    await expect(page.getByTestId("contributor-profile-skills")).toContainText(
      "Fabrication de meubles"
    );
    await expect(page.getByTestId("contributor-profile-badges")).toBeVisible();
    await expect(page.getByTestId("contributor-profile-tab-realizations")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByTestId("contributor-profile-tab-collaborations")).toBeVisible();
    await expect(page.getByTestId("contributor-profile-tab-profile")).toHaveCount(0);
    await expect(page.getByRole("tab")).toHaveCount(2);
    await expect(page.getByTestId("contributor-profile-reviews")).toBeVisible();
    await expect(page.getByTestId("contributor-profile-reputation")).toHaveCount(0);
    await expect(page.getByTestId("contributor-profile-edit")).toHaveCount(0);
    await expect(page.getByTestId("contributor-profile-deactivate-open")).toHaveCount(0);
    await expect(page.getByText("hidden@example.com")).toHaveCount(0);
    await expect(page.getByTestId("contributor-profile-overview")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)"
    );
  });

  test("filters in English and resets to the public directory", async ({ page }) => {
    await setLocale(page, "en");
    await mockDirectory(page);
    await page.goto("/reseau");

    await expect(page.getByRole("heading", { name: "Contributors" })).toBeVisible();
    await expect(page.getByTestId("contributor-directory-search")).toHaveAttribute(
      "placeholder",
      "Search contributors..."
    );
    await page.getByTestId("contributor-directory-search").fill("missing");
    await expect(page.getByTestId("contributor-directory-no-results")).toHaveText(
      "No contributors match your search."
    );
    await page.getByTestId("contributor-directory-reset").click();
    await expect(page.getByTestId("contributor-directory-card")).toBeVisible();

    await page.getByTestId("contributor-directory-filters").locator("summary").click();
    await page.getByTestId("contributor-directory-domain").selectOption(DOMAIN.id);
    await page.getByTestId(`contributor-directory-skill-${SKILL_A.id}`).check();
    await page.getByTestId("contributor-directory-country").fill("Cameroun");
    await page.getByTestId("contributor-directory-region").fill("Littoral");
    await page.getByTestId("contributor-directory-city").fill("Douala");
    await expect(page.getByTestId("contributor-directory-card")).toBeVisible();
    await expect(page.getByTestId("contributor-directory-skill-rule")).toContainText(
      "at least one selected skill"
    );

    await page.getByTestId("contributor-directory-city").fill("Yaoundé");
    await expect(page.getByTestId("contributor-directory-no-results")).toBeVisible();
  });

  test("hides an ineligible public profile", async ({ page }) => {
    await setLocale(page, "en");
    await mockDirectory(page);
    await page.goto("/contributors/hidden-profile");
    await expect(page.getByTestId("contributor-profile-unavailable")).toBeVisible();
    await expect(page.getByText("This contributor profile is not available.")).toBeVisible();
    await expect(page.getByTestId("contributor-profile-display-name")).toHaveCount(0);
    await expect(page.getByTestId("contributor-profile-edit")).toHaveCount(0);
    await expect(page.getByTestId("contributor-profile-deactivate-open")).toHaveCount(0);
  });

  test("keeps the directory usable on tablet and phone widths", async ({ page }) => {
    await setLocale(page, "fr");
    await mockDirectory(page);
    for (const width of [768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/reseau");
      await expect(page.getByTestId("contributor-directory-search")).toBeVisible();
      await expect(page.getByTestId("contributor-directory-card")).toBeVisible();
      const fits = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
      );
      expect(fits).toBe(true);
    }
  });
});
