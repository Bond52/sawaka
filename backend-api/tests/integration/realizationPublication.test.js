jest.mock("../../services/imageStorage", () => ({
  uploadProfileImage: jest.fn(),
  uploadRealizationImage: jest.fn(async () => ({
    url: "https://res.cloudinary.com/demo/image/upload/sawaka-realizations/a.jpg",
    publicId: "sawaka-realizations/a",
  })),
  destroyStoredImage: jest.fn(async () => undefined),
}));

const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../../index");
const User = require("../../models/user");
const Domain = require("../../models/Domain");
const Article = require("../../models/Article");
const ContributorProfile = require("../../models/ContributorProfile");
const Realization = require("../../models/Realization");
const { PROFILE_STATUS } = require("../../models/ContributorProfile");
const imageStorage = require("../../services/imageStorage");

function jpeg() {
  const buffer = Buffer.alloc(16, 0);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  return buffer;
}

function png() {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
}

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
  return { user, cookie: login.headers["set-cookie"] };
}

function manifest(intent, groups) {
  return JSON.stringify({ intent, groups });
}

describe("realization publication", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-auth";
  });

  beforeEach(() => {
    let n = 0;
    imageStorage.uploadRealizationImage.mockImplementation(async () => {
      n += 1;
      return {
        url: `https://res.cloudinary.com/demo/image/upload/sawaka-realizations/${n}.jpg`,
        publicId: `sawaka-realizations/id-${n}`,
      };
    });
  });

  it("rejects an unauthenticated commit", async () => {
    const res = await request(app)
      .post("/api/contributors/me/realizations")
      .field("manifest", manifest("save-drafts", []));
    expect(res.status).toBe(401);
  });

  it("publishes only groups with an image and keeps the others private", async () => {
    const { user, cookie } = await account("amina-review");
    const domain = await Domain.create({
      slug: "wood",
      nameFR: "Bois",
      nameEN: "Wood",
      isActive: true,
    });
    await ContributorProfile.create({
      userId: user._id,
      displayName: "Amina",
      country: "Cameroon",
      domainId: domain._id,
      status: PROFILE_STATUS.ACTIVE,
      isVisible: true,
    });

    const res = await request(app)
      .post("/api/contributors/me/realizations")
      .set("Cookie", cookie)
      .field(
        "manifest",
        manifest("publish-ready", [
          {
            clientId: "group-chair-1",
            sequence: 1,
            description: "Chaise",
            domainId: String(domain._id),
            completedOn: "2024-05-01",
            photoIds: ["photo-chair-1", "photo-chair-2"],
          },
          {
            clientId: "group-empty-1",
            sequence: 2,
            description: "Brouillon secret",
            photoIds: [],
          },
          {
            clientId: "group-plain-01",
            sequence: 3,
            description: "",
            domainId: null,
            completedOn: null,
            photoIds: ["photo-plain-01"],
          },
        ])
      )
      .attach("photos", jpeg(), { filename: "photo-chair-1", contentType: "image/jpeg" })
      .attach("photos", png(), { filename: "photo-chair-2", contentType: "image/png" })
      .attach("photos", jpeg(), { filename: "photo-plain-01", contentType: "image/jpeg" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        outcome: "success",
        publishedCount: 2,
        draftCount: 1,
        failedCount: 0,
      })
    );
    expect(JSON.stringify(res.body)).not.toMatch(/publicId|token|buffer/i);

    const stored = await Realization.find({ ownerId: user._id }).sort({ sequence: 1 });
    expect(stored.map((item) => item.status)).toEqual(["published", "draft", "published"]);
    expect(stored[0].images.map((image) => image.url)).toEqual([
      "https://res.cloudinary.com/demo/image/upload/sawaka-realizations/1.jpg",
      "https://res.cloudinary.com/demo/image/upload/sawaka-realizations/2.jpg",
    ]);
    expect(stored[0].description).toBe("Chaise");
    expect(String(stored[0].domainId)).toBe(String(domain._id));
    expect(stored[0].completedOn).toBe("2024-05-01");
    expect(stored[2].description).toBe("");
    expect(stored[2].domainId).toBeNull();
    expect(await Article.countDocuments()).toBe(0);

    const profileId = String((await ContributorProfile.findOne({ userId: user._id }))._id);
    const pub = await request(app).get(`/api/contributors/${profileId}/realizations`);
    expect(pub.status).toBe(200);
    expect(pub.body.realizations).toHaveLength(2);
    expect(JSON.stringify(pub.body)).not.toContain("Brouillon secret");
    expect(JSON.stringify(pub.body)).not.toMatch(/publicId/);

    const own = await request(app).get("/api/contributors/me/realizations").set("Cookie", cookie);
    expect(own.status).toBe(200);
    expect(own.body.realizations).toHaveLength(3);
    expect(own.body.realizations.some((item) => item.description === "Brouillon secret")).toBe(true);
    expect(JSON.stringify(own.body)).not.toMatch(/publicId/);

    const again = await request(app)
      .post("/api/contributors/me/realizations")
      .set("Cookie", cookie)
      .field(
        "manifest",
        manifest("publish-ready", [
          {
            clientId: "group-chair-1",
            sequence: 1,
            description: "Chaise",
            photoIds: ["photo-chair-1"],
          },
        ])
      )
      .attach("photos", jpeg(), { filename: "photo-chair-1", contentType: "image/jpeg" });
    expect(again.body.publishedCount).toBe(1);
    expect(await Realization.countDocuments({ ownerId: user._id, clientGroupId: "group-chair-1" })).toBe(1);
  });

  it("saves every realization as a draft and publishes nothing", async () => {
    const { user, cookie } = await account("amina-drafts");
    const res = await request(app)
      .post("/api/contributors/me/realizations")
      .set("Cookie", cookie)
      .field(
        "manifest",
        manifest("save-drafts", [
          {
            clientId: "group-draft-01",
            sequence: 1,
            description: "Privée",
            photoIds: ["photo-draft-01"],
          },
        ])
      )
      .attach("photos", jpeg(), { filename: "photo-draft-01", contentType: "image/jpeg" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ outcome: "success", publishedCount: 0, draftCount: 1, failedCount: 0 })
    );
    const stored = await Realization.findOne({ ownerId: user._id });
    expect(stored.status).toBe("draft");
    expect(stored.images).toHaveLength(1);
  });

  it("rejects another user's identifier and an invalid image without publishing them", async () => {
    const owner = await account("owner-review");
    const other = await account("other-review");
    const created = await Realization.create({
      ownerId: owner.user._id,
      clientGroupId: "group-owner-1",
      sequence: 1,
      description: "Owner only",
      status: "draft",
      images: [],
    });

    const forbidden = await request(app)
      .post("/api/contributors/me/realizations")
      .set("Cookie", other.cookie)
      .field(
        "manifest",
        manifest("publish-ready", [
          {
            id: String(created._id),
            clientId: "group-other-01",
            sequence: 1,
            description: "Stolen",
            photoIds: ["photo-other-01"],
          },
        ])
      )
      .attach("photos", jpeg(), { filename: "photo-other-01", contentType: "image/jpeg" });
    expect(forbidden.status).toBe(422);
    expect(forbidden.body.outcome).toBe("failed");
    expect((await Realization.findById(created._id)).description).toBe("Owner only");
    expect(await Realization.countDocuments({ ownerId: other.user._id })).toBe(0);

    const mixed = await request(app)
      .post("/api/contributors/me/realizations")
      .set("Cookie", owner.cookie)
      .field(
        "manifest",
        manifest("publish-ready", [
          {
            clientId: "group-good-001",
            sequence: 1,
            description: "",
            photoIds: ["photo-good-001"],
          },
          {
            clientId: "group-bad-0001",
            sequence: 2,
            description: "",
            photoIds: ["photo-bad-0001"],
          },
        ])
      )
      .attach("photos", jpeg(), { filename: "photo-good-001", contentType: "image/jpeg" })
      .attach("photos", Buffer.from("<svg></svg>"), {
        filename: "photo-bad-0001",
        contentType: "image/svg+xml",
      });
    expect(mixed.status).toBe(200);
    expect(mixed.body.outcome).toBe("partial");
    expect(mixed.body.publishedCount).toBe(1);
    expect(mixed.body.failedCount).toBe(1);
    expect(await Realization.countDocuments({ clientGroupId: "group-bad-0001" })).toBe(0);
    expect(imageStorage.destroyStoredImage).not.toHaveBeenCalled();
  });

  it("rejects a client owner id and a file that is too large", async () => {
    const { cookie } = await account("amina-guard");
    const spoofed = await request(app)
      .post("/api/contributors/me/realizations")
      .set("Cookie", cookie)
      .field(
        "manifest",
        JSON.stringify({
          intent: "publish-ready",
          ownerId: "someone-else",
          groups: [
            { clientId: "group-guard-1", sequence: 1, description: "", photoIds: [] },
          ],
        })
      );
    expect(spoofed.status).toBe(400);
    expect(spoofed.body.error.fields.ownerId).toBe("FIELD_NOT_ALLOWED");
    expect(await Realization.countDocuments()).toBe(0);

    const big = Buffer.alloc(2 * 1024 * 1024 + 1, 0);
    big[0] = 0xff;
    big[1] = 0xd8;
    big[2] = 0xff;
    const oversized = await request(app)
      .post("/api/contributors/me/realizations")
      .set("Cookie", cookie)
      .field(
        "manifest",
        manifest("publish-ready", [
          { clientId: "group-guard-2", sequence: 1, description: "", photoIds: ["photo-big-0001"] },
        ])
      )
      .attach("photos", big, { filename: "photo-big-0001", contentType: "image/jpeg" });
    expect(oversized.status).toBe(400);
    expect(oversized.body.error.fields.photos).toBe("IMAGE_TOO_LARGE");
    expect(await Realization.countDocuments()).toBe(0);
  });
});
