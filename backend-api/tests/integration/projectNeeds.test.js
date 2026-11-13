const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../../index");
const User = require("../../models/user");
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

describe("project needs", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-auth";
  });

  it("keeps needs on their stage, requires a blocker explanation, and hides drafts", async () => {
    const owner = await account("need-owner");
    const other = await account("need-other");
    const created = await request(app).post("/api/projects").set("Cookie", owner).send({ title: "Poulailler" });
    const id = created.body.project.id;
    const stage = await request(app)
      .post(`/api/projects/mine/${id}/stages`)
      .set("Cookie", owner)
      .send({ title: "Préparer le terrain" });
    const stageId = stage.body.project.stages[0].id;

    const foreignProject = await request(app)
      .post("/api/projects")
      .set("Cookie", owner)
      .send({ title: "Autre" });
    const foreignStage = await request(app)
      .post(`/api/projects/mine/${foreignProject.body.project.id}/stages`)
      .set("Cookie", owner)
      .send({ title: "Ailleurs" });
    const missingStage = await request(app)
      .post(`/api/projects/mine/${id}/stages/${foreignStage.body.project.stages[0].id}/needs`)
      .set("Cookie", owner)
      .send({ title: "Grillage", kind: "resource" });
    expect(missingStage.status).toBe(404);
    expect(missingStage.body.error.code).toBe("STAGE_NOT_FOUND");

    const blocked = await request(app)
      .post(`/api/projects/mine/${id}/stages/${stageId}/needs`)
      .set("Cookie", owner)
      .send({ title: "Grillage", kind: "resource", status: "blocked" });
    expect(blocked.status).toBe(400);
    expect(blocked.body.error.code).toBe("BLOCKER_EXPLANATION_REQUIRED");

    const createdNeed = await request(app)
      .post(`/api/projects/mine/${id}/stages/${stageId}/needs`)
      .set("Cookie", owner)
      .send({ title: "Grillage", description: "Clôture", kind: "resource" });
    expect(createdNeed.status).toBe(201);
    const needId = createdNeed.body.project.stages[0].needs[0].id;
    expect(createdNeed.body.project.stages[0].needs[0]).toMatchObject({
      title: "Grillage",
      kind: "resource",
      status: "open",
      blockerExplanation: "",
    });

    const hidden = await request(app).get(`/api/projects/${id}`);
    expect(hidden.status).toBe(404);

    const forbidden = await request(app)
      .patch(`/api/projects/mine/${id}/stages/${stageId}/needs/${needId}`)
      .set("Cookie", other)
      .send({ title: "Détourné" });
    expect(forbidden.status).toBe(403);

    const stillBlocked = await request(app)
      .patch(`/api/projects/mine/${id}/stages/${stageId}/needs/${needId}`)
      .set("Cookie", owner)
      .send({ status: "blocked", blockerExplanation: "   " });
    expect(stillBlocked.status).toBe(400);

    const explained = await request(app)
      .patch(`/api/projects/mine/${id}/stages/${stageId}/needs/${needId}`)
      .set("Cookie", owner)
      .send({ status: "blocked", blockerExplanation: "Le grillage manque." });
    expect(explained.status).toBe(200);
    expect(explained.body.project.stages[0].needs[0].blockerExplanation).toBe("Le grillage manque.");

    const fulfilled = await request(app)
      .patch(`/api/projects/mine/${id}/stages/${stageId}/needs/${needId}`)
      .set("Cookie", owner)
      .send({ status: "fulfilled" });
    expect(fulfilled.body.project.stages[0].needs[0]).toMatchObject({
      status: "fulfilled",
      blockerExplanation: "",
    });

    const published = await request(app)
      .post(`/api/projects/mine/${id}/publish`)
      .set("Cookie", owner)
      .send(COMPLETE);
    expect(published.status).toBe(200);
    const visible = await request(app).get(`/api/projects/${id}`);
    expect(visible.status).toBe(200);
    expect(visible.body.project.stages[0].needs[0].title).toBe("Grillage");
    expect(visible.body.project.ownerId).toBeUndefined();
    expect(visible.body.project.visibility).toBeUndefined();

    const removed = await request(app)
      .delete(`/api/projects/mine/${id}/stages/${stageId}/needs/${needId}`)
      .set("Cookie", owner);
    expect(removed.status).toBe(200);
    expect(removed.body.project.stages[0].needs).toEqual([]);

    const audit = await UserAuditEvent.findOne({
      action: USER_AUDIT_ACTIONS.PROJECT_NEEDS_CHANGED,
      "metadata.projectId": id,
      "metadata.operation": "updated",
    });
    expect(audit).toBeTruthy();
    expect(JSON.stringify(audit.metadata)).not.toMatch(/grillage manque/i);
  });
});
