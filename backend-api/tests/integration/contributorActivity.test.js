jest.mock("../../services/imageStorage", () => ({
  uploadProfileImage: jest.fn(async () => ({
    url: "https://res.cloudinary.com/demo/image/upload/sawaka-contributor-profiles/a.jpg",
    publicId: "sawaka-contributor-profiles/a",
  })),
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
const Realization = require("../../models/Realization");
const ContributorActivity = require("../../models/ContributorActivity");
const ContributorProfile = require("../../models/ContributorProfile");
const { AuditEvent, UserAuditEvent } = require("../../services/AuditService");
const { ensureContributorTaxonomy } = require("../../services/contributorTaxonomySeed");
const Skill = require("../../models/Skill");
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
    emailVerified: true,
  });
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: `${username}@example.com`, password: "Secret123!" });
  return { user, cookie: login.headers["set-cookie"] };
}

async function taxonomy() {
  await ensureContributorTaxonomy();
  const domains = await Domain.find({ isActive: true }).sort({ nameEN: 1 });
  const domain = domains[0];
  const skills = await Skill.find({ domainId: domain._id, isActive: true }).limit(1);
  return { domain, skill: skills[0] };
}

function profileBody(domain, skill, overrides = {}) {
  return {
    displayName: "Amina Diallo",
    domainId: String(domain._id),
    skillIds: [String(skill._id)],
    country: "Cameroon",
    region: "Littoral",
    city: "Douala",
    biography: "Menuisière.",
    ...overrides,
  };
}

async function typesFor(userId) {
  const docs = await ContributorActivity.find({ userId }).sort({ createdAt: 1, _id: 1 });
  return docs.map((doc) => doc.type);
}

describe("contributor recent activity", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-auth";
  });

  beforeEach(() => {
    imageStorage.destroyStoredImage.mockReset();
    imageStorage.destroyStoredImage.mockResolvedValue(undefined);
  });

  it("records one profile.updated event for a successful save and none for a failed save", async () => {
    const owner = await account("activity-profile");
    const { domain, skill } = await taxonomy();
    const created = await request(app)
      .post("/api/contributors")
      .set("Cookie", owner.cookie)
      .send(profileBody(domain, skill));
    expect(created.status).toBe(201);
    expect(await ContributorActivity.countDocuments()).toBe(0);

    const failed = await request(app)
      .patch("/api/contributors/me")
      .set("Cookie", owner.cookie)
      .send({ ...profileBody(domain, skill), ownerId: String(owner.user._id) });
    expect(failed.status).toBe(400);
    expect(await ContributorActivity.countDocuments()).toBe(0);

    const saved = await request(app)
      .patch("/api/contributors/me")
      .set("Cookie", owner.cookie)
      .send(profileBody(domain, skill, { biography: "Profil mis à jour." }));
    expect(saved.status).toBe(200);

    const photo = await request(app)
      .post("/api/contributors/me/photo")
      .set("Cookie", owner.cookie)
      .attach("photo", jpeg(), { filename: "face.jpg", contentType: "image/jpeg" });
    expect(photo.status).toBe(200);

    const events = await ContributorActivity.find({ userId: owner.user._id });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("profile.updated");
    expect(events[0].entityType).toBe("contributor_profile");
    expect(events[0].entityTitleSnapshot).toBe("");
    expect(await UserAuditEvent.countDocuments()).toBe(0);
    expect(await AuditEvent.countDocuments()).toBe(0);
  });

  it("records one event per newly persisted realization and skips retries and failures", async () => {
    const owner = await account("activity-batch");
    const manifest = {
      intent: "publish-ready",
      groups: [
        {
          clientId: "draft-grp-01",
          sequence: 1,
          title: "Banc",
          description: "",
          domainId: null,
          completedOn: null,
          mainMaterial: "",
          photoIds: [],
        },
        {
          clientId: "draft-grp-02",
          sequence: 2,
          title: "   ",
          description: "Ne pas utiliser comme titre",
          photoIds: [],
        },
        {
          clientId: "live-group-03",
          sequence: 3,
          title: "Table basse",
          description: "Chaise",
          photoIds: ["photo-live"],
        },
        {
          clientId: "bad-group-04",
          sequence: 4,
          title: "x".repeat(121),
          description: "",
          photoIds: [],
        },
      ],
    };
    const first = await request(app)
      .post("/api/contributors/me/realizations")
      .set("Cookie", owner.cookie)
      .field("manifest", JSON.stringify(manifest))
      .attach("photos", jpeg(), { filename: "photo-live", contentType: "image/jpeg" });
    expect(first.status).toBe(200);
    expect(await typesFor(owner.user._id)).toEqual([
      "realization.created",
      "realization.created",
      "realization.published",
    ]);
    const untitled = await ContributorActivity.findOne({
      userId: owner.user._id,
      type: "realization.created",
      entityTitleSnapshot: "",
    });
    expect(untitled).not.toBeNull();
    const published = await ContributorActivity.findOne({
      userId: owner.user._id,
      type: "realization.published",
    });
    expect(published.entityTitleSnapshot).toBe("Table basse");

    const retry = await request(app)
      .post("/api/contributors/me/realizations")
      .set("Cookie", owner.cookie)
      .field("manifest", JSON.stringify(manifest))
      .attach("photos", jpeg(), { filename: "photo-live", contentType: "image/jpeg" });
    expect(retry.status).toBe(200);
    expect(await typesFor(owner.user._id)).toEqual([
      "realization.created",
      "realization.created",
      "realization.published",
    ]);
  });

  it("records publish, draft, edit, and delete without duplicates or a deleted document", async () => {
    const owner = await account("activity-life");
    const other = await account("activity-other");
    const domain = await Domain.create({
      slug: "activity-wood",
      nameFR: "Menuiserie",
      nameEN: "Carpentry",
      isActive: true,
    });
    const draft = await Realization.create({
      ownerId: owner.user._id,
      clientGroupId: "group-life-01",
      sequence: 1,
      title: "Table basse",
      description: "Chaise",
      domainId: domain._id,
      completedOn: "2024-05-01",
      mainMaterial: "Noyer",
      status: "draft",
      images: [{ url: "https://cdn.example/chair.jpg", publicId: "photos/chair" }],
    });
    const untitled = await Realization.create({
      ownerId: owner.user._id,
      clientGroupId: "group-life-02",
      sequence: 2,
      title: "",
      description: "Sans titre",
      status: "published",
      images: [{ url: "https://cdn.example/plain.jpg", publicId: "photos/plain" }],
    });

    const notReady = await request(app)
      .post(`/api/contributors/me/realizations/${untitled._id}/publish`)
      .set("Cookie", owner.cookie);
    expect(notReady.status).toBe(409);
    expect(await ContributorActivity.countDocuments()).toBe(0);

    const published = await request(app)
      .post(`/api/contributors/me/realizations/${draft._id}/publish`)
      .set("Cookie", owner.cookie);
    expect(published.status).toBe(200);
    const again = await request(app)
      .post(`/api/contributors/me/realizations/${draft._id}/publish`)
      .set("Cookie", owner.cookie);
    expect(again.status).toBe(409);

    const drafted = await request(app)
      .post(`/api/contributors/me/realizations/${draft._id}/draft`)
      .set("Cookie", owner.cookie);
    expect(drafted.status).toBe(200);
    const draftedAgain = await request(app)
      .post(`/api/contributors/me/realizations/${draft._id}/draft`)
      .set("Cookie", owner.cookie);
    expect(draftedAgain.status).toBe(409);

    const edited = await request(app)
      .patch(`/api/contributors/me/realizations/${draft._id}`)
      .set("Cookie", owner.cookie)
      .send({
        title: "Console murale",
        description: "Acier",
        domainId: String(domain._id),
        completedOn: "2024-06-02",
        mainMaterial: "Acier",
      });
    expect(edited.status).toBe(200);
    const editFailed = await request(app)
      .patch(`/api/contributors/me/realizations/${draft._id}`)
      .set("Cookie", owner.cookie)
      .send({
        title: "x".repeat(121),
        description: "Acier",
        domainId: String(domain._id),
        completedOn: "2024-06-02",
        mainMaterial: "Acier",
      });
    expect(editFailed.status).toBe(400);

    imageStorage.destroyStoredImage.mockRejectedValue(Object.assign(new Error("storage down"), { code: "ESTORAGE" }));
    const cleanup = await request(app)
      .delete(`/api/contributors/me/realizations/${draft._id}`)
      .set("Cookie", owner.cookie);
    expect(cleanup.status).toBe(502);
    expect(await Realization.findById(draft._id)).not.toBeNull();

    imageStorage.destroyStoredImage.mockResolvedValue(undefined);
    const removed = await request(app)
      .delete(`/api/contributors/me/realizations/${draft._id}`)
      .set("Cookie", owner.cookie);
    expect(removed.status).toBe(200);
    expect(await Realization.findById(draft._id)).toBeNull();

    const untitledRemoved = await request(app)
      .delete(`/api/contributors/me/realizations/${untitled._id}`)
      .set("Cookie", owner.cookie);
    expect(untitledRemoved.status).toBe(200);

    expect(await typesFor(owner.user._id)).toEqual([
      "realization.published",
      "realization.moved_to_draft",
      "realization.edited",
      "realization.deleted",
      "realization.deleted",
    ]);
    const deleted = await ContributorActivity.find({ userId: owner.user._id, type: "realization.deleted" }).sort({
      _id: 1,
    });
    expect(deleted.map((item) => item.entityTitleSnapshot)).toEqual(["Console murale", ""]);

    const own = await request(app).get("/api/contributors/me/activity").set("Cookie", owner.cookie);
    expect(own.status).toBe(200);
    expect(own.body.activities.map((item) => item.type)).toEqual([
      "realization.deleted",
      "realization.deleted",
      "realization.edited",
      "realization.moved_to_draft",
      "realization.published",
    ]);
    expect(own.body.activities[0].title).toBeNull();
    expect(own.body.activities[1].title).toBe("Console murale");
    expect(JSON.stringify(own.body)).not.toMatch(/userId|email|description|publicId|ownerId/);

    const foreign = await request(app)
      .get(`/api/contributors/me/activity?ownerId=${owner.user._id}`)
      .set("Cookie", other.cookie);
    expect(foreign.status).toBe(200);
    expect(foreign.body.activities).toEqual([]);
    const anonymous = await request(app).get("/api/contributors/me/activity");
    expect(anonymous.status).toBe(401);
  });

  it("returns the newest five activities for the session owner", async () => {
    const owner = await account("activity-limit");
    const other = await account("activity-limit-b");
    const stamps = [1, 2, 3, 4, 5, 6].map((day) => new Date(Date.UTC(2026, 0, day, 12, 0, 0)));
    await ContributorActivity.create(
      stamps.map((createdAt, index) => ({
        userId: owner.user._id,
        type: "realization.edited",
        entityType: "realization",
        entityTitleSnapshot: `Item ${index + 1}`,
        createdAt,
      }))
    );
    await ContributorActivity.create({
      userId: other.user._id,
      type: "profile.updated",
      entityType: "contributor_profile",
      entityTitleSnapshot: "",
      createdAt: new Date(Date.UTC(2026, 0, 7)),
    });

    const res = await request(app).get("/api/contributors/me/activity").set("Cookie", owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.activities).toHaveLength(5);
    expect(res.body.activities.map((item) => item.title)).toEqual([
      "Item 6",
      "Item 5",
      "Item 4",
      "Item 3",
      "Item 2",
    ]);
    expect(res.body.activities.some((item) => item.type === "profile.updated")).toBe(false);
    expect(new Date(res.body.activities[0].createdAt).toISOString()).toBe(stamps[5].toISOString());
  });
});
