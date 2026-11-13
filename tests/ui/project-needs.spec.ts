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

test("shows the French blocker validation error", async ({ page }) => {
  await signIn(page, "fr");
  await page.route("**/api/projects/**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          project: {
            id: "proj-need",
            title: "Poulailler",
            summary: "",
            description: "Un élevage partagé.",
            objective: "Nourrir le quartier.",
            category: "Agriculture",
            country: "Cameroun",
            city: "Douala",
            status: "draft",
            visibility: "private",
            stages: [
              {
                id: "stage-1",
                title: "Préparer",
                description: "",
                position: 0,
                status: "not_started",
                blockerExplanation: "",
                needs: [],
              },
            ],
          },
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/mes-projets/proj-need/modifier");
  await page.getByTestId("new-need-title-stage-1").fill("Grillage");
  await page.getByTestId("new-need-kind-stage-1").selectOption("resource");
  await page.getByTestId("new-need-status-stage-1").selectOption("blocked");
  await page.getByTestId("project-need-add-stage-1").click();
  await expect(page.getByTestId("project-need-error-stage-1")).toHaveText(
    "Indiquez ce qui bloque ce besoin."
  );
});

test("shows the English blocker validation error", async ({ page }) => {
  await signIn(page, "en");
  await page.route("**/api/projects/**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          project: {
            id: "proj-need",
            title: "Poultry yard",
            summary: "",
            description: "A shared yard.",
            objective: "Feed the neighborhood.",
            category: "Agriculture",
            country: "Cameroon",
            city: "Douala",
            status: "draft",
            visibility: "private",
            stages: [
              {
                id: "stage-1",
                title: "Prepare",
                description: "",
                position: 0,
                status: "not_started",
                blockerExplanation: "",
                needs: [],
              },
            ],
          },
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/mes-projets/proj-need/modifier");
  await page.getByTestId("new-need-title-stage-1").fill("Fencing");
  await page.getByTestId("new-need-kind-stage-1").selectOption("resource");
  await page.getByTestId("new-need-status-stage-1").selectOption("blocked");
  await page.getByTestId("project-need-add-stage-1").click();
  await expect(page.getByTestId("project-need-error-stage-1")).toHaveText(
    "Explain what is blocking this need."
  );
});
