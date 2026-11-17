import { expect, test, type Page, type Route } from "@playwright/test";

const garden = {
  id: "proj-garden",
  title: "Community garden",
  summary: "Grow food together.",
  description: "A shared garden for the neighborhood.",
  objective: "Improve food access.",
  category: "agriculture-livestock-and-agro-processing",
  country: "CM",
  city: "Douala",
  status: "published" as const,
  publishedAt: "2026-11-16T00:00:00.000Z",
  commentAccess: "members" as const,
  discoveryStatus: "in_progress" as const,
  coverImage: null,
  images: [],
  stages: [],
};

const atelier = {
  id: "proj-atelier",
  title: "Sewing workshop",
  summary: "Learn to sew.",
  description: "Community textile training.",
  objective: "Local jobs.",
  category: "textile-fashion-and-sewing",
  country: "CA",
  city: "Montreal",
  status: "published" as const,
  publishedAt: "2026-11-15T00:00:00.000Z",
  commentAccess: "members" as const,
  discoveryStatus: "in_progress" as const,
  coverImage: null,
  images: [],
  stages: [],
};

function matches(project: typeof garden, params: URLSearchParams) {
  const q = (params.get("q") || "").toLowerCase();
  if (q && !`${project.title} ${project.summary} ${project.description}`.toLowerCase().includes(q)) {
    return false;
  }
  if (params.get("category") && project.category !== params.get("category")) return false;
  if (params.get("country") && project.country !== params.get("country")) return false;
  if (params.get("city")) {
    const city = (params.get("city") || "").toLowerCase();
    if (!project.city.toLowerCase().includes(city)) return false;
  }
  return true;
}

async function mockDirectory(page: Page) {
  await page.route("**/api/projects**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname.endsWith("/api/projects")) {
      const projects = [garden, atelier].filter((item) => matches(item, url.searchParams));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projects,
          page: 1,
          limit: 24,
          total: projects.length,
          totalPages: 1,
        }),
      });
      return;
    }
    await route.fallback();
  });
}

test("directory search and combined filters work on desktop and mobile", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("sawaka-locale", "en"));
  await mockDirectory(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/projets");

  await expect(page.getByTestId("project-directory-filters")).toBeVisible();
  await page.getByTestId("project-search").fill("garden");
  await page.getByTestId("project-filters-apply").click();
  await expect(page.getByTestId(`public-project-card-${garden.id}`)).toBeVisible();
  await expect(page.getByTestId(`public-project-card-${atelier.id}`)).toHaveCount(0);
  await expect(page.getByTestId("project-active-filters")).toContainText("garden");

  await page.getByTestId("project-filters-reset").click();
  await expect(page.getByTestId(`public-project-card-${atelier.id}`)).toBeVisible();

  await page.getByTestId("project-filters-toggle").click();
  await page.getByTestId("filter-category").selectOption("agriculture-livestock-and-agro-processing");
  await page.getByTestId("filter-country").selectOption("CM");
  await page.getByTestId("filter-city").fill("Douala");
  await page.getByTestId("project-filters-apply").click();
  await expect(page.getByTestId(`public-project-card-${garden.id}`)).toBeVisible();
  await expect(page.getByTestId(`public-project-card-${atelier.id}`)).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/projets?q=sewing");
  await expect(page.getByTestId(`public-project-card-${atelier.id}`)).toBeVisible();
  await expect(page.getByTestId("project-search")).toBeVisible();
});

test("directory empty and FR labels remain usable", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("sawaka-locale", "fr"));
  await mockDirectory(page);
  await page.goto("/projets?q=inexistant");
  await expect(page.getByTestId("public-projects-empty")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Explorer les projets" })).toBeVisible();
});
