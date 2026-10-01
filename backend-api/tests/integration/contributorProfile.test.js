jest.mock("../../services/imageStorage", () => ({
  uploadProfileImage: jest.fn(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return {
      url: `https://res.cloudinary.com/demo/image/upload/sawaka-contributor-profiles/${suffix}.jpg`,
      publicId: `sawaka-contributor-profiles/${suffix}`,
    };
  }),
  destroyStoredImage: jest.fn(async () => undefined),
}));

const request = require("supertest");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const app = require("../../index");
const User = require("../../models/user");
const Domain = require("../../models/Domain");
const Skill = require("../../models/Skill");
const ContributorProfile = require("../../models/ContributorProfile");
const { ensureContributorTaxonomy } = require("../../services/contributorTaxonomySeed");
const { PROFILE_STATUS } = require("../../services/ContributorProfileService");
const imageStorage = require("../../services/imageStorage");

async function createAccount(overrides = {}) {
  const hash = await bcrypt.hash(overrides.password || "Secret123!", 10);
  return User.create({
    firstName: "Existing",
    lastName: "User",
    username: overrides.username || "existinguser",
    email: overrides.email || "existing@example.com",
    password: hash,
    roles: ["acheteur"],
    isSeller: false,
    emailVerified: overrides.emailVerified === true,
  });
}

async function login(email, password = "Secret123!") {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.headers["set-cookie"];
}

async function loadTaxonomy() {
  await ensureContributorTaxonomy();
  const domains = await Domain.find({ isActive: true }).sort({ nameEN: 1 });
  const domainA = domains[0];
  const domainB = domains[1];
  const skillsA = await Skill.find({ domainId: domainA._id, isActive: true }).limit(2);
  const skillsB = await Skill.find({ domainId: domainB._id, isActive: true }).limit(1);
  return { domainA, domainB, skillsA, skillsB };
}

function profilePayload(domain, skills, overrides = {}) {
  return {
    displayName: "  Amina Nguema  ",
    domainId: String(domain._id),
    skillIds: skills.map((skill) => String(skill._id)),
    country: " Cameroun ",
    region: " Centre ",
    city: " Yaoundé ",
    biography: "  Maçonne et formatrice.  ",
    ...overrides,
  };
}

describe("Contributor profile persistence", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-auth";
  });

  it("creates a user and a pending non-public profile for a new account", async () => {
    const { domainA, skillsA } = await loadTaxonomy();
    const skillCountBefore = await Skill.countDocuments();

    const res = await request(app)
      .post("/api/contributors")
      .send({
        account: {
          username: "aminan",
          email: "amina@example.com",
          password: "Secret123!",
        },
        ...profilePayload(domainA, skillsA, {
          skillIds: [String(skillsA[0]._id)],
          customSkills: ["  Tissage de raphia  "],
        }),
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.accountCreated).toBe(true);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.roles).toEqual(["acheteur"]);
    expect(res.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringMatching(/^token=/)])
    );
    expect(res.body.profile.displayName).toBe("Amina Nguema");
    expect(res.body.profile.country).toBe("Cameroun");
    expect(res.body.profile.city).toBe("Yaoundé");
    expect(res.body.profile.biography).toBe("Maçonne et formatrice.");
    expect(res.body.profile.status).toBe(PROFILE_STATUS.PENDING_EMAIL_VERIFICATION);
    expect(res.body.profile.isVisible).toBe(false);
    expect(res.body.profile.domain.nameFR).toBeTruthy();
    expect(res.body.profile.domain.nameEN).toBeTruthy();
    expect(res.body.profile.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ isCustom: false, nameEN: skillsA[0].nameEN }),
        { customLabel: "Tissage de raphia", isCustom: true },
      ])
    );

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("amina@example.com");
    expect(serialized).not.toContain("Secret123!");

    const user = await User.findOne({ username: "aminan" });
    expect(user).toBeTruthy();
    expect(user.isSeller).toBe(false);
    expect(user.roles).toEqual(["acheteur"]);
    expect(user.emailVerified).toBe(false);
    expect(user.password).not.toBe("Secret123!");

    const profile = await ContributorProfile.findOne({ userId: user._id });
    expect(String(profile._id)).toBe(res.body.profile.id);
    expect(profile.isVisible).toBe(false);
    expect(await Skill.countDocuments()).toBe(skillCountBefore);

    const pub = await request(app).get(`/api/contributors/${profile._id}`);
    expect(pub.statusCode).toBe(404);
    expect(JSON.stringify(pub.body)).not.toContain("amina@example.com");
  });

  it("reuses an authenticated user and does not create another account", async () => {
    const { domainA, skillsA } = await loadTaxonomy();
    const user = await createAccount();
    const cookie = await login(user.email);
    const before = await User.countDocuments();

    const res = await request(app)
      .post("/api/contributors")
      .set("Cookie", cookie)
      .send({
        account: {
          username: "someoneelse",
          email: "other@example.com",
          password: "OtherSecret1!",
        },
        userId: String(new mongoose.Types.ObjectId()),
        ...profilePayload(domainA, [skillsA[0]]),
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.userId).toBe("FIELD_NOT_ALLOWED");
    expect(await User.countDocuments()).toBe(before);

    const created = await request(app)
      .post("/api/contributors")
      .set("Cookie", cookie)
      .send({
        account: {
          username: "someoneelse",
          email: "other@example.com",
          password: "OtherSecret1!",
        },
        ...profilePayload(domainA, [skillsA[0]]),
      });

    expect(created.statusCode).toBe(201);
    expect(created.body.accountCreated).toBe(false);
    expect(created.body.token).toBeUndefined();
    expect(created.body.profile.status).toBe(PROFILE_STATUS.PENDING_EMAIL_VERIFICATION);
    expect(created.body.profile.isVisible).toBe(false);
    expect(await User.countDocuments()).toBe(before);
    expect(await User.findOne({ email: "other@example.com" })).toBeNull();

    const stored = await ContributorProfile.findById(created.body.profile.id);
    expect(String(stored.userId)).toBe(String(user._id));

    const mine = await request(app).get("/api/contributors/me").set("Cookie", cookie);
    expect(mine.statusCode).toBe(200);
    expect(mine.body.profile.id).toBe(created.body.profile.id);
    expect(JSON.stringify(mine.body)).not.toContain(user.email);
  });

  it("activates immediately when the account email is already verified", async () => {
    const { domainA, skillsA } = await loadTaxonomy();
    const user = await createAccount({
      email: "verified@example.com",
      username: "verifieduser",
      emailVerified: true,
    });
    const cookie = await login(user.email);

    const res = await request(app)
      .post("/api/contributors")
      .set("Cookie", cookie)
      .send(profilePayload(domainA, [skillsA[0]]));

    expect(res.statusCode).toBe(201);
    expect(res.body.profile.status).toBe(PROFILE_STATUS.ACTIVE);
    expect(res.body.profile.isVisible).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain(user.email);

    const pub = await request(app).get(`/api/contributors/${res.body.profile.id}`);
    expect(pub.statusCode).toBe(200);
    expect(pub.body.profile.displayName).toBe("Amina Nguema");
    expect(pub.body.profile.status).toBeUndefined();
    expect(pub.body.profile.isVisible).toBeUndefined();
    expect(JSON.stringify(pub.body)).not.toContain(user.email);
  });

  it("rejects a second profile for the same user", async () => {
    const { domainA, skillsA } = await loadTaxonomy();
    const user = await createAccount();
    const cookie = await login(user.email);
    const payload = profilePayload(domainA, [skillsA[0]]);

    const first = await request(app)
      .post("/api/contributors")
      .set("Cookie", cookie)
      .send(payload);
    const second = await request(app)
      .post("/api/contributors")
      .set("Cookie", cookie)
      .send(payload);

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(409);
    expect(second.body.error.code).toBe("CONTRIBUTOR_PROFILE_EXISTS");
    expect(second.body.error.profileId).toBe(first.body.profile.id);
    expect(await ContributorProfile.countDocuments({ userId: user._id })).toBe(1);
  });

  it("does not attach a profile when the email or username already exists", async () => {
    const { domainA, skillsA } = await loadTaxonomy();
    await createAccount({ email: "taken@example.com", username: "takenuser" });
    const payload = {
      ...profilePayload(domainA, [skillsA[0]]),
    };

    const byEmail = await request(app)
      .post("/api/contributors")
      .send({
        account: {
          username: "brandnew",
          email: "taken@example.com",
          password: "Secret123!",
        },
        ...payload,
      });
    const byUsername = await request(app)
      .post("/api/contributors")
      .send({
        account: {
          username: "takenuser",
          email: "fresh@example.com",
          password: "Secret123!",
        },
        ...payload,
      });

    expect(byEmail.statusCode).toBe(400);
    expect(byUsername.statusCode).toBe(400);
    expect(byEmail.body.error.code).toBe("ACCOUNT_ALREADY_EXISTS");
    expect(byUsername.body.error.code).toBe("ACCOUNT_ALREADY_EXISTS");
    expect(byEmail.body.error.code).toBe(byUsername.body.error.code);
    expect(JSON.stringify(byEmail.body)).not.toContain("taken@example.com");
    expect(JSON.stringify(byUsername.body)).not.toContain("takenuser");
    expect(await ContributorProfile.countDocuments()).toBe(0);
    expect(await User.countDocuments()).toBe(1);
  });

  it("rejects invalid, missing and inactive domains and skills", async () => {
    const { domainA, domainB, skillsA } = await loadTaxonomy();
    const inactive = await Domain.create({
      slug: "inactive-domain",
      nameFR: "Inactif",
      nameEN: "Inactive",
      isActive: false,
    });
    const inactiveSkill = await Skill.create({
      slug: "inactive-skill",
      domainId: domainA._id,
      nameFR: "Inactive",
      nameEN: "Inactive skill",
      isActive: false,
    });

    const missingDomain = await request(app)
      .post("/api/contributors")
      .send(
        profilePayload(domainA, skillsA, {
          account: { username: "u1", email: "u1@example.com", password: "Secret123!" },
          domainId: String(new mongoose.Types.ObjectId()),
        })
      );
    const inactiveDomain = await request(app)
      .post("/api/contributors")
      .send({
        account: { username: "u2", email: "u2@example.com", password: "Secret123!" },
        ...profilePayload(domainA, skillsA, { domainId: String(inactive._id) }),
      });
    const badSkill = await request(app)
      .post("/api/contributors")
      .send({
        account: { username: "u4", email: "u4@example.com", password: "Secret123!" },
        ...profilePayload(domainA, [inactiveSkill]),
      });

    expect(missingDomain.body.error.fields.domainId).toBe("DOMAIN_NOT_FOUND");
    expect(inactiveDomain.body.error.fields.domainId).toBe("DOMAIN_INACTIVE");
    expect(badSkill.body.error.fields.skillIds).toBe("SKILL_INVALID");
    expect(await User.countDocuments()).toBe(0);
    expect(domainB).toBeTruthy();
  });

  it("accepts canonical skills from other active domains and keeps one primary domain", async () => {
    const { domainA, domainB, skillsA, skillsB } = await loadTaxonomy();
    const domains = await Domain.find({ isActive: true }).sort({ nameEN: 1 });
    const domainC = domains[2];
    const skillsC = await Skill.find({ domainId: domainC._id, isActive: true }).limit(1);
    const skillCountBefore = await Skill.countDocuments();

    const res = await request(app)
      .post("/api/contributors")
      .send({
        account: {
          username: "crossdomain",
          email: "cross@example.com",
          password: "Secret123!",
        },
        ...profilePayload(domainA, [skillsA[0], skillsB[0], skillsC[0]]),
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.profile.domain.id).toBe(String(domainA._id));
    expect(res.body.profile.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: String(skillsA[0]._id),
          isCustom: false,
          nameEN: skillsA[0].nameEN,
        }),
        expect.objectContaining({
          id: String(skillsB[0]._id),
          isCustom: false,
          nameEN: skillsB[0].nameEN,
        }),
        expect.objectContaining({
          id: String(skillsC[0]._id),
          isCustom: false,
          nameEN: skillsC[0].nameEN,
        }),
      ])
    );
    expect(JSON.stringify(res.body)).not.toContain("confirmEmail");
    expect(JSON.stringify(res.body)).not.toContain("cross@example.com");

    const profile = await ContributorProfile.findById(res.body.profile.id);
    expect(String(profile.domainId)).toBe(String(domainA._id));
    const storedIds = profile.skills
      .filter((skill) => !skill.isCustom)
      .map((skill) => String(skill.skillId));
    expect(storedIds).toEqual([
      String(skillsA[0]._id),
      String(skillsB[0]._id),
      String(skillsC[0]._id),
    ]);
    expect(new Set(storedIds).size).toBe(3);
    expect(String(skillsB[0].domainId)).toBe(String(domainB._id));
    expect(String(skillsB[0].domainId)).not.toBe(String(profile.domainId));
    expect(await Skill.countDocuments()).toBe(skillCountBefore);
  });

  it("rejects unknown, inactive-domain, duplicate skills and confirmEmail", async () => {
    const { domainA, skillsA } = await loadTaxonomy();
    const inactive = await Domain.create({
      slug: "closed-domain",
      nameFR: "Fermé",
      nameEN: "Closed",
      isActive: false,
    });
    const skillOnInactiveDomain = await Skill.create({
      slug: "closed-skill",
      domainId: inactive._id,
      nameFR: "Fermée",
      nameEN: "Closed skill",
      isActive: true,
    });
    const account = {
      username: "skillcheck",
      email: "skillcheck@example.com",
      password: "Secret123!",
    };

    const unknown = await request(app)
      .post("/api/contributors")
      .send({
        account,
        ...profilePayload(domainA, skillsA, {
          skillIds: [String(new mongoose.Types.ObjectId())],
        }),
      });
    const closedDomainSkill = await request(app)
      .post("/api/contributors")
      .send({
        account: { ...account, username: "skillcheck2", email: "skillcheck2@example.com" },
        ...profilePayload(domainA, [skillOnInactiveDomain]),
      });
    const duplicate = await request(app)
      .post("/api/contributors")
      .send({
        account: { ...account, username: "skillcheck3", email: "skillcheck3@example.com" },
        ...profilePayload(domainA, [skillsA[0]], {
          skillIds: [String(skillsA[0]._id), String(skillsA[0]._id)],
        }),
      });
    const confirmEmail = await request(app)
      .post("/api/contributors")
      .send({
        account: {
          ...account,
          username: "skillcheck4",
          email: "skillcheck4@example.com",
          confirmEmail: "skillcheck4@example.com",
        },
        ...profilePayload(domainA, [skillsA[0]]),
      });

    expect(unknown.body.error.fields.skillIds).toBe("SKILL_INVALID");
    expect(closedDomainSkill.body.error.fields.skillIds).toBe("SKILL_INVALID");
    expect(duplicate.body.error.fields.skillIds).toBe("SKILL_DUPLICATE");
    expect(confirmEmail.body.error.fields["account.confirmEmail"]).toBe("FIELD_NOT_ALLOWED");
    expect(await User.countDocuments()).toBe(0);
    expect(await ContributorProfile.countDocuments()).toBe(0);
  });

  it("rejects markup, missing fields and system-managed fields before creating an account", async () => {
    const { domainA, skillsA } = await loadTaxonomy();
    const account = { username: "safeuser", email: "safe@example.com", password: "Secret123!" };

    const missing = await request(app)
      .post("/api/contributors")
      .send({ account, displayName: "Ok", skillIds: [], customSkills: [] });
    const markup = await request(app)
      .post("/api/contributors")
      .send({
        account,
        ...profilePayload(domainA, [skillsA[0]], {
          biography: "Hello <script>alert(1)</script>",
        }),
      });
    const statusOverride = await request(app)
      .post("/api/contributors")
      .send({
        account,
        status: "Active",
        isVisible: true,
        ...profilePayload(domainA, [skillsA[0]]),
      });

    expect(missing.statusCode).toBe(400);
    expect(missing.body.error.fields.country).toBe("COUNTRY_REQUIRED");
    expect(missing.body.error.fields.domainId).toBe("DOMAIN_REQUIRED");
    expect(missing.body.error.fields.skillIds).toBe("SKILL_REQUIRED");
    expect(markup.body.error.fields.biography).toBe("BIOGRAPHY_MARKUP");
    expect(statusOverride.body.error.fields.status).toBe("FIELD_NOT_ALLOWED");
    expect(statusOverride.body.error.fields.isVisible).toBe("FIELD_NOT_ALLOWED");
    expect(await User.countDocuments()).toBe(0);
    expect(await ContributorProfile.countDocuments()).toBe(0);
  });

  it("deletes the account created in the request when profile persistence fails", async () => {
    const { domainA, skillsA } = await loadTaxonomy();
    const spy = jest
      .spyOn(ContributorProfile, "create")
      .mockRejectedValueOnce(new Error("persistence failed"));

    let res;
    try {
      res = await request(app)
        .post("/api/contributors")
        .send({
          account: {
            username: "orphancheck",
            email: "orphan@example.com",
            password: "Secret123!",
          },
          ...profilePayload(domainA, [skillsA[0]]),
        });
    } finally {
      spy.mockRestore();
    }

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: { code: "SERVER_ERROR" } });
    expect(JSON.stringify(res.body)).not.toContain("persistence failed");
    expect(await User.findOne({ email: "orphan@example.com" })).toBeNull();
    expect(await ContributorProfile.countDocuments()).toBe(0);
  });

  it("lists active domains and only the skills of the selected domain", async () => {
    const { domainA, domainB, skillsA } = await loadTaxonomy();
    await Domain.create({
      slug: "hidden-domain",
      nameFR: "Caché",
      nameEN: "Hidden",
      isActive: false,
    });

    const domains = await request(app).get("/api/contributors/domains");
    expect(domains.statusCode).toBe(200);
    expect(domains.body.domains.some((domain) => domain.nameEN === "Hidden")).toBe(false);
    const listedA = domains.body.domains.find((domain) => domain.id === String(domainA._id));
    expect(listedA.nameFR).toBe(domainA.nameFR);
    expect(listedA.nameEN).toBe(domainA.nameEN);

    const skills = await request(app).get(
      `/api/contributors/domains/${domainA._id}/skills`
    );
    const other = await request(app).get(
      `/api/contributors/domains/${domainB._id}/skills`
    );
    expect(skills.statusCode).toBe(200);
    expect(skills.body.skills.map((skill) => skill.id)).toEqual(
      expect.arrayContaining([String(skillsA[0]._id)])
    );
    expect(skills.body.skills.map((skill) => skill.id).sort()).not.toEqual(
      other.body.skills.map((skill) => skill.id).sort()
    );
    expect(skills.body.skills.every((skill) => skill.nameFR && skill.nameEN)).toBe(true);
  });

  it("updates the authenticated owner's profile in place", async () => {
    const { domainA, domainB, skillsA, skillsB } = await loadTaxonomy();
    const user = await createAccount({
      email: "owner-edit@example.com",
      username: "owneredit",
      emailVerified: true,
    });
    const cookie = await login(user.email);
    const created = await request(app)
      .post("/api/contributors")
      .set("Cookie", cookie)
      .send(profilePayload(domainA, [skillsA[0]], { customSkills: ["Raphia"] }));

    expect(created.statusCode).toBe(201);
    const profileId = created.body.profile.id;
    const before = await ContributorProfile.findById(profileId);
    const countBefore = await ContributorProfile.countDocuments();

    const updated = await request(app)
      .patch("/api/contributors/me")
      .set("Cookie", cookie)
      .send({
        displayName: "Amina Updated",
        domainId: String(domainB._id),
        skillIds: [String(skillsA[0]._id), String(skillsB[0]._id)],
        customSkills: ["Raphia", "Chaux"],
        country: "Cameroun",
        region: "Littoral",
        city: "Douala",
        biography: "Profil mis à jour.",
      });

    expect(updated.statusCode).toBe(200);
    expect(updated.body.profile.id).toBe(profileId);
    expect(updated.body.profile.displayName).toBe("Amina Updated");
    expect(updated.body.profile.city).toBe("Douala");
    expect(updated.body.profile.biography).toBe("Profil mis à jour.");
    expect(updated.body.profile.domain.id).toBe(String(domainB._id));
    expect(updated.body.profile.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: String(skillsA[0]._id), isCustom: false }),
        expect.objectContaining({ id: String(skillsB[0]._id), isCustom: false }),
        { customLabel: "Raphia", isCustom: true },
        { customLabel: "Chaux", isCustom: true },
      ])
    );
    expect(updated.body.profile.status).toBe(PROFILE_STATUS.ACTIVE);
    expect(updated.body.profile.isVisible).toBe(true);
    expect(JSON.stringify(updated.body)).not.toContain(user.email);
    expect(JSON.stringify(updated.body)).not.toContain("password");

    const stored = await ContributorProfile.findById(profileId);
    expect(String(stored._id)).toBe(profileId);
    expect(String(stored.userId)).toBe(String(user._id));
    expect(stored.displayName).toBe("Amina Updated");
    expect(stored.status).toBe(before.status);
    expect(stored.isVisible).toBe(before.isVisible);
    expect(stored.createdAt.getTime()).toBe(before.createdAt.getTime());
    expect(await ContributorProfile.countDocuments()).toBe(countBefore);

    const pub = await request(app).get(`/api/contributors/${profileId}`);
    expect(pub.statusCode).toBe(200);
    expect(pub.body.profile.displayName).toBe("Amina Updated");
    expect(pub.body.profile.status).toBeUndefined();
    expect(pub.body.profile.isVisible).toBeUndefined();
  });

  it("rejects an unauthenticated profile update", async () => {
    const res = await request(app).patch("/api/contributors/me").send({
      displayName: "Nobody",
      domainId: "64b000000000000000000001",
      skillIds: ["64b000000000000000000002"],
      country: "Cameroun",
    });
    expect(res.statusCode).toBe(401);
    expect(await ContributorProfile.countDocuments()).toBe(0);
  });

  it("rejects system fields and does not create a second profile", async () => {
    const { domainA, skillsA } = await loadTaxonomy();
    const user = await createAccount({
      email: "guard-edit@example.com",
      username: "guardedit",
    });
    const cookie = await login(user.email);
    const created = await request(app)
      .post("/api/contributors")
      .set("Cookie", cookie)
      .send(profilePayload(domainA, [skillsA[0]]));
    const profileId = created.body.profile.id;

    const rejected = await request(app)
      .patch("/api/contributors/me")
      .set("Cookie", cookie)
      .send({
        ...profilePayload(domainA, [skillsA[0]]),
        status: "Active",
        isVisible: true,
        userId: String(new mongoose.Types.ObjectId()),
        account: { email: "stolen@example.com", password: "Secret123!", username: "stolen" },
      });

    expect(rejected.statusCode).toBe(400);
    expect(rejected.body.error.fields.status).toBe("FIELD_NOT_ALLOWED");
    expect(rejected.body.error.fields.isVisible).toBe("FIELD_NOT_ALLOWED");
    expect(rejected.body.error.fields.userId).toBe("FIELD_NOT_ALLOWED");
    expect(rejected.body.error.fields.account).toBe("FIELD_NOT_ALLOWED");

    const stored = await ContributorProfile.findById(profileId);
    expect(stored.displayName).toBe("Amina Nguema");
    expect(stored.status).toBe(PROFILE_STATUS.PENDING_EMAIL_VERIFICATION);
    expect(stored.isVisible).toBe(false);
    expect(String(stored.userId)).toBe(String(user._id));
    expect(await ContributorProfile.countDocuments({ userId: user._id })).toBe(1);
    expect(await User.findOne({ email: "stolen@example.com" })).toBeNull();

    const kept = await request(app)
      .patch("/api/contributors/me")
      .set("Cookie", cookie)
      .send(profilePayload(domainA, [skillsA[0]], { displayName: "Amina Kept" }));
    expect(kept.statusCode).toBe(200);
    expect(kept.body.profile.id).toBe(profileId);
    expect(kept.body.profile.status).toBe(PROFILE_STATUS.PENDING_EMAIL_VERIFICATION);
    expect(kept.body.profile.isVisible).toBe(false);
    expect(await ContributorProfile.countDocuments({ userId: user._id })).toBe(1);
  });

  it("rejects invalid taxonomy on update and keeps the existing document", async () => {
    const { domainA, skillsA } = await loadTaxonomy();
    const user = await createAccount({
      email: "taxonomy-edit@example.com",
      username: "taxonomyedit",
    });
    const cookie = await login(user.email);
    const created = await request(app)
      .post("/api/contributors")
      .set("Cookie", cookie)
      .send(profilePayload(domainA, [skillsA[0]]));
    const profileId = created.body.profile.id;
    const base = profilePayload(domainA, [skillsA[0]]);

    const badDomain = await request(app)
      .patch("/api/contributors/me")
      .set("Cookie", cookie)
      .send({ ...base, domainId: String(new mongoose.Types.ObjectId()) });
    const badSkill = await request(app)
      .patch("/api/contributors/me")
      .set("Cookie", cookie)
      .send({ ...base, skillIds: [String(new mongoose.Types.ObjectId())] });
    const duplicate = await request(app)
      .patch("/api/contributors/me")
      .set("Cookie", cookie)
      .send({
        ...base,
        skillIds: [String(skillsA[0]._id), String(skillsA[0]._id)],
      });
    const duplicateCustom = await request(app)
      .patch("/api/contributors/me")
      .set("Cookie", cookie)
      .send({ ...base, customSkills: ["Chaux", "chaux"] });

    expect(badDomain.statusCode).toBe(400);
    expect(badDomain.body.error.fields.domainId).toBe("DOMAIN_NOT_FOUND");
    expect(badSkill.body.error.fields.skillIds).toBe("SKILL_INVALID");
    expect(duplicate.body.error.fields.skillIds).toBe("SKILL_DUPLICATE");
    expect(duplicateCustom.body.error.fields.customSkills).toBe("CUSTOM_SKILL_DUPLICATE");

    const stored = await ContributorProfile.findById(profileId);
    expect(stored.displayName).toBe("Amina Nguema");
    expect(String(stored.domainId)).toBe(String(domainA._id));
    expect(await ContributorProfile.countDocuments({ userId: user._id })).toBe(1);
  });

  it("does not let another authenticated user update a profile they do not own", async () => {
    const { domainA, skillsA } = await loadTaxonomy();
    const owner = await createAccount({
      email: "owner-a@example.com",
      username: "ownera",
    });
    const other = await createAccount({
      email: "owner-b@example.com",
      username: "ownerb",
    });
    const ownerCookie = await login(owner.email);
    const otherCookie = await login(other.email);
    const created = await request(app)
      .post("/api/contributors")
      .set("Cookie", ownerCookie)
      .send(profilePayload(domainA, [skillsA[0]]));

    const foreign = await request(app)
      .patch("/api/contributors/me")
      .set("Cookie", otherCookie)
      .send(profilePayload(domainA, [skillsA[0]], { displayName: "Hijack" }));

    expect(foreign.statusCode).toBe(404);
    const stored = await ContributorProfile.findById(created.body.profile.id);
    expect(stored.displayName).toBe("Amina Nguema");
    expect(String(stored.userId)).toBe(String(owner._id));
  });
});

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

function jpegHeader() {
  const buffer = Buffer.alloc(32, 0);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  return buffer;
}

describe("Contributor profile photo", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-auth";
  });

  async function ownerWithProfile(email) {
    const { domainA, skillsA } = await loadTaxonomy();
    const user = await createAccount({
      email,
      username: email.split("@")[0].replace(/[^a-z]/g, ""),
    });
    const cookie = await login(user.email);
    const created = await request(app)
      .post("/api/contributors")
      .set("Cookie", cookie)
      .send(profilePayload(domainA, [skillsA[0]]));
    return { user, cookie, profileId: created.body.profile.id, domainA, skillsA };
  }

  it("stores a photo on the existing profile and returns only the public URL", async () => {
    const { user, cookie, profileId } = await ownerWithProfile("photo-ok@example.com");
    const before = await ContributorProfile.findById(profileId);
    const countBefore = await ContributorProfile.countDocuments();

    const res = await request(app)
      .post("/api/contributors/me/photo")
      .set("Cookie", cookie)
      .attach("photo", PNG_1X1, { filename: "avatar.png", contentType: "image/png" });

    expect(res.statusCode).toBe(200);
    expect(res.body.profile.id).toBe(profileId);
    expect(res.body.profile.photoUrl).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    expect(res.body.profile.displayName).toBe("Amina Nguema");
    expect(res.body.profile.status).toBe(before.status);
    expect(res.body.profile.isVisible).toBe(before.isVisible);
    expect(JSON.stringify(res.body)).not.toContain("photoPublicId");
    expect(JSON.stringify(res.body)).not.toContain(user.email);

    const stored = await ContributorProfile.findById(profileId);
    expect(String(stored.userId)).toBe(String(user._id));
    expect(stored.photoUrl).toBe(res.body.profile.photoUrl);
    expect(stored.photoPublicId).toBeTruthy();
    expect(stored.status).toBe(before.status);
    expect(stored.isVisible).toBe(before.isVisible);
    expect(await ContributorProfile.countDocuments()).toBe(countBefore);
    expect(imageStorage.uploadProfileImage).toHaveBeenCalled();
  });

  it("rejects an unauthenticated photo upload", async () => {
    const res = await request(app)
      .post("/api/contributors/me/photo")
      .attach("photo", PNG_1X1, { filename: "avatar.png", contentType: "image/png" });
    expect(res.statusCode).toBe(401);
    expect(await ContributorProfile.countDocuments()).toBe(0);
  });

  it("does not let another user change the owner's photo", async () => {
    const { cookie, profileId } = await ownerWithProfile("photo-owner@example.com");
    const uploaded = await request(app)
      .post("/api/contributors/me/photo")
      .set("Cookie", cookie)
      .attach("photo", PNG_1X1, { filename: "avatar.png", contentType: "image/png" });
    const other = await createAccount({
      email: "photo-other@example.com",
      username: "photoother",
    });
    const otherCookie = await login(other.email);

    const foreign = await request(app)
      .post("/api/contributors/me/photo")
      .set("Cookie", otherCookie)
      .attach("photo", PNG_1X1, { filename: "other.png", contentType: "image/png" });

    expect(foreign.statusCode).toBe(404);
    const stored = await ContributorProfile.findById(profileId);
    expect(stored.photoUrl).toBe(uploaded.body.profile.photoUrl);
    expect(await ContributorProfile.countDocuments({ userId: stored.userId })).toBe(1);
  });

  it("rejects an unsupported type, a spoofed image and an oversized file", async () => {
    const { cookie, profileId } = await ownerWithProfile("photo-bad@example.com");

    const text = await request(app)
      .post("/api/contributors/me/photo")
      .set("Cookie", cookie)
      .attach("photo", Buffer.from("hello"), {
        filename: "notes.txt",
        contentType: "text/plain",
      });
    const spoofed = await request(app)
      .post("/api/contributors/me/photo")
      .set("Cookie", cookie)
      .attach("photo", Buffer.from("not-a-png-file!!"), {
        filename: "avatar.png",
        contentType: "image/png",
      });
    const missing = await request(app)
      .post("/api/contributors/me/photo")
      .set("Cookie", cookie);
    const oversized = Buffer.alloc(2 * 1024 * 1024 + 1, 0);
    oversized[0] = 0xff;
    oversized[1] = 0xd8;
    oversized[2] = 0xff;
    const tooBig = await request(app)
      .post("/api/contributors/me/photo")
      .set("Cookie", cookie)
      .attach("photo", oversized, { filename: "big.jpg", contentType: "image/jpeg" });

    expect(text.statusCode).toBe(400);
    expect(text.body.error.fields.photo).toBe("UNSUPPORTED_IMAGE_TYPE");
    expect(spoofed.statusCode).toBe(400);
    expect(spoofed.body.error.fields.photo).toBe("UNSUPPORTED_IMAGE_TYPE");
    expect(missing.statusCode).toBe(400);
    expect(missing.body.error.fields.photo).toBe("PHOTO_REQUIRED");
    expect(tooBig.statusCode).toBe(400);
    expect(tooBig.body.error.fields.photo).toBe("IMAGE_TOO_LARGE");
    expect(JSON.stringify(tooBig.body)).not.toMatch(/cloudinary|ENOENT|stack/i);

    const stored = await ContributorProfile.findById(profileId);
    expect(stored.photoUrl).toBe("");
    expect(stored.photoPublicId).toBe("");
  });

  it("does not accept a client-supplied photo URL on profile update", async () => {
    const { cookie, profileId, domainA, skillsA } = await ownerWithProfile(
      "photo-url@example.com"
    );
    const rejected = await request(app)
      .patch("/api/contributors/me")
      .set("Cookie", cookie)
      .send({
        ...profilePayload(domainA, [skillsA[0]]),
        photoUrl: "https://evil.example/photo.jpg",
        photoPublicId: "should-not-stick",
      });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.body.error.fields.photoUrl).toBe("FIELD_NOT_ALLOWED");
    expect(rejected.body.error.fields.photoPublicId).toBe("FIELD_NOT_ALLOWED");
    const stored = await ContributorProfile.findById(profileId);
    expect(stored.photoUrl).toBe("");
  });

  it("replaces the photo and deletes the previous asset only after the new one is saved", async () => {
    const { cookie, profileId } = await ownerWithProfile("photo-replace@example.com");
    const before = await ContributorProfile.findById(profileId);

    const first = await request(app)
      .post("/api/contributors/me/photo")
      .set("Cookie", cookie)
      .attach("photo", PNG_1X1, { filename: "a.png", contentType: "image/png" });
    const firstId = (await ContributorProfile.findById(profileId)).photoPublicId;
    imageStorage.destroyStoredImage.mockClear();

    const second = await request(app)
      .post("/api/contributors/me/photo")
      .set("Cookie", cookie)
      .attach("photo", jpegHeader(), { filename: "b.jpg", contentType: "image/jpeg" });

    expect(second.statusCode).toBe(200);
    expect(second.body.profile.id).toBe(profileId);
    expect(second.body.profile.photoUrl).not.toBe(first.body.profile.photoUrl);
    expect(second.body.profile.status).toBe(before.status);
    expect(second.body.profile.isVisible).toBe(before.isVisible);
    const stored = await ContributorProfile.findById(profileId);
    expect(stored.photoPublicId).not.toBe(firstId);
    expect(imageStorage.destroyStoredImage).toHaveBeenCalledWith(firstId);
    expect(await ContributorProfile.countDocuments({ userId: stored.userId })).toBe(1);
  });

  it("removes the photo and keeps the same profile", async () => {
    const { cookie, profileId } = await ownerWithProfile("photo-remove@example.com");
    await request(app)
      .post("/api/contributors/me/photo")
      .set("Cookie", cookie)
      .attach("photo", PNG_1X1, { filename: "a.png", contentType: "image/png" });
    const publicId = (await ContributorProfile.findById(profileId)).photoPublicId;
    const before = await ContributorProfile.findById(profileId);

    const removed = await request(app)
      .delete("/api/contributors/me/photo")
      .set("Cookie", cookie);

    expect(removed.statusCode).toBe(200);
    expect(removed.body.profile.id).toBe(profileId);
    expect(removed.body.profile.photoUrl).toBeNull();
    expect(removed.body.profile.displayName).toBe("Amina Nguema");
    expect(removed.body.profile.status).toBe(before.status);
    expect(JSON.stringify(removed.body)).not.toContain(publicId);
    const stored = await ContributorProfile.findById(profileId);
    expect(stored.photoUrl).toBe("");
    expect(stored.photoPublicId).toBe("");
    expect(stored.status).toBe(before.status);
    expect(stored.isVisible).toBe(before.isVisible);
    expect(imageStorage.destroyStoredImage).toHaveBeenCalledWith(publicId);
  });

  it("deletes the new asset and keeps the previous photo when saving the profile fails", async () => {
    const { cookie, profileId } = await ownerWithProfile("photo-rollback@example.com");
    await request(app)
      .post("/api/contributors/me/photo")
      .set("Cookie", cookie)
      .attach("photo", PNG_1X1, { filename: "a.png", contentType: "image/png" });
    const previous = await ContributorProfile.findById(profileId);
    imageStorage.destroyStoredImage.mockClear();
    imageStorage.uploadProfileImage.mockResolvedValueOnce({
      url: "https://res.cloudinary.com/demo/image/upload/sawaka-contributor-profiles/new.jpg",
      publicId: "sawaka-contributor-profiles/new",
    });

    const originalSave = ContributorProfile.prototype.save;
    ContributorProfile.prototype.save = function failOnce() {
      ContributorProfile.prototype.save = originalSave;
      return Promise.reject(new Error("db down secret"));
    };

    try {
      const failed = await request(app)
        .post("/api/contributors/me/photo")
        .set("Cookie", cookie)
        .attach("photo", jpegHeader(), { filename: "b.jpg", contentType: "image/jpeg" });
      expect(failed.statusCode).toBe(500);
      expect(failed.body.error.code).toBe("SERVER_ERROR");
      expect(JSON.stringify(failed.body)).not.toContain("db down");
      expect(JSON.stringify(failed.body)).not.toContain("secret");
    } finally {
      ContributorProfile.prototype.save = originalSave;
    }

    const stored = await ContributorProfile.findById(profileId);
    expect(stored.photoUrl).toBe(previous.photoUrl);
    expect(stored.photoPublicId).toBe(previous.photoPublicId);
    expect(imageStorage.destroyStoredImage).toHaveBeenCalledWith(
      "sawaka-contributor-profiles/new"
    );
    expect(imageStorage.destroyStoredImage).not.toHaveBeenCalledWith(previous.photoPublicId);
  });

  it("returns a storage error without internal details when the upload fails", async () => {
    const { cookie, profileId } = await ownerWithProfile("photo-storage@example.com");
    imageStorage.uploadProfileImage.mockRejectedValueOnce(
      new Error("cloudinary api_secret leaked")
    );
    const res = await request(app)
      .post("/api/contributors/me/photo")
      .set("Cookie", cookie)
      .attach("photo", PNG_1X1, { filename: "a.png", contentType: "image/png" });
    expect(res.statusCode).toBe(502);
    expect(res.body.error.code).toBe("UPLOAD_FAILED");
    expect(JSON.stringify(res.body)).not.toContain("api_secret");
    const stored = await ContributorProfile.findById(profileId);
    expect(stored.photoUrl).toBe("");
  });
});
