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
  commentAccess: "members" | "everyone";
  status: "draft" | "published";
  visibility: "private" | "public";
  coverImage: null;
  images: [];
  stages: [];
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
    commentAccess: partial.commentAccess || "members",
    status: partial.status || "draft",
    visibility: partial.visibility || "private",
    coverImage: null,
    images: [],
    stages: [],
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

async function mockOwned(page: Page, projects: StoredProject[]) {
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
      const project = projects.find((item) => item.id === owned[1]) || blank({ id: owned[1] });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ project }),
      });
      return;
    }

    if (owned && method === "PATCH") {
      const body = request.postDataJSON() as Partial<StoredProject>;
      const current = projects.find((item) => item.id === owned[1]) || blank({ id: owned[1] });
      Object.assign(current, body);
      if (!projects.find((item) => item.id === current.id)) projects.push(current);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ project: current }),
      });
      return;
    }

    const publish = path.match(/\/api\/projects\/mine\/([^/]+)\/publish$/);
    if (publish && method === "POST") {
      const body = request.postDataJSON() as Partial<StoredProject>;
      const current = projects.find((item) => item.id === publish[1]) || blank({ id: publish[1] });
      Object.assign(current, body, { status: "published", visibility: "public" });
      if (!projects.find((item) => item.id === current.id)) projects.push(current);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ project: current }),
      });
      return;
    }

    await route.fallback();
  });
}

test("create project defaults to members-only and shows everyone warning", async ({ page }) => {
  const projects: StoredProject[] = [];
  await signIn(page);
  await mockOwned(page, projects);
  await page.goto("/mes-projets/nouveau");

  await expect(page.getByTestId("project-comment-access")).toBeVisible();
  await expect(page.getByTestId("project-comment-access-members")).toBeChecked();
  await expect(page.getByTestId("project-comment-access-warning")).toHaveCount(0);

  await page.getByTestId("project-comment-access-everyone").check();
  await expect(page.getByTestId("project-comment-access-warning")).toContainText(
    "Visitors who are not signed in will be able to comment"
  );

  await page.getByTestId("project-field-title").fill("Open comments project");
  await page.getByTestId("project-save").click();
  await expect.poll(() => projects[0]?.commentAccess).toBe("everyone");
});

test("comment access can change after publication without unpublishing", async ({ page }) => {
  const projects: StoredProject[] = [
    blank({
      id: "proj-published",
      title: "Published garden",
      description: "Text",
      objective: "Goal",
      category: "agriculture-livestock-and-agro-processing",
      country: "CM",
      city: "Douala",
      commentAccess: "members",
      status: "published",
      visibility: "public",
    }),
  ];
  await signIn(page);
  await mockOwned(page, projects);
  await page.goto("/mes-projets/proj-published/modifier");

  await expect(page.getByTestId("project-comment-access-members")).toBeChecked();
  await page.getByTestId("project-comment-access-everyone").check();
  await page.getByTestId("project-save").click();
  await expect.poll(() => projects[0]?.commentAccess).toBe("everyone");
  await expect.poll(() => projects[0]?.status).toBe("published");
});

test("FR labels for comment access remain available", async ({ page }) => {
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
  await mockOwned(page, []);
  await page.goto("/mes-projets/nouveau");
  await expect(page.getByText("Membres Sawaka uniquement")).toBeVisible();
  await page.getByTestId("project-comment-access-everyone").check();
  await expect(page.getByTestId("project-comment-access-warning")).toContainText(
    "Les visiteurs non connectés pourront commenter"
  );
});
