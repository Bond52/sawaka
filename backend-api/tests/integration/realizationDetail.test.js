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
const mongoose = require("mongoose");
const app = require("../../index");
const User = require("../../models/user");
const Domain = require("../../models/Domain");
const Article = require("../../models/Article");
const ContributorProfile = require("../../models/ContributorProfile");
const Realization = require("../../models/Realization");
const { PROFILE_STATUS } = require("../../models/ContributorProfile");
const imageStorage = require("../../services/imageStorage");

const PRIVATE_FIELD = /publicId|email|password|ownerId|clientGroupId|photoPublicId|userId|"status"/;

function jpeg() {
  const buffer = Buffer.alloc(16, 0);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  return buffer;
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

async function visibleProfile(user, domain) {
  return ContributorProfile.create({
    userId: user._id,
    displayName: "Amina Diallo",
    country: "Cameroon",
    region: "Littoral",
    city: "Douala",
    domainId: domain._id,
    status: PROFILE_STATUS.ACTIVE,
    isVisible: true,
    photoUrl: "https://cdn.example/amina.jpg",
    photoPublicId: "profiles/secret-photo",
  });
}

describe("public realization detail", () => {
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

  it("returns one published realization and only public contributor fields", async () => {
    const { user } = await account("detail-public");
    const domain = await Domain.create({
      slug: "wood-detail",
      nameFR: "Menuiserie",
      nameEN: "Carpentry",
      isActive: true,
    });
    const profile = await visibleProfile(user, domain);
    const published = await Realization.create({
      ownerId: user._id,
      clientGroupId: "group-table-01",
      sequence: 1,
      description: "Table en chêne",
      domainId: domain._id,
      completedOn: "2024-03-12",
      mainMaterial: "Chêne blanc",
      status: "published",
      images: [
        { url: "https://cdn.example/1.jpg", publicId: "secret-1" },
        { url: "https://cdn.example/2.jpg", publicId: "secret-2" },
      ],
    });

    const res = await request(app).get(`/api/realizations/${published._id}`);
    expect(res.status).toBe(200);
    expect(res.body.realization).toEqual({
      id: String(published._id),
      title: "",
      description: "Table en chêne",
      domainId: String(domain._id),
      domain: { id: String(domain._id), nameFR: "Menuiserie", nameEN: "Carpentry" },
      completedOn: "2024-03-12",
      mainMaterial: "Chêne blanc",
      images: [{ url: "https://cdn.example/1.jpg" }, { url: "https://cdn.example/2.jpg" }],
    });
    expect(res.body.contributor).toEqual({
      id: String(profile._id),
      displayName: "Amina Diallo",
      photoUrl: "https://cdn.example/amina.jpg",
      city: "Douala",
      region: "Littoral",
      country: "Cameroon",
      domain: { id: String(domain._id), nameFR: "Menuiserie", nameEN: "Carpentry" },
    });
    expect(JSON.stringify(res.body)).not.toMatch(PRIVATE_FIELD);
    expect(await Article.countDocuments()).toBe(0);
  });

  it("keeps an older realization valid when mainMaterial was never stored", async () => {
    const { user } = await account("detail-legacy");
    const domain = await Domain.create({
      slug: "clay-detail",
      nameFR: "Poterie",
      nameEN: "Pottery",
      isActive: true,
    });
    await visibleProfile(user, domain);
    const published = await Realization.create({
      ownerId: user._id,
      clientGroupId: "group-bowl-01",
      sequence: 1,
      description: "Bol",
      status: "published",
      images: [{ url: "https://cdn.example/bowl.jpg", publicId: "secret-bowl" }],
    });
    await Realization.collection.updateOne({ _id: published._id }, { $unset: { mainMaterial: "" } });

    const res = await request(app).get(`/api/realizations/${published._id}`);
    expect(res.status).toBe(200);
    expect(res.body.realization.mainMaterial).toBe("");
    expect(res.body.realization.description).toBe("Bol");
  });

  it("hides drafts, unknown ids, invalid ids, and non-public profiles the same way", async () => {
    const { user } = await account("detail-hidden");
    const domain = await Domain.create({
      slug: "metal-detail",
      nameFR: "Métal",
      nameEN: "Metal",
      isActive: true,
    });
    const profile = await visibleProfile(user, domain);
    const draft = await Realization.create({
      ownerId: user._id,
      clientGroupId: "group-draft-01",
      sequence: 1,
      description: "Brouillon secret",
      status: "draft",
      images: [],
    });
    const published = await Realization.create({
      ownerId: user._id,
      clientGroupId: "group-live-01",
      sequence: 2,
      description: "Visible",
      status: "published",
      images: [{ url: "https://cdn.example/live.jpg", publicId: "secret-live" }],
    });

    const missingId = new mongoose.Types.ObjectId();
    const missing = await request(app).get(`/api/realizations/${missingId}`);
    const draftRes = await request(app).get(`/api/realizations/${draft._id}`);
    const invalid = await request(app).get("/api/realizations/not-an-id");
    expect(missing.status).toBe(404);
    expect(draftRes.status).toBe(404);
    expect(invalid.status).toBe(404);
    expect(draftRes.body).toEqual(missing.body);
    expect(invalid.body).toEqual(missing.body);
    expect(JSON.stringify(draftRes.body)).not.toContain("Brouillon secret");

    profile.isVisible = false;
    await profile.save();
    const hidden = await request(app).get(`/api/realizations/${published._id}`);
    expect(hidden.status).toBe(404);
    expect(hidden.body).toEqual(missing.body);

    profile.isVisible = true;
    profile.status = PROFILE_STATUS.INACTIVE;
    await profile.save();
    const inactive = await request(app).get(`/api/realizations/${published._id}`);
    expect(inactive.status).toBe(404);
    expect(inactive.body).toEqual(missing.body);
  });

  it("persists mainMaterial through publication and returns it on the public detail", async () => {
    const { user, cookie } = await account("detail-publish");
    const domain = await Domain.create({
      slug: "wood-publish",
      nameFR: "Menuiserie",
      nameEN: "Carpentry",
      isActive: true,
    });
    await visibleProfile(user, domain);

    const created = await request(app)
      .post("/api/contributors/me/realizations")
      .set("Cookie", cookie)
      .field(
        "manifest",
        JSON.stringify({
          intent: "publish-ready",
          groups: [
            {
              clientId: "group-oak-001",
              sequence: 1,
              description: "Table en chêne",
              domainId: String(domain._id),
              completedOn: "2024-03-12",
              mainMaterial: "  Chêne blanc  ",
              photoIds: ["photo-oak-1", "photo-oak-2"],
            },
          ],
        })
      )
      .attach("photos", jpeg(), { filename: "photo-oak-1", contentType: "image/jpeg" })
      .attach("photos", jpeg(), { filename: "photo-oak-2", contentType: "image/jpeg" });

    expect(created.status).toBe(200);
    const stored = await Realization.findOne({ ownerId: user._id });
    expect(stored.mainMaterial).toBe("Chêne blanc");
    expect(stored.status).toBe("published");
    expect(stored.images.map((image) => image.url)).toEqual([
      "https://res.cloudinary.com/demo/image/upload/sawaka-realizations/1.jpg",
      "https://res.cloudinary.com/demo/image/upload/sawaka-realizations/2.jpg",
    ]);

    const detail = await request(app).get(`/api/realizations/${stored._id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.realization.mainMaterial).toBe("Chêne blanc");
    expect(detail.body.realization.images.map((image) => image.url)).toEqual([
      "https://res.cloudinary.com/demo/image/upload/sawaka-realizations/1.jpg",
      "https://res.cloudinary.com/demo/image/upload/sawaka-realizations/2.jpg",
    ]);
    expect(JSON.stringify(detail.body)).not.toMatch(PRIVATE_FIELD);
  });
});
