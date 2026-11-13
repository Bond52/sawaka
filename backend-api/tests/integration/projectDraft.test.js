const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../../index");
const User = require("../../models/user");
const Project = require("../../models/Project");
const { UserAuditEvent, USER_AUDIT_ACTIONS } = require("../../services/AuditService");

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

describe("project drafts", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-auth";
  });

  it("saves an incomplete private draft and hides it from public reads", async () => {
    const owner = await account("draft-owner");
    const other = await account("draft-other");

    const anonymous = await request(app).post("/api/projects").send({ title: "Sans session" });
    expect(anonymous.status).toBe(401);

    const created = await request(app)
      .post("/api/projects")
      .set("Cookie", owner)
      .send({ title: "  Poulailler communautaire  " });
    expect(created.status).toBe(201);
    expect(created.body.project.title).toBe("Poulailler communautaire");
    expect(created.body.project.status).toBe("draft");
    expect(created.body.project.visibility).toBe("private");
    expect(created.body.project.description).toBe("");
    expect(created.body.project.ownerId).toBeUndefined();

    const id = created.body.project.id;
    const reopened = await request(app).get(`/api/projects/mine/${id}`).set("Cookie", owner);
    expect(reopened.status).toBe(200);
    expect(reopened.body.project.title).toBe("Poulailler communautaire");

    const forbidden = await request(app)
      .patch(`/api/projects/mine/${id}`)
      .set("Cookie", other)
      .send({ title: "Pris par quelqu'un d'autre" });
    expect(forbidden.status).toBe(403);
    const stored = await Project.findById(id);
    expect(stored.title).toBe("Poulailler communautaire");

    const publicList = await request(app).get("/api/projects");
    expect(publicList.status).toBe(200);
    expect(publicList.body.projects).toEqual([]);

    const publicOne = await request(app).get(`/api/projects/${id}`);
    expect(publicOne.status).toBe(404);
    expect(JSON.stringify(publicOne.body)).not.toMatch(/Poulailler/);

    const listed = await request(app).get("/api/projects/mine").set("Cookie", owner);
    expect(listed.status).toBe(200);
    expect(listed.body.projects).toHaveLength(1);
    expect(listed.body.projects[0].id).toBe(id);

    const otherList = await request(app).get("/api/projects/mine").set("Cookie", other);
    expect(otherList.body.projects).toEqual([]);

    const audit = await UserAuditEvent.findOne({
      action: USER_AUDIT_ACTIONS.PROJECT_DRAFT_SAVED,
    });
    expect(audit).toBeTruthy();
    expect(audit.metadata.projectId).toBe(id);
    expect(JSON.stringify(audit.metadata)).not.toMatch(/Poulailler/);
  });

  it("updates allowlisted fields and rejects ownership or lifecycle changes", async () => {
    const owner = await account("edit-owner");
    const created = await request(app)
      .post("/api/projects")
      .set("Cookie", owner)
      .send({});
    expect(created.status).toBe(201);
    const id = created.body.project.id;

    const updated = await request(app)
      .patch(`/api/projects/mine/${id}`)
      .set("Cookie", owner)
      .send({
        title: "Atelier textile",
        objective: "Former des couturières",
        city: "Douala",
      });
    expect(updated.status).toBe(200);
    expect(updated.body.project).toMatchObject({
      title: "Atelier textile",
      objective: "Former des couturières",
      city: "Douala",
      status: "draft",
      visibility: "private",
    });

    const rejected = await request(app)
      .patch(`/api/projects/mine/${id}`)
      .set("Cookie", owner)
      .send({ title: "Ne doit pas passer", status: "published", ownerId: id });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.code).toBe("FIELD_NOT_ALLOWED");

    const reopened = await request(app).get(`/api/projects/mine/${id}`).set("Cookie", owner);
    expect(reopened.body.project.title).toBe("Atelier textile");
    expect(reopened.body.project.status).toBe("draft");

    const tooLong = await request(app)
      .patch(`/api/projects/mine/${id}`)
      .set("Cookie", owner)
      .send({ summary: "x".repeat(281) });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error.code).toBe("FIELD_TOO_LONG");
    expect(tooLong.body.error.fields).toEqual(["summary"]);
  });
});
