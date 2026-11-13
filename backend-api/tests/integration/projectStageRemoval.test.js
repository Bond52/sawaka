jest.mock("../../services/imageStorage", () => ({
  uploadProjectImage: jest.fn(async () => ({
    url: "https://res.cloudinary.com/demo/image/upload/sawaka-projects/stage.jpg",
    publicId: "secret-stage-image",
  })),
  destroyStoredImage: jest.fn(async () => undefined),
}));

const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../../index");
const User = require("../../models/user");
const imageStorage = require("../../services/imageStorage");

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

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

describe("remove project stage", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-auth";
  });

  it("keeps a stage that still has needs and reorders the stages that remain", async () => {
    const owner = await account("remove-owner");
    const other = await account("remove-other");
    const created = await request(app).post("/api/projects").set("Cookie", owner).send({ title: "Poulailler" });
    const id = created.body.project.id;
    const first = await request(app)
      .post(`/api/projects/mine/${id}/stages`)
      .set("Cookie", owner)
      .send({ title: "Préparer" });
    const second = await request(app)
      .post(`/api/projects/mine/${id}/stages`)
      .set("Cookie", owner)
      .send({ title: "Accueillir" });
    const blockedId = first.body.project.stages[0].id;
    const emptyId = second.body.project.stages[1].id;

    const need = await request(app)
      .post(`/api/projects/mine/${id}/stages/${blockedId}/needs`)
      .set("Cookie", owner)
      .send({ title: "Grillage", kind: "resource" });
    expect(need.status).toBe(201);

    await request(app)
      .post(`/api/projects/mine/${id}/stages/${emptyId}/images`)
      .set("Cookie", owner)
      .attach("image", PNG, { filename: "stage.png", contentType: "image/png" });

    const rejected = await request(app)
      .delete(`/api/projects/mine/${id}/stages/${blockedId}`)
      .set("Cookie", owner);
    expect(rejected.status).toBe(409);
    expect(rejected.body.error.code).toBe("STAGE_HAS_NEEDS");
    const kept = await request(app).get(`/api/projects/mine/${id}`).set("Cookie", owner);
    expect(kept.body.project.stages).toHaveLength(2);
    expect(kept.body.project.stages[0].needs).toHaveLength(1);
    expect(kept.body.project.stages[0].needs[0].title).toBe("Grillage");

    const forbidden = await request(app)
      .delete(`/api/projects/mine/${id}/stages/${emptyId}`)
      .set("Cookie", other);
    expect(forbidden.status).toBe(403);

    const removed = await request(app)
      .delete(`/api/projects/mine/${id}/stages/${emptyId}`)
      .set("Cookie", owner);
    expect(removed.status).toBe(200);
    expect(removed.body.project.stages).toHaveLength(1);
    expect(removed.body.project.stages[0]).toMatchObject({
      title: "Préparer",
      position: 0,
    });
    expect(removed.body.project.stages[0].needs[0].title).toBe("Grillage");
    expect(imageStorage.destroyStoredImage).toHaveBeenCalledWith("secret-stage-image");
  });
});
