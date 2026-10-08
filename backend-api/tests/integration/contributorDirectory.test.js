const request = require("supertest");
const app = require("../../index");
const User = require("../../models/user");
const Domain = require("../../models/Domain");
const Skill = require("../../models/Skill");
const ContributorProfile = require("../../models/ContributorProfile");
const { ensureContributorTaxonomy } = require("../../services/contributorTaxonomySeed");
const { PROFILE_STATUS } = require("../../services/ContributorProfileService");

async function loadTaxonomy() {
  await ensureContributorTaxonomy();
  const domains = await Domain.find({ isActive: true }).sort({ nameEN: 1 }).limit(2);
  const skillsA = await Skill.find({ domainId: domains[0]._id, isActive: true }).limit(2);
  const skillsB = await Skill.find({ domainId: domains[1]._id, isActive: true }).limit(1);
  return { domainA: domains[0], domainB: domains[1], skillsA, skillsB };
}

async function createUser(username) {
  return User.create({
    username,
    email: `${username}@example.com`,
    password: "hashed-password",
    roles: ["acheteur"],
    emailVerified: true,
  });
}

async function createProfile(user, fields) {
  return ContributorProfile.create({
    userId: user._id,
    biography: "",
    region: "",
    city: "",
    skills: [],
    photoUrl: "",
    photoPublicId: "",
    status: PROFILE_STATUS.ACTIVE,
    isVisible: true,
    ...fields,
  });
}

describe("Public contributor directory", () => {
  it("lists only active visible profiles and omits private fields", async () => {
    const { domainA, skillsA } = await loadTaxonomy();
    const visibleUser = await createUser("visible-dir");
    const hiddenUser = await createUser("hidden-dir");
    const pendingUser = await createUser("pending-dir");
    const inactiveUser = await createUser("inactive-dir");
    const visible = await createProfile(visibleUser, {
      displayName: "Visible Maker",
      biography: "Builds furniture.",
      country: "Cameroun",
      region: "Littoral",
      city: "Douala",
      domainId: domainA._id,
      skills: [{ skillId: skillsA[0]._id, customLabel: "", isCustom: false }],
    });
    await createProfile(hiddenUser, {
      displayName: "Hidden Maker",
      country: "Cameroun",
      domainId: domainA._id,
      isVisible: false,
    });
    await createProfile(pendingUser, {
      displayName: "Pending Maker",
      country: "Cameroun",
      domainId: domainA._id,
      status: PROFILE_STATUS.PENDING_EMAIL_VERIFICATION,
      isVisible: false,
    });
    await createProfile(inactiveUser, {
      displayName: "Inactive Maker",
      country: "Cameroun",
      domainId: domainA._id,
      status: PROFILE_STATUS.INACTIVE,
      isVisible: false,
    });

    const res = await request(app).get("/api/contributors");
    expect(res.statusCode).toBe(200);
    const names = res.body.profiles.map((profile) => profile.displayName);
    expect(names).toContain("Visible Maker");
    expect(names).not.toEqual(expect.arrayContaining([
      "Hidden Maker",
      "Pending Maker",
      "Inactive Maker",
    ]));
    const listed = res.body.profiles.find((profile) => profile.id === String(visible._id));
    expect(listed.country).toBe("Cameroun");
    expect(listed).not.toHaveProperty("email");
    expect(listed).not.toHaveProperty("userId");
    expect(listed).not.toHaveProperty("status");
    expect(listed).not.toHaveProperty("isVisible");
    expect(JSON.stringify(res.body)).not.toContain("hidden-dir@example.com");
  });

  it("matches a keyword on name, biography, domain, or skill and combines filters with ANY skills", async () => {
    const { domainA, domainB, skillsA, skillsB } = await loadTaxonomy();
    const wood = await createUser("wood-dir");
    const metal = await createUser("metal-dir");
    const both = await createUser("both-dir");
    await createProfile(wood, {
      displayName: "Wood Worker",
      biography: "Tables and chairs.",
      country: "Cameroun",
      region: "Littoral",
      city: "Douala",
      domainId: domainA._id,
      skills: [
        { skillId: skillsA[0]._id, customLabel: "", isCustom: false },
        { skillId: null, customLabel: "Réemploi", isCustom: true },
      ],
    });
    await createProfile(metal, {
      displayName: "Metal Worker",
      biography: "Gates.",
      country: "Cameroun",
      region: "Centre",
      city: "Yaoundé",
      domainId: domainB._id,
      skills: [{ skillId: skillsB[0]._id, customLabel: "", isCustom: false }],
    });
    await createProfile(both, {
      displayName: "Mixed Worker",
      biography: "Both trades.",
      country: "Cameroun",
      region: "Littoral",
      city: "Douala",
      domainId: domainA._id,
      skills: [
        { skillId: skillsA[0]._id, customLabel: "", isCustom: false },
        { skillId: skillsB[0]._id, customLabel: "", isCustom: false },
      ],
    });

    const byName = await request(app).get("/api/contributors").query({ q: "wood worker" });
    expect(byName.body.profiles.map((profile) => profile.displayName)).toEqual(["Wood Worker"]);

    const byBio = await request(app).get("/api/contributors").query({ q: "chairs" });
    expect(byBio.body.profiles.map((profile) => profile.displayName)).toEqual(["Wood Worker"]);

    const byCustomSkill = await request(app).get("/api/contributors").query({ q: "réemploi" });
    expect(byCustomSkill.body.profiles.map((profile) => profile.displayName)).toEqual(["Wood Worker"]);

    const byDomain = await request(app).get("/api/contributors").query({ q: domainB.nameEN });
    expect(byDomain.body.profiles.map((profile) => profile.displayName)).toContain("Metal Worker");

    const anySkills = await request(app)
      .get("/api/contributors")
      .query({ skillIds: `${skillsA[0]._id},${skillsB[0]._id}` });
    const anyNames = anySkills.body.profiles.map((profile) => profile.displayName).sort();
    expect(anyNames).toEqual(["Metal Worker", "Mixed Worker", "Wood Worker"]);

    const combined = await request(app).get("/api/contributors").query({
      q: "worker",
      domainId: String(domainA._id),
      skillIds: String(skillsA[0]._id),
      country: "cameroun",
      region: "littoral",
      city: "douala",
    });
    expect(combined.body.profiles.map((profile) => profile.displayName).sort()).toEqual([
      "Mixed Worker",
      "Wood Worker",
    ]);

    const cityOnly = await request(app).get("/api/contributors").query({ city: "Yaoundé" });
    expect(cityOnly.body.profiles.map((profile) => profile.displayName)).toEqual(["Metal Worker"]);
  });

  it("rejects unexpected or unsafe directory parameters", async () => {
    const res = await request(app).get("/api/contributors").query({ email: "secret@example.com" });
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("secret@example.com");

    const invalidSkill = await request(app).get("/api/contributors").query({ skillIds: "not-an-id" });
    expect(invalidSkill.statusCode).toBe(400);
  });

  it("does not expose an ineligible profile by direct URL", async () => {
    const { domainA } = await loadTaxonomy();
    const user = await createUser("direct-hidden");
    const profile = await createProfile(user, {
      displayName: "Secret Profile",
      country: "Cameroun",
      domainId: domainA._id,
      status: PROFILE_STATUS.INACTIVE,
      isVisible: false,
    });
    const res = await request(app).get(`/api/contributors/${profile._id}`);
    expect(res.statusCode).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain("Secret Profile");
    expect(JSON.stringify(res.body)).not.toContain("direct-hidden@example.com");
  });
});
