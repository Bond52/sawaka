import { expect, test, type Page, type Route } from "@playwright/test";

const published = {
  id: "proj-public-1",
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
  coverImage: null,
  images: [],
  stages: [
    {
      id: "stage-1",
      title: "Prepare soil",
      description: "Clear and enrich the plot.",
      position: 0,
      status: "in_progress",
      blockerExplanation: "",
      needs: [
        {
          id: "need-1",
          title: "Compost",
          description: "",
          kind: "resource",
          status: "open",
          blockerExplanation: "",
        },
      ],
      images: [],
    },
  ],
};

async function mockPublic(page: Page) {
  await page.route("**/api/projects**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET" && path.endsWith("/api/projects")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projects: [published],
          page: 1,
          limit: 24,
          total: 1,
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
    if (
      request.method() === "GET" &&
      (path.endsWith(`/api/projects/${published.id}/comments`) ||
        path.includes(`/api/projects/${published.id}/needs/`))
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ commentAccess: published.commentAccess, comments: [] }),
      });
      return;
    }
    if (request.method() === "GET" && path.includes("/api/projects/draft-hidden")) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "NOT_FOUND" } }),
      });
      return;
    }
    await route.fallback();
  });
}

test("public projects page lists published projects in FR and EN", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("sawaka-locale", "en"));
  await mockPublic(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/projets");
  await expect(page.getByTestId("public-projects-list")).toBeVisible();
  await expect(page.getByTestId(`public-project-card-${published.id}`)).toContainText(
    "Community garden"
  );
  await expect(page.getByTestId(`public-project-card-${published.id}`)).toContainText(
    "Agriculture, Livestock & Agro-processing"
  );

  await page.addInitScript(() => window.localStorage.setItem("sawaka-locale", "fr"));
  await page.goto("/projets");
  await expect(page.getByRole("heading", { name: "Explorer les projets" })).toBeVisible();
});

test("project detail shows stages and hides drafts", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("sawaka-locale", "en"));
  await mockPublic(page);
  await page.goto(`/projets/${published.id}`);
  await expect(page.getByTestId("public-project-detail")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Community garden" })).toBeVisible();
  await expect(page.getByTestId("public-stage-stage-1")).toContainText("Prepare soil");
  await expect(page.getByTestId("public-stage-stage-1")).toContainText("Compost");

  await page.goto("/projets/draft-hidden");
  await expect(page.getByTestId("public-project-error")).toBeVisible();
});

test("AI ideation route remains available", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("sawaka-locale", "en"));
  await page.goto("/projets/creer");
  await expect(page.getByRole("heading", { name: "Create a project" })).toBeVisible();
});
