import { expect, test, type Page } from "@playwright/test";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

async function openEditor(page: Page, locale: "fr" | "en") {
  const project = {
    id: "proj-media",
    title: locale === "fr" ? "Poulailler" : "Poultry yard",
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
        title: locale === "fr" ? "Préparer" : "Prepare",
        description: "",
        position: 0,
        status: "not_started",
        blockerExplanation: "",
        needs: [],
        images: [] as Array<{ id: string; url: string }>,
      },
    ],
    coverImage: null as { id: string; url: string } | null,
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
    if (request.method() === "POST" && path.endsWith("/cover")) {
      project.coverImage = {
        id: "cover-1",
        url: "https://res.cloudinary.com/demo/image/upload/sawaka-projects/cover.jpg",
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ project }),
      });
      return;
    }
    if (request.method() === "POST" && path.endsWith("/stages/stage-1/images")) {
      project.stages[0].images.push({
        id: "stage-image-1",
        url: "https://res.cloudinary.com/demo/image/upload/sawaka-projects/stage.jpg",
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

  await page.goto("/mes-projets/proj-media/modifier");
}

test("an owner adds a cover and a stage image in French", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await openEditor(page, "fr");
  await expect(page.getByLabel("Image de couverture")).toBeVisible();
  await page.getByTestId("project-cover-input").setInputFiles({
    name: "cover.jpg",
    mimeType: "image/jpeg",
    buffer: jpeg,
  });
  await expect(page.getByTestId("project-cover-preview")).toBeVisible();
  await page.getByTestId("stage-image-stage-1").setInputFiles({
    name: "stage.jpg",
    mimeType: "image/jpeg",
    buffer: jpeg,
  });
  await expect(page.getByTestId("project-image-stage-image-1")).toBeVisible();
});

test("an owner sees the English cover control", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openEditor(page, "en");
  await expect(page.getByLabel("Cover image")).toBeVisible();
  await expect(page.getByLabel("Stage images")).toBeVisible();
});
