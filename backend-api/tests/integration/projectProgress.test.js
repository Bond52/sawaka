const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../../index");
const User = require("../../models/user");

async function ownerCookie() {
  const hash = await bcrypt.hash("Secret123!", 10);
  await User.create({
    firstName: "Amina",
    lastName: "Diallo",
    username: "progress-owner",
    email: "progress-owner@example.com",
    password: hash,
    roles: ["acheteur"],
    isSeller: false,
  });
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "progress-owner@example.com", password: "Secret123!" });
  return login.headers["set-cookie"];
}

describe("project progress on the owner project", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-auth";
  });

  it("recalculates when a stage status changes", async () => {
    const cookie = await ownerCookie();
    const created = await request(app).post("/api/projects").set("Cookie", cookie).send({ title: "Atelier" });
    const id = created.body.project.id;
    expect(created.body.project.progress).toEqual({ available: false, percent: null });

    const withStages = await request(app)
      .post(`/api/projects/mine/${id}/stages`)
      .set("Cookie", cookie)
      .send({ title: "Première" });
    const second = await request(app)
      .post(`/api/projects/mine/${id}/stages`)
      .set("Cookie", cookie)
      .send({ title: "Deuxième" });
    expect(second.body.project.progress).toEqual({ available: true, percent: 0 });

    const stageId = withStages.body.project.stages[0].id;
    const updated = await request(app)
      .patch(`/api/projects/mine/${id}/stages/${stageId}`)
      .set("Cookie", cookie)
      .send({ status: "completed" });
    expect(updated.body.project.progress).toEqual({ available: true, percent: 50 });

    const cancelled = await request(app)
      .patch(`/api/projects/mine/${id}/stages/${second.body.project.stages[1].id}`)
      .set("Cookie", cookie)
      .send({ status: "cancelled" });
    expect(cancelled.body.project.progress).toEqual({ available: true, percent: 100 });
  });
});
