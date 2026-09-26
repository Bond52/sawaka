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

  it("rejects invalid domains and skills that are inactive or outside the domain", async () => {
    const { domainA, domainB, skillsA, skillsB } = await loadTaxonomy();
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
    const wrongSkill = await request(app)
      .post("/api/contributors")
      .send({
        account: { username: "u3", email: "u3@example.com", password: "Secret123!" },
        ...profilePayload(domainA, skillsB),
      });
    const badSkill = await request(app)
      .post("/api/contributors")
      .send({
        account: { username: "u4", email: "u4@example.com", password: "Secret123!" },
        ...profilePayload(domainA, [inactiveSkill]),
      });

    expect(missingDomain.body.error.fields.domainId).toBe("DOMAIN_NOT_FOUND");
    expect(inactiveDomain.body.error.fields.domainId).toBe("DOMAIN_INACTIVE");
    expect(wrongSkill.body.error.fields.skillIds).toBe("SKILL_DOMAIN_MISMATCH");
    expect(badSkill.body.error.fields.skillIds).toBe("SKILL_INVALID");
    expect(await User.countDocuments()).toBe(0);
    expect(domainB).toBeTruthy();
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
});
