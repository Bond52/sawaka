import { expect, test, type Page, type Route } from "@playwright/test";

const published = {
  id: "proj-public-comments",
  title: "Community garden",
  summary: "Grow food together.",
  description: "A shared garden for the neighborhood.",
  objective: "Improve food access.",
  category: "agriculture-livestock-and-agro-processing",
  country: "CM",
  city: "Douala",
  status: "published" as const,
  publishedAt: "2026-11-16T00:00:00.000Z",
  commentAccess: "members" as const,
  discoveryStatus: "in_progress" as const,
  coverImage: null,
  images: [],
  stages: [
    {
      id: "stage-1",
      title: "Prepare soil",
      description: "Clear and enrich the plot.",
      position: 0,
      status: "in_progress",
      blockerExplanation: "",
      needs: [
        {
          id: "need-1",
          title: "Compost",
          description: "",
          kind: "resource",
          status: "open",
          blockerExplanation: "",
        },
      ],
      images: [],
    },
  ],
};

type Comment = {
  id: string;
  projectId: string;
  target: "project" | "need";
  needId: string | null;
  stageId: string | null;
  authorType: "member" | "visitor";
  authorLabel: string | null;
  authorId: string | null;
  body: string;
  createdAt: string;
};

function memberToken(id: string) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ id })).toString("base64url");
  return `${header}.${payload}.sig`;
}

async function mockComments(
  page: Page,
  options: {
    commentAccess?: "members" | "everyone";
    viewerCanModerate?: boolean;
    memberId?: string;
  } = {}
) {
  const project = {
    ...published,
    commentAccess: options.commentAccess || "members",
  };
  const comments: Comment[] = [];
  let nextId = 1;

  await page.route("**/api/projects**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === "GET" && path.endsWith(`/api/projects/${project.id}`)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          project,
          viewerCanModerate: Boolean(options.viewerCanModerate),
        }),
      });
      return;
    }

    const projectComments = path.match(/\/api\/projects\/([^/]+)\/comments$/);
    if (projectComments && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          commentAccess: project.commentAccess,
          comments: comments.filter((item) => item.target === "project"),
        }),
      });
      return;
    }

    if (projectComments && method === "POST") {
      const auth = request.headers().authorization || "";
      const signedIn = auth.startsWith("Bearer ");
      if (!signedIn && project.commentAccess === "members") {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "LOGIN_REQUIRED" } }),
        });
        return;
      }
      const body = request.postDataJSON() as { body?: string };
      const comment: Comment = {
        id: `c-${nextId++}`,
        projectId: project.id,
        target: "project",
        needId: null,
        stageId: null,
        authorType: signedIn ? "member" : "visitor",
        authorLabel: signedIn ? "Amina" : null,
        authorId: signedIn ? options.memberId || "member-1" : null,
        body: String(body.body || ""),
        createdAt: new Date().toISOString(),
      };
      comments.push(comment);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ comment }),
      });
      return;
    }

    const needComments = path.match(/\/api\/projects\/([^/]+)\/needs\/([^/]+)\/comments$/);
    if (needComments && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          commentAccess: project.commentAccess,
          comments: comments.filter(
            (item) => item.target === "need" && item.needId === needComments[2]
          ),
        }),
      });
      return;
    }

    if (needComments && method === "POST") {
      const body = request.postDataJSON() as { body?: string };
      const comment: Comment = {
        id: `c-${nextId++}`,
        projectId: project.id,
        target: "need",
        needId: needComments[2],
        stageId: "stage-1",
        authorType: "visitor",
        authorLabel: null,
        authorId: null,
        body: String(body.body || ""),
        createdAt: new Date().toISOString(),
      };
      comments.push(comment);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ comment }),
      });
      return;
    }

    const deleteMatch = path.match(/\/api\/projects\/([^/]+)\/comments\/([^/]+)$/);
    if (deleteMatch && method === "DELETE") {
      const index = comments.findIndex((item) => item.id === deleteMatch[2]);
      if (index >= 0) comments.splice(index, 1);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    await route.fallback();
  });
}

test("members-only blocks visitors and shows login CTA", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("sawaka-locale", "en"));
  await mockComments(page, { commentAccess: "members" });
  await page.goto(`/projets/${published.id}`);
  await expect(page.getByTestId("project-comments")).toBeVisible();
  await expect(page.getByTestId("comment-login-required")).toBeVisible();
  await expect(page.getByTestId("comment-form")).toHaveCount(0);
});

test("authenticated members can comment and delete their own comments", async ({ page }) => {
  const memberId = "member-42";
  await page.addInitScript((token) => {
    window.localStorage.setItem("sawaka-locale", "en");
    window.localStorage.setItem(
      "user",
      JSON.stringify({
        token,
        roles: ["acheteur"],
        username: "amina",
        firstName: "Amina",
      })
    );
  }, memberToken(memberId));
  await mockComments(page, { commentAccess: "members", memberId });
  await page.goto(`/projets/${published.id}`);
  await page.getByTestId("comment-body").fill("Thanks for this project");
  await page.getByTestId("comment-submit").click();
  await expect(page.getByText("Thanks for this project")).toBeVisible();
  await page.getByTestId(/comment-delete-c-/).click();
  await page.getByTestId(/comment-delete-confirm-c-/).click();
  await expect(page.getByTestId("comments-empty")).toBeVisible();
});

test("visitors can comment when everyone is enabled, including on needs", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("sawaka-locale", "en"));
  await mockComments(page, { commentAccess: "everyone" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/projets/${published.id}`);

  await page.getByTestId("comment-body").fill("Visitor project note");
  await page.getByTestId("comment-submit").click();
  await expect(page.getByText("Visitor project note")).toBeVisible();
  await expect(page.getByText("Visitor")).toBeVisible();

  await page.getByTestId("need-comments-toggle-need-1").click();
  await expect(page.getByTestId("need-comments-need-1")).toBeVisible();
  await page
    .getByTestId("need-comments-need-1")
    .getByTestId("comment-body")
    .fill("Need-level help offer");
  await page.getByTestId("need-comments-need-1").getByTestId("comment-submit").click();
  await expect(page.getByText("Need-level help offer")).toBeVisible();
});

test("owners can moderate visitor comments", async ({ page }) => {
  const ownerId = "owner-9";
  await page.addInitScript((token) => {
    window.localStorage.setItem("sawaka-locale", "en");
    window.localStorage.setItem(
      "user",
      JSON.stringify({
        token,
        roles: ["acheteur"],
        username: "owner",
        firstName: "Owner",
      })
    );
  }, memberToken(ownerId));
  await mockComments(page, {
    commentAccess: "everyone",
    viewerCanModerate: true,
    memberId: ownerId,
  });
  await page.goto(`/projets/${published.id}`);
  await page.getByTestId("comment-body").fill("Please remove me");
  await page.getByTestId("comment-submit").click();
  await page.getByTestId(/comment-delete-c-/).click();
  await page.getByTestId(/comment-delete-confirm-c-/).click();
  await expect(page.getByTestId("comments-empty")).toBeVisible();
});
