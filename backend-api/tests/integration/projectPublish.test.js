const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../../index");
const User = require("../../models/user");
const Project = require("../../models/Project");
const { UserAuditEvent, USER_AUDIT_ACTIONS } = require("../../services/AuditService");

const COMPLETE = {
  title: "Poulailler communautaire",
  description: "Un élevage partagé pour le quartier.",
  objective: "Améliorer l’alimentation locale.",
  category: "Agriculture",
  country: "Cameroun",
  city: "Douala",
};

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

describe("project publication", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-auth";
  });

  it("keeps an incomplete draft private and names the missing fields", async () => {
    const owner = await account("publish-incomplete");
    const created = await request(app).post("/api/projects").set("Cookie", owner).send({ title: "Brouillon" });
    const id = created.body.project.id;

    const anonymous = await request(app).post(`/api/projects/mine/${id}/publish`).send(COMPLETE);
    expect(anonymous.status).toBe(401);

    const rejected = await request(app)
      .post(`/api/projects/mine/${id}/publish`)
      .set("Cookie", owner)
      .send({ description: "Texte conservé" });
    expect(rejected.status).toBe(422);
    expect(rejected.body.error.code).toBe("PUBLICATION_INCOMPLETE");
    expect(rejected.body.error.fields).toEqual(
      expect.arrayContaining(["objective", "category", "country", "city"])
    );
    expect(rejected.body.error.fields).not.toContain("description");

    const stored = await Project.findById(id);
    expect(stored.status).toBe("draft");
    expect(stored.visibility).toBe("private");
    expect(stored.description).toBe("Texte conservé");
    expect(stored.title).toBe("Brouillon");

    const hidden = await request(app).get(`/api/projects/${id}`);
    expect(hidden.status).toBe(404);
  });

  it("publishes a complete project for its owner and exposes it without ownership metadata", async () => {
    const owner = await account("publish-owner");
    const other = await account("publish-other");
    const created = await request(app).post("/api/projects").set("Cookie", owner).send({});
    const id = created.body.project.id;

    const forbidden = await request(app)
      .post(`/api/projects/mine/${id}/publish`)
      .set("Cookie", other)
      .send(COMPLETE);
    expect(forbidden.status).toBe(403);

    const published = await request(app)
      .post(`/api/projects/mine/${id}/publish`)
      .set("Cookie", owner)
      .send(COMPLETE);
    expect(published.status).toBe(200);
    expect(published.body.project.status).toBe("published");
    expect(published.body.project.visibility).toBe("public");
    expect(published.body.project.ownerId).toBeUndefined();

    const again = await request(app)
      .post(`/api/projects/mine/${id}/publish`)
      .set("Cookie", owner)
      .send(COMPLETE);
    expect(again.status).toBe(409);

    const publicOne = await request(app).get(`/api/projects/${id}`);
    expect(publicOne.status).toBe(200);
    expect(publicOne.body.project).toMatchObject({
      id,
      title: COMPLETE.title,
      status: "published",
    });
    expect(publicOne.body.project.ownerId).toBeUndefined();
    expect(publicOne.body.project.visibility).toBeUndefined();

    const publicList = await request(app).get("/api/projects");
    expect(publicList.body.projects.map((project) => project.id)).toContain(id);
    expect(JSON.stringify(publicList.body)).not.toMatch(/ownerId/);

    const audit = await UserAuditEvent.findOne({
      action: USER_AUDIT_ACTIONS.PROJECT_PUBLISHED,
      "metadata.projectId": id,
    });
    expect(audit).toBeTruthy();
    expect(JSON.stringify(audit.metadata)).not.toMatch(/Poulailler/);
  });
});
