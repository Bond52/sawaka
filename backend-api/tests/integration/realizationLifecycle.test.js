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
    city: "Douala",
    domainId: domain._id,
    status: PROFILE_STATUS.ACTIVE,
    isVisible: true,
  });
}

describe("realization lifecycle", () => {
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
    imageStorage.destroyStoredImage.mockReset();
    imageStorage.destroyStoredImage.mockResolvedValue(undefined);
  });

  async function world(label) {
    const owner = await account(`${label}-owner`);
    const other = await account(`${label}-other`);
    const domain = await Domain.create({
      slug: `${label}-wood`,
      nameFR: "Menuiserie",
      nameEN: "Carpentry",
      isActive: true,
    });
    const profile = await visibleProfile(owner.user, domain);
    return { owner, other, domain, profile };
  }

  async function realization({ owner, domain, status, images, title, mainMaterial, description, sequence }) {
    return Realization.create({
      ownerId: owner._id,
      clientGroupId: `group-${sequence}-${status}`,
      sequence,
      title: title === undefined ? "Table basse" : title,
      description: description || "Chaise en noyer",
      domainId: domain._id,
      completedOn: "2024-05-01",
      mainMaterial: mainMaterial === undefined ? "Noyer" : mainMaterial,
      status,
      images:
        images === undefined
          ? [{ url: "https://cdn.example/chair.jpg", publicId: `photo-${sequence}` }]
          : images,
    });
  }

  it("publishes an owned draft and keeps it on the public surfaces", async () => {
    const { owner, other, domain, profile } = await world("publish");
    const draft = await realization({
      owner: owner.user,
      domain,
      status: "draft",
      sequence: 1,
      title: "  Table basse  ",
      mainMaterial: "Noyer",
    });

    const anonymous = await request(app).post(`/api/contributors/me/realizations/${draft._id}/publish`);
    expect(anonymous.status).toBe(401);

    const foreign = await request(app)
      .post(`/api/contributors/me/realizations/${draft._id}/publish`)
      .set("Cookie", other.cookie);
    expect(foreign.status).toBe(404);
    expect((await Realization.findById(draft._id)).status).toBe("draft");

    const published = await request(app)
      .post(`/api/contributors/me/realizations/${draft._id}/publish`)
      .set("Cookie", owner.cookie);
    expect(published.status).toBe(200);
    expect(published.body.realization.status).toBe("published");
    expect(published.body.realization.title).toBe("Table basse");
    expect(published.body.realization.mainMaterial).toBe("Noyer");
    expect(published.body.realization.description).toBe("Chaise en noyer");
    expect(published.body.realization.images).toEqual([{ url: "https://cdn.example/chair.jpg" }]);
    expect(JSON.stringify(published.body)).not.toMatch(/publicId|email/);
    expect(imageStorage.destroyStoredImage).not.toHaveBeenCalled();

    const again = await request(app)
      .post(`/api/contributors/me/realizations/${draft._id}/publish`)
      .set("Cookie", owner.cookie);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("ALREADY_PUBLISHED");

    const catalog = await request(app).get("/api/realizations");
    expect(catalog.body.realizations.map((item) => item.id)).toEqual([String(draft._id)]);
    expect(catalog.body.realizations[0].title).toBe("Table basse");
    expect(catalog.body.realizations[0].mainMaterial).toBe("Noyer");
    expect(catalog.body.realizations[0].status).toBeUndefined();

    const detail = await request(app).get(`/api/realizations/${draft._id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.realization.title).toBe("Table basse");
    expect(detail.body.realization.mainMaterial).toBe("Noyer");

    const tab = await request(app).get(`/api/contributors/${profile._id}/realizations`);
    expect(tab.body.realizations).toHaveLength(1);
    expect(tab.body.realizations[0].title).toBe("Table basse");
    expect(tab.body.realizations[0].mainMaterial).toBe("Noyer");
  });

  it("refuses to publish a draft that has no photo", async () => {
    const { owner, domain } = await world("not-ready");
    const draft = await realization({
      owner: owner.user,
      domain,
      status: "draft",
      sequence: 1,
      images: [],
    });
    const res = await request(app)
      .post(`/api/contributors/me/realizations/${draft._id}/publish`)
      .set("Cookie", owner.cookie);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("NOT_READY");
    expect((await Realization.findById(draft._id)).status).toBe("draft");
    const catalog = await request(app).get("/api/realizations");
    expect(catalog.body.realizations).toEqual([]);
  });

  it("moves a published realization back to draft without deleting photos", async () => {
    const { owner, other, domain, profile } = await world("unpublish");
    const live = await realization({
      owner: owner.user,
      domain,
      status: "published",
      sequence: 2,
    });

    const foreign = await request(app)
      .post(`/api/contributors/me/realizations/${live._id}/draft`)
      .set("Cookie", other.cookie);
    expect(foreign.status).toBe(404);
    expect((await Realization.findById(live._id)).status).toBe("published");

    const drafted = await request(app)
      .post(`/api/contributors/me/realizations/${live._id}/draft`)
      .set("Cookie", owner.cookie);
    expect(drafted.status).toBe(200);
    expect(drafted.body.realization.status).toBe("draft");
    expect(drafted.body.realization.title).toBe("Table basse");
    expect(drafted.body.realization.mainMaterial).toBe("Noyer");
    expect(drafted.body.realization.images).toEqual([{ url: "https://cdn.example/chair.jpg" }]);
    expect(imageStorage.destroyStoredImage).not.toHaveBeenCalled();

    const again = await request(app)
      .post(`/api/contributors/me/realizations/${live._id}/draft`)
      .set("Cookie", owner.cookie);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("ALREADY_DRAFT");

    const catalog = await request(app).get("/api/realizations");
    expect(catalog.body.realizations).toEqual([]);
    const detail = await request(app).get(`/api/realizations/${live._id}`);
    expect(detail.status).toBe(404);
    const tab = await request(app).get(`/api/contributors/${profile._id}/realizations`);
    expect(tab.body.realizations).toEqual([]);

    const own = await request(app).get("/api/contributors/me/realizations").set("Cookie", owner.cookie);
    expect(own.body.realizations).toHaveLength(1);
    expect(own.body.realizations[0].status).toBe("draft");
    expect(own.body.realizations[0].title).toBe("Table basse");
    expect(own.body.realizations[0].mainMaterial).toBe("Noyer");
  });

  it("rejects missing ids and does not leak another owner's realization", async () => {
    const { owner } = await world("missing");
    const missing = new mongoose.Types.ObjectId();
    const publish = await request(app)
      .post(`/api/contributors/me/realizations/${missing}/publish`)
      .set("Cookie", owner.cookie);
    const draft = await request(app)
      .post(`/api/contributors/me/realizations/${missing}/draft`)
      .set("Cookie", owner.cookie);
    const remove = await request(app)
      .delete(`/api/contributors/me/realizations/${missing}`)
      .set("Cookie", owner.cookie);
    const invalid = await request(app)
      .delete("/api/contributors/me/realizations/not-an-id")
      .set("Cookie", owner.cookie);
    expect(publish.status).toBe(404);
    expect(draft.status).toBe(404);
    expect(remove.status).toBe(404);
    expect(invalid.status).toBe(404);
    expect(publish.body.error.code).toBe("NOT_FOUND");
  });

  it("deletes an owned draft and its stored photos", async () => {
    const { owner, other, domain } = await world("delete-draft");
    const draft = await realization({
      owner: owner.user,
      domain,
      status: "draft",
      sequence: 1,
      images: [
        { url: "https://cdn.example/a.jpg", publicId: "photos/a" },
        { url: "https://cdn.example/b.jpg", publicId: "photos/b" },
      ],
    });
    const usersBefore = await User.countDocuments();
    const profilesBefore = await ContributorProfile.countDocuments();
    const domainsBefore = await Domain.countDocuments();

    const foreign = await request(app)
      .delete(`/api/contributors/me/realizations/${draft._id}`)
      .set("Cookie", other.cookie);
    expect(foreign.status).toBe(404);
    expect(await Realization.countDocuments()).toBe(1);
    expect(imageStorage.destroyStoredImage).not.toHaveBeenCalled();

    const removed = await request(app)
      .delete(`/api/contributors/me/realizations/${draft._id}`)
      .set("Cookie", owner.cookie);
    expect(removed.status).toBe(200);
    expect(removed.body).toEqual({ deleted: true });
    expect(imageStorage.destroyStoredImage).toHaveBeenCalledTimes(2);
    expect(imageStorage.destroyStoredImage).toHaveBeenCalledWith("photos/a");
    expect(imageStorage.destroyStoredImage).toHaveBeenCalledWith("photos/b");
    expect(await Realization.countDocuments()).toBe(0);
    const own = await request(app).get("/api/contributors/me/realizations").set("Cookie", owner.cookie);
    expect(own.body.realizations).toEqual([]);
    expect(await User.countDocuments()).toBe(usersBefore);
    expect(await ContributorProfile.countDocuments()).toBe(profilesBefore);
    expect(await Domain.countDocuments()).toBe(domainsBefore);
    expect(await Article.countDocuments()).toBe(0);
  });

  it("deletes a published realization from the public surfaces", async () => {
    const { owner, domain, profile } = await world("delete-live");
    const live = await realization({
      owner: owner.user,
      domain,
      status: "published",
      sequence: 1,
      images: [{ url: "https://cdn.example/live.jpg", publicId: "photos/live" }],
    });
    const removed = await request(app)
      .delete(`/api/contributors/me/realizations/${live._id}`)
      .set("Cookie", owner.cookie);
    expect(removed.status).toBe(200);
    expect(imageStorage.destroyStoredImage).toHaveBeenCalledWith("photos/live");
    expect((await request(app).get("/api/realizations")).body.realizations).toEqual([]);
    expect((await request(app).get(`/api/realizations/${live._id}`)).status).toBe(404);
    expect((await request(app).get(`/api/contributors/${profile._id}/realizations`)).body.realizations).toEqual(
      []
    );
    expect(await ContributorProfile.findById(profile._id)).not.toBeNull();
  });

  it("keeps the realization when image cleanup fails", async () => {
    const { owner, domain } = await world("cleanup");
    const draft = await realization({
      owner: owner.user,
      domain,
      status: "draft",
      sequence: 1,
      images: [{ url: "https://cdn.example/stuck.jpg", publicId: "photos/stuck" }],
    });
    imageStorage.destroyStoredImage.mockRejectedValue(Object.assign(new Error("storage down"), { code: "ESTORAGE" }));
    const res = await request(app)
      .delete(`/api/contributors/me/realizations/${draft._id}`)
      .set("Cookie", owner.cookie);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("IMAGE_CLEANUP_FAILED");
    expect(res.body.deleted).toBeUndefined();
    expect(await Realization.findById(draft._id)).not.toBeNull();
    expect(imageStorage.destroyStoredImage).toHaveBeenCalledWith("photos/stuck");
    const own = await request(app).get("/api/contributors/me/realizations").set("Cookie", owner.cookie);
    expect(own.body.realizations).toHaveLength(1);
  });

  it("stores an optional title through publication and accepts a blank or legacy title", async () => {
    const { owner, domain, profile } = await world("title");
    const created = await request(app)
      .post("/api/contributors/me/realizations")
      .set("Cookie", owner.cookie)
      .field(
        "manifest",
        JSON.stringify({
          intent: "publish-ready",
          groups: [
            {
              clientId: "group-title-01",
              sequence: 1,
              title: "  Table basse  ",
              description: "Chaise",
              domainId: String(domain._id),
              completedOn: "2024-05-01",
              mainMaterial: "Noyer",
              photoIds: ["photo-title-1"],
            },
            {
              clientId: "group-blank-02",
              sequence: 2,
              title: "   ",
              description: "",
              domainId: null,
              completedOn: null,
              mainMaterial: "",
              photoIds: ["photo-title-2"],
            },
          ],
        })
      )
      .attach("photos", jpeg(), { filename: "photo-title-1", contentType: "image/jpeg" })
      .attach("photos", jpeg(), { filename: "photo-title-2", contentType: "image/jpeg" });
    expect(created.status).toBe(200);
    const stored = await Realization.find({ ownerId: owner.user._id }).sort({ sequence: 1 });
    expect(stored.map((item) => item.title)).toEqual(["Table basse", ""]);
    expect(stored[0].mainMaterial).toBe("Noyer");
    expect(stored[0].status).toBe("published");

    const detail = await request(app).get(`/api/realizations/${stored[0]._id}`);
    expect(detail.body.realization.title).toBe("Table basse");
    expect(detail.body.realization.mainMaterial).toBe("Noyer");
    const tab = await request(app).get(`/api/contributors/${profile._id}/realizations`);
    expect(tab.body.realizations.map((item) => item.title).sort()).toEqual(["", "Table basse"]);

    const legacy = await realization({
      owner: owner.user,
      domain,
      status: "published",
      sequence: 3,
      title: "",
      description: "Sans titre",
    });
    await Realization.collection.updateOne({ _id: legacy._id }, { $unset: { title: "" } });
    const legacyDetail = await request(app).get(`/api/realizations/${legacy._id}`);
    expect(legacyDetail.status).toBe(200);
    expect(legacyDetail.body.realization.title).toBe("");
    expect(legacyDetail.body.realization.description).toBe("Sans titre");

    const tooLong = await request(app)
      .post("/api/contributors/me/realizations")
      .set("Cookie", owner.cookie)
      .field(
        "manifest",
        JSON.stringify({
          intent: "save-drafts",
          groups: [
            {
              clientId: "group-long-03",
              sequence: 4,
              title: "x".repeat(121),
              description: "",
              photoIds: [],
            },
          ],
        })
      );
    expect(tooLong.status).toBe(422);
    expect(tooLong.body.outcome).toBe("failed");
    expect(tooLong.body.items[0].status).toBe("failed");
    expect(tooLong.body.items[0].code).toBe("TITLE_TOO_LONG");
    expect(await Realization.findOne({ clientGroupId: "group-long-03" })).toBeNull();
  });
});
