import { expect, test, type Page, type Route } from "@playwright/test";

test("an owner adds a stage and marks it blocked", async ({ page }) => {
  const project = {
    id: "proj-stage",
    title: "Poultry yard",
    summary: "",
    description: "A shared yard.",
    objective: "Feed the neighborhood.",
    category: "Agriculture",
    country: "Cameroon",
    city: "Douala",
    status: "draft",
    visibility: "private",
    stages: [] as Array<Record<string, unknown>>,
  };

  await page.addInitScript(() => {
    window.localStorage.setItem("sawaka-locale", "fr");
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

  await page.route("**/api/projects/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET" && path.endsWith("/mine/proj-stage")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ project }),
      });
      return;
    }
    if (request.method() === "POST" && path.endsWith("/stages")) {
      const body = request.postDataJSON() as { title: string; description: string };
      project.stages.push({
        id: "stage-1",
        title: body.title,
        description: body.description,
        position: 0,
        status: "not_started",
        blockerExplanation: "",
      });
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ project }),
      });
      return;
    }
    if (request.method() === "PATCH" && path.endsWith("/stages/stage-1")) {
      const body = request.postDataJSON() as { status?: string; blockerExplanation?: string };
      Object.assign(project.stages[0], body);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ project }),
      });
      return;
    }
    await route.fallback();
  });

  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/mes-projets/proj-stage/modifier");
  await page.getByTestId("new-stage-title").fill("Préparer le terrain");
  await page.getByTestId("project-stage-add").click();
  await expect(page.getByTestId("project-stage-list")).toBeVisible();
  await page.getByTestId("stage-status-stage-1").selectOption("blocked");
  await expect(page.getByLabel("Explication du blocage")).toBeVisible();
  await page.getByLabel("Explication du blocage").fill("Le grillage manque.");
  await page.getByLabel("Explication du blocage").blur();
  await expect(page.getByLabel("Explication du blocage")).toHaveValue("Le grillage manque.");
});
