import { expect, test, type Page } from "@playwright/test";

async function openEditor(page: Page, locale: "fr" | "en") {
  const project = {
    id: "proj-remove",
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
        id: "stage-blocked",
        title: "Préparer",
        description: "",
        position: 0,
        status: "not_started",
        blockerExplanation: "",
        images: [],
        needs: [
          {
            id: "need-1",
            title: "Grillage",
            description: "",
            kind: "resource",
            status: "open",
            blockerExplanation: "",
          },
        ],
      },
      {
        id: "stage-empty",
        title: "Accueillir",
        description: "",
        position: 1,
        status: "not_started",
        blockerExplanation: "",
        images: [],
        needs: [],
      },
    ],
  };

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
    if (request.method() === "DELETE" && path.endsWith("/stages/stage-blocked")) {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "STAGE_HAS_NEEDS" } }),
      });
      return;
    }
    if (request.method() === "DELETE" && path.endsWith("/stages/stage-empty")) {
      project.stages = project.stages.filter((stage) => stage.id !== "stage-empty");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ project }),
      });
      return;
    }
    await route.fallback();
  });

  await page.goto("/mes-projets/proj-remove/modifier");
}

test("refuses to remove a stage that still has a need", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await openEditor(page, "fr");
  await page.getByTestId("stage-remove-stage-blocked").click();
  await expect(page.getByRole("alertdialog")).toContainText("Retirer cette étape ?");
  await page.getByTestId("stage-remove-confirm-stage-blocked").click();
  await expect(page.getByTestId("project-stage-error")).toHaveText(
    "Retirez les besoins de cette étape avant de la retirer."
  );
  await expect(page.getByTestId("project-need-need-1")).toBeVisible();
  await page.getByTestId("stage-remove-stage-empty").click();
  await page.getByTestId("stage-remove-confirm-stage-empty").click();
  await expect(page.getByTestId("project-stage-stage-empty")).toHaveCount(0);
  await expect(page.getByTestId("project-stage-stage-blocked")).toBeVisible();
});

test("shows the English removal confirmation", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openEditor(page, "en");
  await page.getByTestId("stage-remove-stage-empty").click();
  await expect(page.getByRole("alertdialog")).toContainText("Remove this stage?");
  await page.getByTestId("stage-remove-cancel-stage-empty").click();
  await expect(page.getByTestId("project-stage-stage-empty")).toBeVisible();
});
