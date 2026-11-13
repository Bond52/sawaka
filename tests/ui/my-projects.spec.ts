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
  status: "draft";
  visibility: "private";
};

function blank(partial: Partial<StoredProject> = {}): StoredProject {
  return {
    id: partial.id || "proj-1",
    title: partial.title || "",
    summary: partial.summary || "",
    description: partial.description || "",
    objective: partial.objective || "",
    category: partial.category || "",
    country: partial.country || "",
    city: partial.city || "",
    status: "draft",
    visibility: "private",
  };
}

async function setLocale(page: Page, locale: "fr" | "en") {
  await page.addInitScript((value) => {
    window.localStorage.setItem("sawaka-locale", value);
  }, locale);
}

async function signIn(page: Page) {
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
}

async function mockProjects(page: Page, projects: StoredProject[]) {
  await page.route("**/api/projects**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === "GET" && path.endsWith("/api/projects/mine")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ projects }),
      });
      return;
    }

    if (method === "POST" && path.endsWith("/api/projects")) {
      const body = request.postDataJSON() as Partial<StoredProject>;
      const created = blank({ ...body, id: "proj-1" });
      projects.splice(0, projects.length, created);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ project: created }),
      });
      return;
    }

    const owned = path.match(/\/api\/projects\/mine\/([^/]+)$/);
    if (owned && method === "GET") {
      const project = projects.find((item) => item.id === owned[1]);
      await route.fulfill({
        status: project ? 200 : 404,
        contentType: "application/json",
        body: JSON.stringify(project ? { project } : { error: { code: "NOT_FOUND" } }),
      });
      return;
    }

    if (owned && method === "PATCH") {
      const body = request.postDataJSON() as Partial<StoredProject>;
      const current = projects.find((item) => item.id === owned[1]);
      if (!current) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "NOT_FOUND" } }),
        });
        return;
      }
      Object.assign(current, blank({ ...current, ...body, id: current.id }));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ project: current }),
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

test.describe("My Projects navigation", () => {
  test("sends anonymous visitors to the login page", async ({ page }) => {
    await setLocale(page, "fr");
    await page.goto("/mes-projets");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fmes-projets$/);
    await expect(page.getByTestId("login-form")).toBeVisible();
  });

  test("French desktop flow creates a draft and reopens it for editing", async ({ page }) => {
    const projects: StoredProject[] = [];
    await setLocale(page, "fr");
    await signIn(page);
    await mockProjects(page, projects);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    await page.getByTestId("header-user-menu").click();
    await page.getByTestId("header-my-projects").click();
    await expect(page).toHaveURL(/\/mes-projets$/);
    await expect(page.getByTestId("my-projects-empty")).toBeVisible();

    await page.getByTestId("my-projects-create").click();
    await expect(page).toHaveURL(/\/mes-projets\/nouveau$/);
    await page.getByLabel("Titre").fill("Poulailler");
    await page.getByTestId("project-save").click();

    await expect(page).toHaveURL(/\/mes-projets\/proj-1\/modifier$/);
    await expect(page.getByTestId("project-save-status")).toHaveText("Brouillon enregistré.");
    await expect(page.getByLabel("Titre")).toHaveValue("Poulailler");

    await page.getByTestId("project-back").click();
    await expect(page.getByTestId("my-projects-edit-proj-1")).toBeVisible();
    await page.getByTestId("my-projects-edit-proj-1").click();
    await page.getByLabel("Objectif").fill("Nourrir le quartier");
    await page.getByTestId("project-save").click();
    await expect(page.getByTestId("project-draft-form").getByTestId("project-save-status")).toHaveText(
      "Brouillon enregistré."
    );
    await expect(page.getByLabel("Objectif")).toHaveValue("Nourrir le quartier");
  });

  test("English mobile flow saves an incomplete draft", async ({ page }) => {
    const projects: StoredProject[] = [];
    await setLocale(page, "en");
    await signIn(page);
    await mockProjects(page, projects);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await page.getByRole("button", { name: /open menu/i }).click();
    await page.getByTestId("header-mobile-my-projects").click();
    await expect(page).toHaveURL(/\/mes-projets$/);
    await page.getByTestId("my-projects-create").click();
    await page.getByTestId("project-save").click();
    await expect(page).toHaveURL(/\/mes-projets\/proj-1\/modifier$/);
    await expect(page.getByTestId("project-save-status")).toHaveText("Draft saved.");
    await expect(page.getByLabel("Title")).toHaveValue("");
  });

  test("keeps the existing AI project ideation page", async ({ page }) => {
    await setLocale(page, "en");
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/projets/creer");
    await expect(page.getByRole("heading", { name: "Create a project" })).toBeVisible();
    await expect(page.getByText("Enter your budget and city to explore possibilities.")).toBeVisible();
  });
});
