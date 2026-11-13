import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, locale: "fr" | "en") {
  await page.addInitScript((language) => {
    window.localStorage.setItem("sawaka-locale", language);
    window.localStorage.setItem(
      "user",
      JSON.stringify({
        token: "user-jwt-token",
        roles: ["acheteur"],
        username: "amina",
        firstName: "Amina",
      })
    );
  }, locale);
}

test("the creation screen shows both actions and the three sections", async ({ page }) => {
  await signIn(page, "fr");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/mes-projets/nouveau");

  await expect(page.getByTestId("project-save")).toBeVisible();
  await expect(page.getByTestId("project-publish")).toBeVisible();
  const information = page.getByTestId("project-section-information");
  const stages = page.getByTestId("project-stages");
  const images = page.getByTestId("project-media");
  await expect(information).toBeVisible();
  await expect(stages).toBeVisible();
  await expect(images).toBeVisible();
  const order = await page.evaluate(() => {
    const ids = ["project-section-information", "project-stages", "project-media"];
    return ids.map((id) => document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect().top ?? 0);
  });
  expect(order[0]).toBeLessThan(order[1]);
  expect(order[1]).toBeLessThan(order[2]);
  await expect(information).toContainText("Informations du projet");
  await expect(page.getByTestId("project-save-bottom")).toBeVisible();
  await expect(page.getByTestId("project-publish-bottom")).toBeVisible();
});

test("a valid project can be published directly with a prepared stage and need", async ({ page }) => {
  await signIn(page, "en");
  const posts: Array<Record<string, unknown>> = [];
  await page.route("**/api/projects**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST" && path === "/api/projects") {
      const body = request.postDataJSON() as Record<string, unknown>;
      posts.push(body);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          project: {
            id: "proj-direct",
            title: body.title,
            summary: body.summary || "",
            description: body.description,
            objective: body.objective,
            category: body.category,
            country: body.country,
            city: body.city,
            status: "published",
            visibility: "public",
            coverImage: null,
            images: [],
            stages: [
              {
                id: "stage-direct",
                title: "Prepare",
                description: "",
                position: 0,
                status: "not_started",
                blockerExplanation: "",
                needs: [
                  {
                    id: "need-direct",
                    title: "Advice",
                    description: "",
                    kind: "skill",
                    status: "open",
                    blockerExplanation: "",
                  },
                ],
                images: [],
              },
            ],
          },
        }),
      });
      return;
    }
    if (request.method() === "GET" && path.endsWith("/mine/proj-direct")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          project: {
            id: "proj-direct",
            title: "Repair workshop",
            summary: "",
            description: "A shared workshop.",
            objective: "Repair together.",
            category: "Craft",
            country: "Senegal",
            city: "Dakar",
            status: "published",
            visibility: "public",
            coverImage: null,
            images: [],
            stages: [],
          },
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.goto("/mes-projets/nouveau");
  const form = page.getByTestId("project-draft-form");
  await form.getByLabel("Project title").fill("Repair workshop");
  await page.getByTestId("project-field-description").fill("A shared workshop.");
  await page.getByTestId("project-field-objective").fill("Repair together.");
  await page.getByTestId("project-field-category").fill("Craft");
  await page.getByTestId("project-field-country").fill("Senegal");
  await page.getByTestId("project-field-city").fill("Dakar");
  await page.getByTestId("new-stage-title").fill("Prepare");
  await page.getByTestId("project-stage-add").click();
  const needTitle = page.locator("[data-testid^='new-need-title-']");
  await needTitle.fill("Advice");
  await page.locator("[data-testid^='new-need-kind-']").selectOption("skill");
  await page.locator("[data-testid^='project-need-add-']").click();
  await page.getByTestId("project-publish").click();

  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0].publish).toBe(true);
  expect(posts[0].stages).toEqual([
    expect.objectContaining({
      title: "Prepare",
      needs: [expect.objectContaining({ title: "Advice", kind: "skill" })],
    }),
  ]);
  await expect(page).toHaveURL(/\/mes-projets\/proj-direct\/modifier/);
  await expect(page.getByTestId("project-publish")).toHaveCount(0);
});

test("an incomplete publication keeps the entered project, stage, and need", async ({ page }) => {
  await signIn(page, "fr");
  let posts = 0;
  await page.route("**/api/projects**", async (route) => {
    if (route.request().method() === "POST") posts += 1;
    await route.fallback();
  });
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/mes-projets/nouveau");
  await page.getByTestId("project-draft-form").getByLabel("Titre").fill("Atelier");
  await page.getByTestId("new-stage-title").fill("Préparer");
  await page.getByTestId("project-stage-add").click();
  const needTitle = page.locator("[data-testid^='new-need-title-']");
  await needTitle.fill("Conseil");
  await page.locator("[data-testid^='new-need-kind-']").selectOption("skill");
  await page.locator("[data-testid^='project-need-add-']").click();
  await page.getByTestId("project-publish").click();

  await expect(page.getByTestId("project-form-error")).toBeVisible();
  await expect(page.getByTestId("project-field-title")).toHaveValue("Atelier");
  await expect(page.getByText("Préparer").first()).toBeVisible();
  await expect(page.locator("[data-testid^='need-title-']")).toHaveValue("Conseil");
  await expect(page.locator("[data-testid^='stage-toggle-']")).toHaveAttribute("aria-expanded", "true");
  expect(posts).toBe(0);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  await expect(page.getByTestId("project-save")).toBeVisible();
  await expect(page.getByTestId("project-publish")).toBeVisible();
});

test("the English editor uses the approved section labels", async ({ page }) => {
  await signIn(page, "en");
  await page.goto("/mes-projets/nouveau");
  await expect(page.getByRole("heading", { name: "Project information" })).toBeVisible();
  await expect(page.getByTestId("project-save")).toHaveText("Save draft");
  await expect(page.getByTestId("project-publish")).toHaveText("Publish project");
  await expect(page.getByTestId("project-stages")).toContainText("Project stages");
  await expect(page.getByTestId("project-media")).toContainText("Project images");
});
