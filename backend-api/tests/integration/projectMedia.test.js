const mockUploads = { n: 0 };

jest.mock("../../services/imageStorage", () => ({
  uploadProjectImage: jest.fn(async () => {
    mockUploads.n += 1;
    return {
      url: `https://res.cloudinary.com/demo/image/upload/sawaka-projects/${mockUploads.n}.jpg`,
      publicId: `secret-project-${mockUploads.n}`,
    };
  }),
  destroyStoredImage: jest.fn(async () => undefined),
}));

const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../../index");
const User = require("../../models/user");
const imageStorage = require("../../services/imageStorage");
const { UserAuditEvent, USER_AUDIT_ACTIONS } = require("../../services/AuditService");

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

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

describe("project media", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-auth";
  });

  it("stores a cover and stage image for the owner and hides draft media", async () => {
    const owner = await account("media-owner");
    const other = await account("media-other");
    const created = await request(app).post("/api/projects").set("Cookie", owner).send({ title: "Poulailler" });
    const id = created.body.project.id;
    const stage = await request(app)
      .post(`/api/projects/mine/${id}/stages`)
      .set("Cookie", owner)
      .send({ title: "Préparer" });
    const stageId = stage.body.project.stages[0].id;

    const missing = await request(app).post(`/api/projects/mine/${id}/cover`).set("Cookie", owner);
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("IMAGE_REQUIRED");

    const text = await request(app)
      .post(`/api/projects/mine/${id}/cover`)
      .set("Cookie", owner)
      .attach("image", Buffer.from("hello"), { filename: "note.txt", contentType: "text/plain" });
    expect(text.status).toBe(400);
    expect(text.body.error.code).toBe("UNSUPPORTED_IMAGE_TYPE");

    const cover = await request(app)
      .post(`/api/projects/mine/${id}/cover`)
      .set("Cookie", owner)
      .attach("image", PNG, { filename: "cover.png", contentType: "image/png" });
    expect(cover.status).toBe(200);
    expect(cover.body.project.coverImage.url).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    expect(JSON.stringify(cover.body)).not.toMatch(/publicId|secret-project/);

    const replaced = await request(app)
      .post(`/api/projects/mine/${id}/cover`)
      .set("Cookie", owner)
      .attach("image", PNG, { filename: "cover-2.png", contentType: "image/png" });
    expect(replaced.status).toBe(200);
    expect(imageStorage.destroyStoredImage).toHaveBeenCalledWith("secret-project-1");

    const forbidden = await request(app)
      .post(`/api/projects/mine/${id}/images`)
      .set("Cookie", other)
      .attach("image", PNG, { filename: "other.png", contentType: "image/png" });
    expect(forbidden.status).toBe(403);

    const image = await request(app)
      .post(`/api/projects/mine/${id}/images`)
      .set("Cookie", owner)
      .attach("image", PNG, { filename: "yard.png", contentType: "image/png" });
    expect(image.status).toBe(201);
    expect(image.body.project.images).toHaveLength(1);

    const stageImage = await request(app)
      .post(`/api/projects/mine/${id}/stages/${stageId}/images`)
      .set("Cookie", owner)
      .attach("image", PNG, { filename: "stage.png", contentType: "image/png" });
    expect(stageImage.status).toBe(201);
    expect(stageImage.body.project.stages[0].images).toHaveLength(1);

    const hidden = await request(app).get(`/api/projects/${id}`);
    expect(hidden.status).toBe(404);

    const published = await request(app)
      .post(`/api/projects/mine/${id}/publish`)
      .set("Cookie", owner)
      .send(COMPLETE);
    expect(published.status).toBe(200);
    const visible = await request(app).get(`/api/projects/${id}`);
    expect(visible.body.project.coverImage.url).toMatch(/^https:\/\//);
    expect(visible.body.project.ownerId).toBeUndefined();
    expect(JSON.stringify(visible.body)).not.toMatch(/publicId|secret-project/);

    const imageId = image.body.project.images[0].id;
    const removedImage = await request(app)
      .delete(`/api/projects/mine/${id}/images/${imageId}`)
      .set("Cookie", owner);
    expect(removedImage.status).toBe(200);
    expect(removedImage.body.project.images).toEqual([]);

    const removedCover = await request(app).delete(`/api/projects/mine/${id}/cover`).set("Cookie", owner);
    expect(removedCover.body.project.coverImage).toBeNull();

    const audit = await UserAuditEvent.findOne({
      action: USER_AUDIT_ACTIONS.PROJECT_MEDIA_CHANGED,
      "metadata.projectId": id,
      "metadata.operation": "cover_set",
    });
    expect(audit).toBeTruthy();
    expect(JSON.stringify(audit.metadata)).not.toMatch(/secret-project|cloudinary/);
  });
});
