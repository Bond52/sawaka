const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../../index");
const User = require("../../models/user");
const Project = require("../../models/Project");

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
  return { cookie: login.headers["set-cookie"], userId: user._id };
}

async function publishProject(cookie, payload) {
  const created = await request(app).post("/api/projects").set("Cookie", cookie).send(payload);
  expect(created.status).toBe(201);
  const published = await request(app)
    .post(`/api/projects/mine/${created.body.project.id}/publish`)
    .set("Cookie", cookie)
    .send({
      title: payload.title,
      summary: payload.summary || "",
      description: payload.description || "Description",
      objective: payload.objective || "Objective",
      category: payload.category,
      country: payload.country,
      city: payload.city,
      commentAccess: payload.commentAccess || "members",
    });
  expect(published.status).toBe(200);
  return published.body.project;
}

describe("public project directory search and filters", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-auth";
  });

  it("searches and filters published projects only", async () => {
    const { cookie: owner, userId } = await account("dir-search-owner");

    const garden = await publishProject(owner, {
      title: "Jardin communautaire",
      summary: "Cultiver ensemble",
      description: "Un jardin partagé à Douala",
      objective: "Nourrir le quartier",
      category: "agriculture-livestock-and-agro-processing",
      country: "CM",
      city: "Douala",
    });

    await publishProject(owner, {
      title: "Atelier couture",
      summary: "Formation",
      description: "Coudre des vêtements",
      objective: "Emploi local",
      category: "textile-fashion-and-sewing",
      country: "CA",
      city: "Montreal",
    });

    await Project.create({
      ownerId: userId,
      title: "Brouillon secret",
      description: "Jardin privé",
      objective: "Secret",
      category: "agriculture-livestock-and-agro-processing",
      country: "CM",
      city: "Douala",
      status: "draft",
      visibility: "private",
    });

    const byKeyword = await request(app).get("/api/projects").query({ q: "jardin" });
    expect(byKeyword.status).toBe(200);
    expect(byKeyword.body.projects.map((item) => item.id)).toContain(garden.id);
    expect(byKeyword.body.projects.every((item) => item.status === "published")).toBe(true);
    expect(byKeyword.body.projects.some((item) => item.title === "Brouillon secret")).toBe(false);

    const combined = await request(app).get("/api/projects").query({
      category: "agriculture-livestock-and-agro-processing",
      country: "CM",
      city: "douala",
    });
    expect(combined.status).toBe(200);
    expect(combined.body.projects.map((item) => item.id)).toEqual([garden.id]);
    expect(combined.body.total).toBeGreaterThanOrEqual(1);
    expect(combined.body.page).toBe(1);
  });

  it("filters by need kind and stage status", async () => {
    const { cookie } = await account("dir-needs-owner");
    const created = await request(app)
      .post("/api/projects")
      .set("Cookie", cookie)
      .send({
        title: "Projet besoins",
        description: "Description",
        objective: "Objective",
        category: "creative-design-and-media",
        country: "CG",
        city: "Brazzaville",
      });
    const projectId = created.body.project.id;
    const stage = await request(app)
      .post(`/api/projects/mine/${projectId}/stages`)
      .set("Cookie", cookie)
      .send({ title: "Préparer", status: "in_progress" });
    const stageId = stage.body.project.stages[0].id;
    await request(app)
      .post(`/api/projects/mine/${projectId}/stages/${stageId}/needs`)
      .set("Cookie", cookie)
      .send({ title: "Mentor", kind: "skill", status: "open" });
    await request(app)
      .post(`/api/projects/mine/${projectId}/publish`)
      .set("Cookie", cookie)
      .send({
        title: "Projet besoins",
        description: "Description",
        objective: "Objective",
        category: "creative-design-and-media",
        country: "CG",
        city: "Brazzaville",
      });

    const filtered = await request(app).get("/api/projects").query({
      needKind: "skill",
      needStatus: "open",
      stageStatus: "in_progress",
      country: "CG",
    });
    expect(filtered.status).toBe(200);
    expect(filtered.body.projects.some((item) => item.id === projectId)).toBe(true);
  });
});
