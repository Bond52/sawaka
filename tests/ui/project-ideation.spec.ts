import { expect, test, type Page, type Route } from "@playwright/test";

const sampleIdea = {
  title: "Community cassava drying",
  summary: "Dry cassava with neighbors.",
  description: "A shared drying initiative.",
  objective: "Improve local food processing.",
  category: "agriculture-livestock-and-agro-processing",
  country: "CM",
  city: "Douala",
  relevance: "Matches agriculture interests.",
  budgetNotes: "Around 150000 XAF",
  challenges: ["Weather dependency"],
  stages: [
    {
      title: "Prepare site",
      description: "Find a drying area.",
      needs: [
        {
          title: "Agronomy advice",
          description: "Guidance on drying practices.",
          kind: "skill",
          matchedContributors: [
            {
              id: "c1",
              kind: "contributor",
              label: "Amina Grower",
              detail: "agriculture",
              location: "Douala, CM",
              href: "/contributors/c1",
            },
          ],
          matchedSuppliers: [],
          missingCapabilities: [],
        },
      ],
    },
    {
      title: "Source materials",
      description: "Buy trays and storage.",
      needs: [
        {
          title: "Drying trays",
          description: "Basic equipment.",
          kind: "resource",
          matchedContributors: [],
          matchedSuppliers: [
            {
              id: "s1",
              kind: "supplier",
              label: "Douala Seeds",
              detail: "agriculture",
              location: "Douala, CM",
              href: "/fournisseurs/s1",
            },
          ],
          missingCapabilities: ["Specialized dryer"],
        },
      ],
    },
  ],
};

async function mockIdeation(page: Page) {
  await page.route("**/api/project-ideas/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() === "POST" && path.endsWith("/api/project-ideas/generate")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ideas: [sampleIdea],
          criteria: { interests: "agriculture" },
          ecosystem: { contributorCount: 1, supplierCount: 1 },
          provider: "mock",
        }),
      });
      return;
    }
    if (request.method() === "POST" && path.endsWith("/api/project-ideas/mine")) {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ idea: { ...sampleIdea, id: "idea-1" } }),
      });
      return;
    }
    if (request.method() === "GET" && path.endsWith("/api/project-ideas/mine")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ideas: [] }),
      });
      return;
    }
    if (request.method() === "POST" && path.endsWith("/api/project-ideas/convert")) {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          project: {
            id: "proj-from-idea",
            title: sampleIdea.title,
            status: "draft",
            visibility: "private",
            stages: [],
          },
        }),
      });
      return;
    }
    await route.fallback();
  });
}

test("home How It Works opens ideation and anonymous visitors can generate", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("sawaka-locale", "en"));
  await mockIdeation(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await expect(page.getByTestId("how-it-works")).toBeVisible();
  await expect(page.getByRole("heading", { name: "How It Works" })).toBeVisible();
  await page.getByTestId("how-it-works-cta").click();
  await expect(page).toHaveURL(/\/projets\/creer/);
  await expect(page.getByTestId("ideation-form")).toBeVisible();

  await page.getByTestId("ideation-interests").fill("urban farming");
  await page.getByTestId("ideation-generate").click();
  await expect(page.getByTestId("ideation-results")).toBeVisible();
  await expect(page.getByTestId("idea-card-0")).toContainText("Community cassava drying");
  await expect(page.getByTestId("idea-stage-0-0")).toBeVisible();
  await expect(page.getByText("Amina Grower")).toBeVisible();
  await expect(page.getByText("Specialized dryer")).toBeVisible();

  await page.getByTestId("ideation-save-0").click();
  await expect(page).toHaveURL(/\/login/);
});

test("French labels and mobile ideation layout", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("sawaka-locale", "fr"));
  await mockIdeation(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Comment ça marche" })).toBeVisible();
  await page.getByTestId("how-it-works-cta").click();
  await expect(page.getByRole("heading", { name: "Générer des idées de projets" })).toBeVisible();
  await page.getByTestId("ideation-interests").fill("couture");
  await page.getByTestId("ideation-generate").click();
  await expect(page.getByTestId("ideation-results")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("authenticated member can save and create a project from an idea", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("sawaka-locale", "en");
    window.localStorage.setItem(
      "user",
      JSON.stringify({
        token: "test-token",
        roles: ["acheteur"],
        username: "amina",
        firstName: "Amina",
      })
    );
  });
  await mockIdeation(page);
  await page.route("**/api/projects/mine/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        project: {
          id: "proj-from-idea",
          title: sampleIdea.title,
          summary: sampleIdea.summary,
          description: sampleIdea.description,
          objective: sampleIdea.objective,
          category: sampleIdea.category,
          country: "CM",
          city: "Douala",
          commentAccess: "members",
          discoveryStatus: "not_started",
          status: "draft",
          visibility: "private",
          coverImage: null,
          images: [],
          stages: [],
        },
      }),
    });
  });

  await page.goto("/projets/creer");
  await page.getByTestId("ideation-interests").fill("agriculture");
  await page.getByTestId("ideation-generate").click();
  await expect(page.getByTestId("idea-card-0")).toBeVisible();
  await page.getByTestId("ideation-save-0").click();
  await expect(page.getByTestId("saved-ideas")).toContainText("Community cassava drying");
  await page.getByTestId("ideation-create-0").click();
  await expect(page).toHaveURL(/\/mes-projets\/proj-from-idea\/modifier/);
});
