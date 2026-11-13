const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../../index");
const User = require("../../models/user");
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

describe("project stages", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-auth";
  });

  it("lets the owner add, update, and reorder stages without exposing a draft", async () => {
    const owner = await account("stage-owner");
    const other = await account("stage-other");
    const created = await request(app)
      .post("/api/projects")
      .set("Cookie", owner)
      .send({ title: "Poulailler" });
    const id = created.body.project.id;

    const missingTitle = await request(app)
      .post(`/api/projects/mine/${id}/stages`)
      .set("Cookie", owner)
      .send({ title: "   " });
    expect(missingTitle.status).toBe(400);
    expect(missingTitle.body.error.code).toBe("STAGE_TITLE_REQUIRED");

    const first = await request(app)
      .post(`/api/projects/mine/${id}/stages`)
      .set("Cookie", owner)
      .send({ title: "Préparer le terrain", description: "Clôturer" });
    expect(first.status).toBe(201);
    const second = await request(app)
      .post(`/api/projects/mine/${id}/stages`)
      .set("Cookie", owner)
      .send({ title: "Accueillir les volailles" });
    expect(second.status).toBe(201);

    const stages = second.body.project.stages;
    expect(stages.map((stage) => stage.title)).toEqual([
      "Préparer le terrain",
      "Accueillir les volailles",
    ]);
    expect(stages[0].status).toBe("not_started");

    const blocked = await request(app)
      .patch(`/api/projects/mine/${id}/stages/${stages[0].id}`)
      .set("Cookie", owner)
      .send({ status: "blocked", blockerExplanation: "Le grillage manque." });
    expect(blocked.status).toBe(200);
    expect(blocked.body.project.stages[0]).toMatchObject({
      status: "blocked",
      blockerExplanation: "Le grillage manque.",
    });

    const forbidden = await request(app)
      .patch(`/api/projects/mine/${id}/stages/${stages[0].id}`)
      .set("Cookie", other)
      .send({ title: "Détourné" });
    expect(forbidden.status).toBe(403);

    const reordered = await request(app)
      .put(`/api/projects/mine/${id}/stages/order`)
      .set("Cookie", owner)
      .send({ orderedIds: [stages[1].id, stages[0].id] });
    expect(reordered.status).toBe(200);
    expect(reordered.body.project.stages.map((stage) => stage.title)).toEqual([
      "Accueillir les volailles",
      "Préparer le terrain",
    ]);

    const hidden = await request(app).get(`/api/projects/${id}`);
    expect(hidden.status).toBe(404);

    const audit = await UserAuditEvent.findOne({
      action: USER_AUDIT_ACTIONS.PROJECT_STAGES_CHANGED,
      "metadata.projectId": id,
      "metadata.operation": "reordered",
    });
    expect(audit).toBeTruthy();
    expect(JSON.stringify(audit.metadata)).not.toMatch(/volailles/);
  });
});
