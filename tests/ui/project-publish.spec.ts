import { expect, test, type Page, type Route } from "@playwright/test";

type StoredProject = {
  id: string;
  title: string;
  summary: string;
  description: string;
  objective: string;
  category: string;
  country: string;
  city: string;
  status: "draft" | "published";
  visibility: "private" | "public";
};

const REQUIRED = ["title", "description", "objective", "category", "country", "city"] as const;

function project(): StoredProject {
  return {
    id: "proj-9",
    title: "Poulailler",
    summary: "",
    description: "",
    objective: "",
    category: "",
    country: "",
    city: "",
    status: "draft",
    visibility: "private",
  };
}

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

test("publishing reports missing fields, then confirms a complete project", async ({ page }) => {
  const stored = project();
  await signIn(page);
  await page.route("**/api/projects/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET" && path.endsWith("/api/projects/mine/proj-9")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ project: { ...stored, coverImage: null, images: [], stages: [] } }),
      });
      return;
    }
    if (request.method() === "GET" && path.endsWith("/api/projects/proj-9")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          project: {
            id: stored.id,
            title: stored.title,
            summary: stored.summary,
            description: stored.description,
            objective: stored.objective,
            category: stored.category,
            country: stored.country,
            city: stored.city,
            status: "published",
            publishedAt: "2026-11-16T00:00:00.000Z",
            coverImage: null,
            images: [],
            stages: [],
          },
        }),
      });
      return;
    }
    if (request.method() === "POST" && path.endsWith("/publish")) {
      const body = request.postDataJSON() as Partial<StoredProject>;
      Object.assign(stored, body);
      const missing = REQUIRED.filter((field) => !String(stored[field] || "").trim());
      if (missing.length > 0) {
        await route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "PUBLICATION_INCOMPLETE", fields: missing } }),
        });
        return;
      }
      stored.status = "published";
      stored.visibility = "public";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ project: { ...stored, coverImage: null, images: [], stages: [] } }),
      });
      return;
    }
    await route.fallback();
  });

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/mes-projets/proj-9/modifier");
  await page.getByTestId("project-publish").click();
  await expect(page.getByTestId("project-form-error")).toHaveText(
    "Complete the required fields before publishing."
  );
  await expect(page.getByTestId("project-field-description")).toHaveValue("");
  await expect(page.getByTestId("project-field-title")).toHaveValue("Poulailler");

  await page.getByTestId("project-field-description").fill("A shared poultry yard.");
  await page.getByTestId("project-field-objective").fill("Feed the neighborhood.");
  await page.getByTestId("project-field-category").selectOption("agriculture-livestock-and-agro-processing");
  await page.getByTestId("project-field-country").selectOption("CM");
  await page.getByTestId("project-field-city").fill("Douala");
  await page.getByTestId("project-publish").click();
  await expect(page).toHaveURL(/\/projets\/proj-9/);
  await expect(page.getByTestId("public-project-detail")).toBeVisible();
});
