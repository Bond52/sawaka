import { expect, test } from "@playwright/test";

test("shows unavailable progress, then 50 percent after a completed stage", async ({ page }) => {
  const project = {
    id: "proj-progress",
    title: "Yard",
    summary: "",
    description: "",
    objective: "",
    category: "",
    country: "",
    city: "",
    status: "draft",
    visibility: "private",
    stages: [] as Array<{ id: string; title: string; description: string; position: number; status: string; blockerExplanation: string }>,
  };

  await page.addInitScript(() => {
    window.localStorage.setItem("sawaka-locale", "en");
    window.localStorage.setItem(
      "user",
      JSON.stringify({ token: "user-jwt-token", roles: ["acheteur"], username: "amina", firstName: "Amina" })
    );
  });
  await page.route("**/api/projects/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ project }),
      });
      return;
    }
    if (request.method() === "POST" && path.endsWith("/stages")) {
      const body = request.postDataJSON() as { title: string };
      project.stages.push({
        id: `stage-${project.stages.length + 1}`,
        title: body.title,
        description: "",
        position: project.stages.length,
        status: project.stages.length === 0 ? "completed" : "not_started",
        blockerExplanation: "",
      });
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ project }),
      });
      return;
    }
    await route.fallback();
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/mes-projets/proj-progress/modifier");
  await expect(page.getByTestId("project-progress")).toHaveText("Progress unavailable");
  await page.getByTestId("new-stage-title").fill("Prepare");
  await page.getByTestId("project-stage-add").click();
  await expect(page.getByTestId("project-progress")).toHaveText("Progress: 100%");
  await page.getByTestId("new-stage-title").fill("Welcome");
  await page.getByTestId("project-stage-add").click();
  await expect(page.getByTestId("project-progress")).toHaveText("Progress: 50%");
});
