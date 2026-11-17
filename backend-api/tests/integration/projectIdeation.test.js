const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../../index");
const User = require("../../models/user");
const Project = require("../../models/Project");
const ProjectIdea = require("../../models/ProjectIdea");
const ContributorProfile = require("../../models/ContributorProfile");
const { PROFILE_STATUS } = require("../../models/ContributorProfile");
const Domain = require("../../models/Domain");
const Supplier = require("../../models/Supplier");
const {
  anonGenerateLimit,
  authGenerateLimit,
} = require("../../routes/projectIdeation.routes");

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
  return { cookie: login.headers["set-cookie"], user };
}

describe("project ideation API", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-auth";
    process.env.AI_PROVIDER = "mock";
  });

  beforeEach(() => {
    anonGenerateLimit.reset();
    authGenerateLimit.reset();
  });

  it("generates structured ideas for anonymous visitors using verified ecosystem IDs only", async () => {
    const domain = await Domain.create({
      slug: "agriculture-livestock-and-agro-processing",
      nameEN: "Agriculture",
      nameFR: "Agriculture",
      isActive: true,
    });
    const owner = await User.create({
      firstName: "Owner",
      lastName: "One",
      username: "eco-owner",
      email: "eco-owner@example.com",
      password: await bcrypt.hash("Secret123!", 10),
      roles: ["acheteur"],
      isSeller: false,
    });
    const profile = await ContributorProfile.create({
      userId: owner._id,
      displayName: "Amina Grower",
      country: "CM",
      city: "Douala",
      domainId: domain._id,
      skills: [],
      status: PROFILE_STATUS.ACTIVE,
      isVisible: true,
    });
    const supplier = await Supplier.create({
      name: "Douala Seeds",
      accountEmail: "seeds@example.com",
      phone: "670000000",
      categories: ["agriculture-livestock-and-agro-processing"],
      country: "CM",
      city: "Douala",
      status: "Active",
      isVisible: true,
    });

    const res = await request(app).post("/api/project-ideas/generate").send({
      interests: "jardin communautaire",
      skills: "agriculture",
      category: "agriculture-livestock-and-agro-processing",
      country: "CM",
      city: "Douala",
      limit: 2,
      locale: "fr",
    });

    expect(res.status).toBe(200);
    expect(res.body.ideas.length).toBe(2);
    expect(res.body.provider).toBe("mock");
    const ids = JSON.stringify(res.body.ideas);
    expect(ids).toContain(String(profile._id));
    expect(ids).toContain(String(supplier._id));
    expect(ids).not.toMatch(/fake-|hallucin/i);
    res.body.ideas.forEach((idea) => {
      expect(idea.stages.length).toBeGreaterThan(0);
      idea.stages.forEach((stage) => {
        stage.needs.forEach((need) => {
          expect(["skill", "service", "resource", "assistance"]).toContain(need.kind);
        });
      });
    });
  });

  it("rejects invalid criteria and enforces anonymous rate limits", async () => {
    const invalid = await request(app).post("/api/project-ideas/generate").send({
      interests: "x",
      category: "nope",
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("INVALID_CATEGORY");

    anonGenerateLimit.reset();
    for (let i = 0; i < 5; i += 1) {
      const ok = await request(app)
        .post("/api/project-ideas/generate")
        .send({ interests: `idea-${i}` });
      expect(ok.status).toBe(200);
    }
    const limited = await request(app)
      .post("/api/project-ideas/generate")
      .send({ interests: "overflow" });
    expect(limited.status).toBe(429);
  });

  it("saves ideas privately and converts without publishing", async () => {
    const { cookie, user } = await account("idea-owner");
    const other = await account("idea-other");

    const generated = await request(app)
      .post("/api/project-ideas/generate")
      .set("Cookie", cookie)
      .send({ interests: "atelier couture", country: "CM", locale: "fr" });
    expect(generated.status).toBe(200);
    const idea = generated.body.ideas[0];

    const anonymousSave = await request(app)
      .post("/api/project-ideas/mine")
      .send({ idea, criteria: generated.body.criteria });
    expect(anonymousSave.status).toBe(401);

    const saved = await request(app)
      .post("/api/project-ideas/mine")
      .set("Cookie", cookie)
      .send({ idea, criteria: generated.body.criteria, locale: "fr" });
    expect(saved.status).toBe(201);
    const ideaId = saved.body.idea.id;

    const forbidden = await request(app)
      .get(`/api/project-ideas/mine/${ideaId}`)
      .set("Cookie", other.cookie);
    expect(forbidden.status).toBe(404);

    const listed = await request(app).get("/api/project-ideas/mine").set("Cookie", cookie);
    expect(listed.body.ideas.some((item) => item.id === ideaId)).toBe(true);

    const converted = await request(app)
      .post(`/api/project-ideas/mine/${ideaId}/convert`)
      .set("Cookie", cookie);
    expect(converted.status).toBe(201);
    expect(converted.body.project.status).toBe("draft");
    expect(converted.body.project.visibility).toBe("private");
    expect(converted.body.project.stages.length).toBeGreaterThan(0);

    const publicOne = await request(app).get(`/api/projects/${converted.body.project.id}`);
    expect(publicOne.status).toBe(404);

    const deleted = await request(app)
      .delete(`/api/project-ideas/mine/${ideaId}`)
      .set("Cookie", cookie);
    expect(deleted.status).toBe(200);
    expect(await ProjectIdea.countDocuments({ ownerId: user._id })).toBe(0);
    expect(await Project.countDocuments({ ownerId: user._id })).toBe(1);
  });
});
