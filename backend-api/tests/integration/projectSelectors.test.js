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

describe("project category and country selectors", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-auth";
  });

  it("rejects invalid category and country on create, and keeps legacy values editable", async () => {
    const { cookie: owner, userId } = await account("selector-owner");

    const invalidCategory = await request(app)
      .post("/api/projects")
      .set("Cookie", owner)
      .send({
        title: "Projet",
        category: "Agriculture",
        country: "CM",
        city: "Douala",
      });
    expect(invalidCategory.status).toBe(400);
    expect(invalidCategory.body.error.code).toBe("INVALID_CATEGORY");

    const invalidCountry = await request(app)
      .post("/api/projects")
      .set("Cookie", owner)
      .send({
        title: "Projet",
        category: "agriculture-livestock-and-agro-processing",
        country: "Senegal",
        city: "Dakar",
      });
    expect(invalidCountry.status).toBe(400);
    expect(invalidCountry.body.error.code).toBe("INVALID_COUNTRY");

    const created = await request(app)
      .post("/api/projects")
      .set("Cookie", owner)
      .send({
        title: "Projet valide",
        category: "agriculture-livestock-and-agro-processing",
        country: "République du Congo",
        city: "Brazzaville",
      });
    expect(created.status).toBe(201);
    expect(created.body.project.country).toBe("CG");

    const legacy = await Project.create({
      ownerId: userId,
      title: "Ancien",
      description: "Texte",
      objective: "Objectif",
      category: "Agriculture",
      country: "Cameroun",
      city: "Yaoundé",
      status: "draft",
      visibility: "private",
    });

    const preserved = await request(app)
      .patch(`/api/projects/mine/${legacy._id}`)
      .set("Cookie", owner)
      .send({
        title: "Ancien",
        description: "Texte",
        objective: "Objectif",
        category: "Agriculture",
        country: "Cameroun",
        city: "Yaoundé",
        summary: "",
      });
    expect(preserved.status).toBe(200);
    expect(preserved.body.project.category).toBe("Agriculture");
    expect(preserved.body.project.country).toBe("CM");

    const published = await request(app)
      .post(`/api/projects/mine/${legacy._id}/publish`)
      .set("Cookie", owner)
      .send({
        title: "Ancien",
        description: "Texte",
        objective: "Objectif",
        category: "Agriculture",
        country: "CM",
        city: "Yaoundé",
        summary: "",
      });
    expect(published.status).toBe(200);
    expect(published.body.project.status).toBe("published");
    expect(published.body.project.category).toBe("Agriculture");

    const publicOne = await request(app).get(`/api/projects/${legacy._id}`);
    expect(publicOne.status).toBe(200);
    expect(publicOne.body.project.ownerId).toBeUndefined();

    const draft = await request(app).post("/api/projects").set("Cookie", owner).send({ title: "Privé" });
    const hidden = await request(app).get(`/api/projects/${draft.body.project.id}`);
    expect(hidden.status).toBe(404);
  });
});
