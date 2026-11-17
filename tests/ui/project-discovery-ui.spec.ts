import { expect, test, type Page, type Route } from "@playwright/test";

const published = {
  id: "proj-discovery-1",
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
  stages: [
    {
      id: "stage-1",
      title: "Prepare soil",
      description: "",
      position: 0,
      status: "in_progress",
      blockerExplanation: "",
      needs: [],
      images: [],
    },
  ],
};

async function mockDirectory(page: Page) {
  await page.route("**/api/projects**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() === "GET" && path.endsWith("/api/projects")) {
      const status = url.searchParams.get("discoveryStatus");
      const projects =
        !status || status === published.discoveryStatus ? [published] : [];
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
    if (request.method() === "GET" && path.endsWith(`/api/projects/${published.id}`)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ project: published, viewerCanModerate: false }),
      });
      return;
    }
    if (request.method() === "GET" && path.includes("/comments")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ commentAccess: "members", comments: [] }),
      });
      return;
    }
    await route.fallback();
  });
}

test("filters are collapsed by default and preserve selections", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("sawaka-locale", "en"));
  await mockDirectory(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/projets");

  await expect(page.getByTestId("project-filters-toggle")).toHaveAttribute(
    "aria-expanded",
    "false"
  );
  await expect(page.getByTestId("project-filters-panel")).toHaveCount(0);

  await page.getByTestId("project-filters-toggle").click();
  await expect(page.getByTestId("project-filters-panel")).toBeVisible();
  await page.getByTestId("filter-country").selectOption("CM");
  await page.getByTestId("filter-discovery-status").selectOption("in_progress");
  await page.getByTestId("project-filters-apply").click();
  await expect(page.getByTestId("project-active-filters")).toContainText("Cameroon");
  await expect(page.getByTestId("project-active-filters")).toContainText("In Progress");

  await page.getByTestId("project-filters-toggle").click();
  await expect(page.getByTestId("project-filters-panel")).toHaveCount(0);
  await expect(page.getByTestId("project-active-filters")).toContainText("Cameroon");

  await page.getByTestId("project-filters-reset").click();
  await expect(page.getByTestId("project-active-filters")).toHaveCount(0);
});

test("project status appears on cards and detail", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("sawaka-locale", "en"));
  await mockDirectory(page);
  await page.goto("/projets");
  await expect(page.getByTestId(`public-project-card-${published.id}`)).toContainText(
    "In Progress"
  );
  await page.goto(`/projets/${published.id}`);
  await expect(page.getByTestId("public-project-status")).toHaveAttribute(
    "data-status",
    "in_progress"
  );
  await expect(page.getByTestId("public-project-status")).toContainText("In Progress");
  await expect(page.getByTestId("public-project-my-projects")).toHaveText("My Projects");
});

test("French navigation and filter labels", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("sawaka-locale", "fr"));
  await mockDirectory(page);
  await page.goto(`/projets/${published.id}`);
  await expect(page.getByTestId("public-project-my-projects")).toHaveText("Mes projets");
  await expect(page.getByTestId("public-project-status")).toContainText("En cours");

  await page.goto("/projets");
  await page.getByTestId("project-filters-toggle").click();
  await expect(page.getByTestId("project-filters-toggle")).toContainText("Filtres");
});

test("mobile directory has no horizontal overflow", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("sawaka-locale", "en"));
  await mockDirectory(page);
  for (const width of [375, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/projets");
    await page.getByTestId("project-filters-toggle").click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
