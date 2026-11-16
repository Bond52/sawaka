const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../../index");
const User = require("../../models/user");
const projectRoutes = require("../../routes/project.routes");

async function account(username) {
  const hash = await bcrypt.hash("Secret123!", 10);
  const user = await User.create({
    firstName: "Amina",
    lastName: "Diallo",
    username,
    email: `${username}@example.com`,
    password: hash,
    roles: ["acheteur"],
    isSeller: false,
  });
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: `${username}@example.com`, password: "Secret123!" });
  return { cookie: login.headers["set-cookie"], userId: String(user._id) };
}

async function publishWithAccess(cookie, commentAccess) {
  const created = await request(app).post("/api/projects").set("Cookie", cookie).send({
    title: "Projet commentaires",
    description: "Description détaillée",
    objective: "Objectif clair",
    category: "agriculture-livestock-and-agro-processing",
    country: "CM",
    city: "Yaoundé",
    commentAccess,
  });
  expect(created.status).toBe(201);
  expect(created.body.project.commentAccess).toBe(commentAccess || "members");

  const stage = await request(app)
    .post(`/api/projects/mine/${created.body.project.id}/stages`)
    .set("Cookie", cookie)
    .send({ title: "Lancer", status: "not_started" });
  const stageId = stage.body.project.stages[0].id;
  const need = await request(app)
    .post(`/api/projects/mine/${created.body.project.id}/stages/${stageId}/needs`)
    .set("Cookie", cookie)
    .send({ title: "Semences", kind: "resource", status: "open" });
  const needId = need.body.project.stages[0].needs[0].id;

  const published = await request(app)
    .post(`/api/projects/mine/${created.body.project.id}/publish`)
    .set("Cookie", cookie)
    .send({
      title: "Projet commentaires",
      description: "Description détaillée",
      objective: "Objectif clair",
      category: "agriculture-livestock-and-agro-processing",
      country: "CM",
      city: "Yaoundé",
      commentAccess,
    });
  expect(published.status).toBe(200);
  return {
    projectId: published.body.project.id,
    needId,
    commentAccess: published.body.project.commentAccess,
  };
}

describe("project and need comments", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-auth";
  });

  beforeEach(() => {
    projectRoutes.projectCommentRateLimit.reset();
    projectRoutes.projectWriteRateLimit.reset();
  });

  it("defaults new projects to members-only commenting", async () => {
    const { cookie } = await account("comment-default-owner");
    const created = await request(app).post("/api/projects").set("Cookie", cookie).send({
      title: "Défaut",
    });
    expect(created.status).toBe(201);
    expect(created.body.project.commentAccess).toBe("members");
  });

  it("blocks visitors when members-only and allows members", async () => {
    const { cookie: owner } = await account("comment-members-owner");
    const { cookie: member } = await account("comment-members-member");
    const { projectId } = await publishWithAccess(owner, "members");

    const guestBlocked = await request(app)
      .post(`/api/projects/${projectId}/comments`)
      .send({ body: "Hello from guest" });
    expect(guestBlocked.status).toBe(401);
    expect(guestBlocked.body.error.code).toBe("LOGIN_REQUIRED");

    const memberOk = await request(app)
      .post(`/api/projects/${projectId}/comments`)
      .set("Cookie", member)
      .send({ body: "Hello from member" });
    expect(memberOk.status).toBe(201);
    expect(memberOk.body.comment.authorType).toBe("member");
    expect(memberOk.body.comment.target).toBe("project");
  });

  it("allows visitor comments when everyone is enabled", async () => {
    const { cookie: owner } = await account("comment-everyone-owner");
    const { projectId, needId } = await publishWithAccess(owner, "everyone");

    const guest = await request(app)
      .post(`/api/projects/${projectId}/comments`)
      .send({ body: "Visitor project note" });
    expect(guest.status).toBe(201);
    expect(guest.body.comment.authorType).toBe("visitor");
    expect(guest.body.comment.authorId).toBeNull();

    const needComment = await request(app)
      .post(`/api/projects/${projectId}/needs/${needId}/comments`)
      .send({ body: "Visitor need note" });
    expect(needComment.status).toBe(201);
    expect(needComment.body.comment.target).toBe("need");
    expect(needComment.body.comment.needId).toBe(needId);

    const projectList = await request(app).get(`/api/projects/${projectId}/comments`);
    expect(projectList.body.comments).toHaveLength(1);
    expect(projectList.body.comments[0].body).toBe("Visitor project note");

    const needList = await request(app).get(
      `/api/projects/${projectId}/needs/${needId}/comments`
    );
    expect(needList.body.comments).toHaveLength(1);
    expect(needList.body.comments[0].body).toBe("Visitor need note");
  });

  it("rejects invalid need associations and empty bodies", async () => {
    const { cookie: owner } = await account("comment-invalid-owner");
    const { projectId } = await publishWithAccess(owner, "everyone");
    const fakeNeed = "507f1f77bcf86cd799439099";

    const missingNeed = await request(app)
      .post(`/api/projects/${projectId}/needs/${fakeNeed}/comments`)
      .send({ body: "Orphan" });
    expect(missingNeed.status).toBe(404);

    const empty = await request(app)
      .post(`/api/projects/${projectId}/comments`)
      .send({ body: "   " });
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe("COMMENT_REQUIRED");

    const draft = await request(app).post("/api/projects").set("Cookie", owner).send({
      title: "Draft only",
    });
    const draftComment = await request(app)
      .post(`/api/projects/${draft.body.project.id}/comments`)
      .send({ body: "Should fail" });
    expect(draftComment.status).toBe(404);
  });

  it("lets authors and owners delete, and rejects unauthorized deletion", async () => {
    const { cookie: owner } = await account("comment-mod-owner");
    const { cookie: author } = await account("comment-mod-author");
    const { cookie: stranger } = await account("comment-mod-stranger");
    const { projectId } = await publishWithAccess(owner, "everyone");

    const visitor = await request(app)
      .post(`/api/projects/${projectId}/comments`)
      .send({ body: "Visitor delete target" });
    const member = await request(app)
      .post(`/api/projects/${projectId}/comments`)
      .set("Cookie", author)
      .send({ body: "Member delete target" });

    const strangerDenied = await request(app)
      .delete(`/api/projects/${projectId}/comments/${visitor.body.comment.id}`)
      .set("Cookie", stranger);
    expect(strangerDenied.status).toBe(403);

    const guestDelete = await request(app).delete(
      `/api/projects/${projectId}/comments/${visitor.body.comment.id}`
    );
    expect(guestDelete.status).toBe(401);

    const authorDelete = await request(app)
      .delete(`/api/projects/${projectId}/comments/${member.body.comment.id}`)
      .set("Cookie", author);
    expect(authorDelete.status).toBe(200);

    const ownerDelete = await request(app)
      .delete(`/api/projects/${projectId}/comments/${visitor.body.comment.id}`)
      .set("Cookie", owner);
    expect(ownerDelete.status).toBe(200);

    const remaining = await request(app).get(`/api/projects/${projectId}/comments`);
    expect(remaining.body.comments).toHaveLength(0);
  });

  it("rate limits comment submissions", async () => {
    const { cookie: owner } = await account("comment-rate-owner");
    const { projectId } = await publishWithAccess(owner, "everyone");

    let lastStatus = 201;
    for (let i = 0; i < 21; i += 1) {
      const response = await request(app)
        .post(`/api/projects/${projectId}/comments`)
        .send({ body: `Spam ${i}` });
      lastStatus = response.status;
      if (response.status === 429) break;
    }
    expect(lastStatus).toBe(429);
  });

  it("allows updating commentAccess after publication", async () => {
    const { cookie: owner } = await account("comment-update-owner");
    const { projectId } = await publishWithAccess(owner, "members");

    const updated = await request(app)
      .patch(`/api/projects/mine/${projectId}`)
      .set("Cookie", owner)
      .send({
        title: "Projet commentaires",
        description: "Description détaillée",
        objective: "Objectif clair",
        category: "agriculture-livestock-and-agro-processing",
        country: "CM",
        city: "Yaoundé",
        summary: "",
        commentAccess: "everyone",
      });
    expect(updated.status).toBe(200);
    expect(updated.body.project.commentAccess).toBe("everyone");
    expect(updated.body.project.status).toBe("published");

    const guest = await request(app)
      .post(`/api/projects/${projectId}/comments`)
      .send({ body: "Now allowed" });
    expect(guest.status).toBe(201);
  });
});
