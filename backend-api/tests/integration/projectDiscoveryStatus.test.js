const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../../index");
const User = require("../../models/user");
const projectRoutes = require("../../routes/project.routes");

async function account(username) {
  const hash = await bcrypt.hash("Secret123!", 10);
  await User.create({
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
  return login.headers["set-cookie"];
}

const BASE = {
  title: "Jardin",
  description: "Description",
  objective: "Objectif",
  category: "agriculture-livestock-and-agro-processing",
  country: "CM",
  city: "Douala",
};

describe("project discovery status", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-auth";
  });

  beforeEach(() => {
    projectRoutes.projectWriteRateLimit.reset();
  });

  it("exposes discoveryStatus publicly and updates after stage/need changes", async () => {
    const owner = await account("discovery-status-owner");
    const created = await request(app).post("/api/projects").set("Cookie", owner).send(BASE);
    const id = created.body.project.id;
    expect(created.body.project.discoveryStatus).toBe("not_started");

    const published = await request(app)
      .post(`/api/projects/mine/${id}/publish`)
      .set("Cookie", owner)
      .send(BASE);
    expect(published.status).toBe(200);
    expect(published.body.project.discoveryStatus).toBe("not_started");

    const stage = await request(app)
      .post(`/api/projects/mine/${id}/stages`)
      .set("Cookie", owner)
      .send({ title: "Préparer", status: "in_progress" });
    expect(stage.body.project.discoveryStatus).toBe("in_progress");
    const stageId = stage.body.project.stages[0].id;

    const blockedNeed = await request(app)
      .post(`/api/projects/mine/${id}/stages/${stageId}/needs`)
      .set("Cookie", owner)
      .send({
        title: "Outils",
        kind: "resource",
        status: "blocked",
        blockerExplanation: "Manque de matériel",
      });
    expect(blockedNeed.body.project.discoveryStatus).toBe("blocked");

    const publicView = await request(app).get(`/api/projects/${id}`);
    expect(publicView.status).toBe(200);
    expect(publicView.body.project.discoveryStatus).toBe("blocked");

    const filtered = await request(app)
      .get("/api/projects")
      .query({ discoveryStatus: "blocked", country: "CM" });
    expect(filtered.status).toBe(200);
    expect(filtered.body.projects.some((item) => item.id === id)).toBe(true);
    expect(filtered.body.projects.every((item) => item.discoveryStatus === "blocked")).toBe(true);
  });

  it("rejects invalid discoveryStatus filters and keeps drafts private", async () => {
    const owner = await account("discovery-status-draft");
    const draft = await request(app).post("/api/projects").set("Cookie", owner).send({
      title: "Privé",
    });
    const hidden = await request(app).get("/api/projects").query({
      discoveryStatus: "not_started",
      q: "Privé",
    });
    expect(hidden.body.projects.some((item) => item.id === draft.body.project.id)).toBe(false);

    const invalid = await request(app).get("/api/projects").query({ discoveryStatus: "active" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("INVALID_DISCOVERY_STATUS");
  });
});
