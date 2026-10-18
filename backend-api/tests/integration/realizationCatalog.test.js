const request = require("supertest");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const app = require("../../index");
const User = require("../../models/user");
const Domain = require("../../models/Domain");
const ContributorProfile = require("../../models/ContributorProfile");
const Realization = require("../../models/Realization");
const { PROFILE_STATUS } = require("../../models/ContributorProfile");
const { REALIZATION_STATUS } = require("../../models/Realization");

const PUBLIC_FIELDS = ["completedOn", "description", "domainId", "id", "images", "sequence"];

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

async function domain(slug, nameFR, nameEN) {
  return Domain.create({ slug, nameFR, nameEN, isActive: true });
}

async function profile(user, domainId, options = {}) {
  return ContributorProfile.create({
    userId: user._id,
    displayName: options.displayName || "Amina",
    country: "Cameroon",
    domainId,
    status: options.status || PROFILE_STATUS.ACTIVE,
    isVisible: options.isVisible !== false,
  });
}

function photos(count, label) {
  return Array.from({ length: count }, (_, index) => ({
    url: `https://cdn.example/${label}-${index + 1}.jpg`,
    publicId: `secret-${label}-${index + 1}`,
  }));
}

async function realization({ owner, domainId, status, description, sequence, completedOn, imageCount, label }) {
  return Realization.create({
    ownerId: owner._id,
    clientGroupId: `group-${label}-${sequence}`,
    sequence,
    description,
    domainId: domainId || null,
    completedOn: completedOn || null,
    status,
    images: photos(imageCount, label),
  });
}

function descriptions(body) {
  return body.realizations.map((item) => item.description);
}

function assertPublicShape(body) {
  expect(Array.isArray(body.realizations)).toBe(true);
  for (const item of body.realizations) {
    expect(Object.keys(item).sort()).toEqual(PUBLIC_FIELDS);
    expect(item.images.length).toBeGreaterThan(0);
    for (const image of item.images) {
      expect(Object.keys(image)).toEqual(["url"]);
      expect(image.url).toEqual(expect.any(String));
    }
  }
  const json = JSON.stringify(body);
  expect(json).not.toMatch(/publicId|clientGroupId|ownerId|secret-|@example\.com|password/);
  expect(json).not.toMatch(/"status"/);
}

describe("published realization catalog", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-auth";
  });

  it("returns an empty list when nothing is published", async () => {
    const res = await request(app).get("/api/realizations");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ realizations: [] });
  });

  it("returns one published realization and keeps every photo on that item", async () => {
    const { user } = await account("catalog-one");
    const wood = await domain("catalog-wood", "Bois", "Wood");
    await profile(user, wood._id);
    await realization({
      owner: user,
      domainId: wood._id,
      status: REALIZATION_STATUS.PUBLISHED,
      description: "Chaise en bois",
      sequence: 1,
      completedOn: "2024-05-01",
      imageCount: 4,
      label: "chair",
    });

    const res = await request(app).get("/api/realizations");
    expect(res.status).toBe(200);
    expect(res.body.realizations).toHaveLength(1);
    expect(res.body.realizations[0].images).toHaveLength(4);
    expect(res.body.realizations[0].description).toBe("Chaise en bois");
    expect(res.body.realizations[0].completedOn).toBe("2024-05-01");
    expect(res.body.realizations[0].domainId).toBe(String(wood._id));
    assertPublicShape(res.body);
  });

  it("returns published realizations from several contributors", async () => {
    const first = await account("catalog-a");
    const second = await account("catalog-b");
    const wood = await domain("catalog-several", "Bois", "Wood");
    await profile(first.user, wood._id, { displayName: "Amina" });
    await profile(second.user, wood._id, { displayName: "Boris" });
    await realization({
      owner: first.user,
      domainId: wood._id,
      status: REALIZATION_STATUS.PUBLISHED,
      description: "Table d'Amina",
      sequence: 1,
      imageCount: 1,
      label: "amina",
    });
    await realization({
      owner: second.user,
      domainId: wood._id,
      status: REALIZATION_STATUS.PUBLISHED,
      description: "Tabouret de Boris",
      sequence: 1,
      imageCount: 2,
      label: "boris",
    });

    const res = await request(app).get("/api/realizations");
    expect(res.status).toBe(200);
    expect(descriptions(res.body).sort()).toEqual(["Table d'Amina", "Tabouret de Boris"]);
    expect(res.body.realizations.find((item) => item.description === "Tabouret de Boris").images).toHaveLength(2);
    assertPublicShape(res.body);
  });

  it("returns published realizations only when drafts exist", async () => {
    const { user, cookie } = await account("catalog-mixed");
    const wood = await domain("catalog-mixed-wood", "Menuiserie", "Carpentry");
    await profile(user, wood._id);
    await realization({
      owner: user,
      domainId: wood._id,
      status: REALIZATION_STATUS.PUBLISHED,
      description: "Banc publié",
      sequence: 1,
      imageCount: 1,
      label: "bench",
    });
    await realization({
      owner: user,
      domainId: wood._id,
      status: REALIZATION_STATUS.DRAFT,
      description: "Brouillon secret",
      sequence: 2,
      imageCount: 1,
      label: "draft",
    });

    const anonymous = await request(app).get("/api/realizations");
    expect(anonymous.status).toBe(200);
    expect(descriptions(anonymous.body)).toEqual(["Banc publié"]);
    assertPublicShape(anonymous.body);

    const signedIn = await request(app).get("/api/realizations").set("Cookie", cookie);
    expect(signedIn.status).toBe(200);
    expect(descriptions(signedIn.body)).toEqual(["Banc publié"]);
    expect(JSON.stringify(signedIn.body)).not.toContain("Brouillon secret");

    const withToken = await request(app)
      .get("/api/realizations")
      .set("Authorization", "Bearer owner-token");
    expect(withToken.status).toBe(200);
    expect(descriptions(withToken.body)).toEqual(["Banc publié"]);

    const ignoredStatus = await request(app).get("/api/realizations?status=draft");
    expect(ignoredStatus.status).toBe(200);
    expect(descriptions(ignoredStatus.body)).toEqual(["Banc publié"]);

    const own = await request(app).get("/api/contributors/me/realizations").set("Cookie", cookie);
    expect(own.status).toBe(200);
    expect(own.body.realizations).toHaveLength(2);
    expect(own.body.realizations.some((item) => item.description === "Brouillon secret")).toBe(true);
  });

  it("returns an empty public list when every realization is a draft", async () => {
    const { user } = await account("catalog-drafts");
    const wood = await domain("catalog-drafts-wood", "Bois", "Wood");
    await profile(user, wood._id);
    await realization({
      owner: user,
      domainId: wood._id,
      status: REALIZATION_STATUS.DRAFT,
      description: "Uniquement privé",
      sequence: 1,
      imageCount: 2,
      label: "only-draft",
    });

    const res = await request(app).get("/api/realizations");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ realizations: [] });
  });

  it("hides published realizations of profiles that are not public", async () => {
    const visible = await account("catalog-visible");
    const inactive = await account("catalog-inactive");
    const hidden = await account("catalog-hidden");
    const wood = await domain("catalog-visibility", "Bois", "Wood");
    await profile(visible.user, wood._id);
    await profile(inactive.user, wood._id, { status: PROFILE_STATUS.INACTIVE, isVisible: false });
    await profile(hidden.user, wood._id, { isVisible: false });
    await realization({
      owner: visible.user,
      domainId: wood._id,
      status: REALIZATION_STATUS.PUBLISHED,
      description: "Visible",
      sequence: 1,
      imageCount: 1,
      label: "visible",
    });
    await realization({
      owner: inactive.user,
      domainId: wood._id,
      status: REALIZATION_STATUS.PUBLISHED,
      description: "Profil inactif",
      sequence: 1,
      imageCount: 1,
      label: "inactive",
    });
    await realization({
      owner: hidden.user,
      domainId: wood._id,
      status: REALIZATION_STATUS.PUBLISHED,
      description: "Profil masqué",
      sequence: 1,
      imageCount: 1,
      label: "hidden",
    });

    const res = await request(app).get("/api/realizations");
    expect(descriptions(res.body)).toEqual(["Visible"]);
    assertPublicShape(res.body);
  });

  it("filters by description and contributor domain without searching a title", async () => {
    const { user } = await account("catalog-search");
    const wood = await domain("catalog-search-wood", "Menuiserie", "Carpentry");
    const clay = await domain("catalog-search-clay", "Poterie", "Pottery");
    await profile(user, wood._id);
    await realization({
      owner: user,
      domainId: wood._id,
      status: REALIZATION_STATUS.PUBLISHED,
      description: "Table basse",
      sequence: 1,
      imageCount: 1,
      label: "table",
    });
    await realization({
      owner: user,
      domainId: clay._id,
      status: REALIZATION_STATUS.PUBLISHED,
      description: "Bol émaillé",
      sequence: 2,
      imageCount: 1,
      label: "bowl",
    });
    await realization({
      owner: user,
      domainId: wood._id,
      status: REALIZATION_STATUS.DRAFT,
      description: "Table secrète",
      sequence: 3,
      imageCount: 1,
      label: "secret-table",
    });

    const byDescription = await request(app).get("/api/realizations").query({ q: "table" });
    expect(descriptions(byDescription.body)).toEqual(["Table basse"]);

    const byDomain = await request(app).get("/api/realizations").query({ q: "pottery" });
    expect(descriptions(byDomain.body)).toEqual(["Bol émaillé"]);

    const byFrenchDomain = await request(app).get("/api/realizations").query({ q: "menuiserie" });
    expect(descriptions(byFrenchDomain.body)).toEqual(["Table basse"]);

    const byCategory = await request(app)
      .get("/api/realizations")
      .query({ domainId: String(clay._id) });
    expect(descriptions(byCategory.body)).toEqual(["Bol émaillé"]);

    const combined = await request(app)
      .get("/api/realizations")
      .query({ q: "bol", domainId: String(wood._id) });
    expect(combined.body.realizations).toEqual([]);

    const literal = await request(app).get("/api/realizations").query({ q: "table (basse)" });
    expect(literal.status).toBe(200);
    expect(literal.body.realizations).toEqual([]);

    const invalid = await request(app).get("/api/realizations").query({ domainId: "draft" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");

    const tooLong = await request(app).get("/api/realizations").query({ q: "a".repeat(201) });
    expect(tooLong.status).toBe(400);
  });

  it("does not require a persisted profile id in the catalog URL", async () => {
    expect(mongoose.isValidObjectId("me")).toBe(false);
    const res = await request(app).get("/api/realizations");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ realizations: [] });
  });
});
