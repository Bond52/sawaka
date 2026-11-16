import { expect, test, type Page, type Route } from "@playwright/test";

const projects = [
  {
    id: "proj-draft",
    title: "Draft workshop",
    summary: "Still preparing the idea.",
    description: "",
    objective: "",
    category: "ceramics-glass-and-traditional-crafts",
    country: "CM",
    city: "Douala",
    status: "draft",
    visibility: "private",
    coverImage: null,
    images: [],
    stages: [],
  },
  {
    id: "proj-live",
    title: "Published garden",
    summary: "Open to the neighborhood.",
    description: "A garden.",
    objective: "Grow food.",
    category: "agriculture-livestock-and-agro-processing",
    country: "CG",
    city: "Brazzaville",
    status: "published",
    visibility: "public",
    coverImage: null,
    images: [],
    stages: [],
  },
];

async function signIn(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("sawaka-locale", "en");
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
}

async function mockMine(page: Page) {
  await page.route("**/api/projects**", async (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "GET" && path.endsWith("/api/projects/mine")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ projects }),
      });
      return;
    }
    await route.fallback();
  });
}

const VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

for (const viewport of VIEWPORTS) {
  test(`My Projects stays usable at ${viewport.width}px`, async ({ page }) => {
    await signIn(page);
    await mockMine(page);
    await page.setViewportSize(viewport);
    await page.goto("/mes-projets");

    await expect(page.getByTestId("my-projects-create")).toBeVisible();
    await expect(page.getByTestId("my-projects-status-proj-draft")).toHaveText("Draft");
    await expect(page.getByTestId("my-projects-status-proj-live")).toHaveText("Published");
    await expect(page.getByTestId("my-projects-edit-proj-draft")).toBeVisible();
    await expect(page.getByTestId("my-projects-view-proj-live")).toBeVisible();
    await expect(page.getByTestId("my-projects-edit-proj-live")).toBeVisible();

    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth - document.documentElement.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("project form selectors are keyboard accessible on mobile", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mes-projets/nouveau");

  const category = page.getByTestId("project-field-category");
  const country = page.getByTestId("project-field-country");
  const city = page.getByTestId("project-field-city");

  await category.focus();
  await expect(category).toBeFocused();
  await category.selectOption("agriculture-livestock-and-agro-processing");
  await country.selectOption("CG");
  await city.fill("Pointe-Noire");
  await expect(city).toHaveValue("Pointe-Noire");
  await expect(category).toHaveValue("agriculture-livestock-and-agro-processing");
  await expect(country).toHaveValue("CG");
});
