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
const { UserAuditEvent, USER_AUDIT_ACTIONS } = require("../../services/AuditService");
const { ensureContributorTaxonomy } = require("../../services/contributorTaxonomySeed");
const { PROFILE_STATUS } = require("../../services/ContributorProfileService");
const contributorRoutes = require("../../routes/contributor.routes");

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function loadTaxonomy() {
  await ensureContributorTaxonomy();
  const domain = await Domain.findOne({ isActive: true }).sort({ nameEN: 1 });
  const skill = await Skill.findOne({ domainId: domain._id, isActive: true });
  return { domain, skill };
}

async function createUser({ username, email, roles = ["acheteur"], emailVerified = true }) {
  const password = await bcrypt.hash("Secret123!", 10);
  return User.create({
    username,
    email,
    password,
    roles,
    emailVerified,
  });
}

async function login(email) {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "Secret123!" });
  return res.headers["set-cookie"];
}

async function createProfile(user, status, isVisible) {
  const { domain, skill } = await loadTaxonomy();
  return ContributorProfile.create({
    userId: user._id,
    displayName: "Amina Nguema",
    biography: "Maçonne.",
    country: "Cameroun",
    city: "Yaoundé",
    domainId: domain._id,
    skills: [{ skillId: skill._id, customLabel: "", isCustom: false }],
    status,
    isVisible,
    photoUrl: "",
    photoPublicId: "",
  });
}

function patchBody(profile) {
  return {
    displayName: "Amina Nguema",
    domainId: String(profile.domainId),
    skillIds: profile.skills.filter((skill) => skill.skillId).map((skill) => String(skill.skillId)),
    country: "Cameroun",
    city: "Douala",
    biography: "Formatrice.",
  };
}

describe("Contributor profile deactivation", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-auth";
    contributorRoutes.deactivateRateLimit.reset();
  });

  it("deactivates the authenticated owner's active profile without deleting it", async () => {
    const user = await createUser({
      username: "ownerdeactivate",
      email: "owner.deactivate@example.com",
    });
    const profile = await createProfile(user, PROFILE_STATUS.ACTIVE, true);
    const cookie = await login(user.email);
    const userBefore = await User.findById(user._id);
    const profileCount = await ContributorProfile.countDocuments();
    const userCount = await User.countDocuments();

    const res = await request(app)
      .post("/api/contributors/me/deactivate")
      .set("Cookie", cookie)
      .send({});

    expect(res.statusCode).toBe(200);
    expect(res.body.profile.id).toBe(String(profile._id));
    expect(res.body.profile.status).toBe(PROFILE_STATUS.INACTIVE);
    expect(res.body.profile.isVisible).toBe(false);
    expect(res.body.profile.displayName).toBe("Amina Nguema");
    expect(JSON.stringify(res.body)).not.toContain("owner.deactivate@example.com");
    expect(JSON.stringify(res.body)).not.toContain("photoPublicId");

    const stored = await ContributorProfile.findById(profile._id);
    expect(stored.status).toBe(PROFILE_STATUS.INACTIVE);
    expect(stored.isVisible).toBe(false);
    expect(stored.skills).toHaveLength(1);
    expect(await ContributorProfile.countDocuments()).toBe(profileCount);
    expect(await User.countDocuments()).toBe(userCount);

    const userAfter = await User.findById(user._id);
    expect(userAfter.email).toBe(userBefore.email);
    expect(userAfter.emailVerified).toBe(true);
    expect(userAfter.roles).toEqual(userBefore.roles);
    expect(userAfter.password).toBe(userBefore.password);

    const relogin = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "Secret123!" });
    expect(relogin.statusCode).toBe(200);

    const pub = await request(app).get(`/api/contributors/${profile._id}`);
    expect(pub.statusCode).toBe(404);
    expect(pub.body.error.code).toBe("CONTRIBUTOR_PROFILE_NOT_FOUND");
    expect(JSON.stringify(pub.body)).not.toContain("Amina Nguema");

    const audit = await UserAuditEvent.find({
      userId: user._id,
      action: USER_AUDIT_ACTIONS.CONTRIBUTOR_PROFILE_DEACTIVATED,
    });
    expect(audit).toHaveLength(1);
    expect(String(audit[0].userId)).toBe(String(user._id));
    expect(audit[0].createdAt).toBeInstanceOf(Date);
    expect(audit[0].metadata).toEqual({
      contributorProfileId: String(profile._id),
      status: PROFILE_STATUS.INACTIVE,
      isVisible: false,
    });
    expect(JSON.stringify(audit[0].metadata)).not.toContain("owner.deactivate@example.com");
    expect(JSON.stringify(audit[0].metadata)).not.toMatch(/token|password|secret/i);
  });

  it("rejects an unauthenticated deactivation without changing state", async () => {
    const user = await createUser({
      username: "anondeactivate",
      email: "anon.deactivate@example.com",
    });
    const profile = await createProfile(user, PROFILE_STATUS.ACTIVE, true);

    const res = await request(app).post("/api/contributors/me/deactivate").send({});

    expect(res.statusCode).toBe(401);
    const stored = await ContributorProfile.findById(profile._id);
    expect(stored.status).toBe(PROFILE_STATUS.ACTIVE);
    expect(stored.isVisible).toBe(true);
    expect(
      await UserAuditEvent.countDocuments({
        action: USER_AUDIT_ACTIONS.CONTRIBUTOR_PROFILE_DEACTIVATED,
      })
    ).toBe(0);
  });

  it("does not let another user or a client id select the owner's profile", async () => {
    const owner = await createUser({
      username: "targetowner",
      email: "target.owner@example.com",
    });
    const other = await createUser({
      username: "othertarget",
      email: "other.target@example.com",
    });
    const profile = await createProfile(owner, PROFILE_STATUS.ACTIVE, true);
    const otherProfile = await createProfile(other, PROFILE_STATUS.ACTIVE, true);
    const cookie = await login(other.email);

    const manipulated = await request(app)
      .post("/api/contributors/me/deactivate")
      .set("Cookie", cookie)
      .send({
        userId: String(owner._id),
        contributorProfileId: String(profile._id),
        profileId: String(profile._id),
      });

    expect(manipulated.statusCode).toBe(400);
    expect(manipulated.body.error.code).toBe("VALIDATION_ERROR");
    expect(manipulated.body.error.fields.userId).toBe("FIELD_NOT_ALLOWED");
    expect(manipulated.body.error.fields.contributorProfileId).toBe("FIELD_NOT_ALLOWED");
    expect(manipulated.body.error.fields.profileId).toBe("FIELD_NOT_ALLOWED");

    const stored = await ContributorProfile.findById(profile._id);
    const otherStored = await ContributorProfile.findById(otherProfile._id);
    expect(stored.status).toBe(PROFILE_STATUS.ACTIVE);
    expect(otherStored.status).toBe(PROFILE_STATUS.ACTIVE);
  });

  it("does not let an admin role deactivate another contributor profile", async () => {
    const owner = await createUser({
      username: "adminvictim",
      email: "admin.victim@example.com",
    });
    const admin = await createUser({
      username: "adminactor",
      email: "admin.actor@example.com",
      roles: ["admin"],
    });
    const profile = await createProfile(owner, PROFILE_STATUS.ACTIVE, true);
    const adminProfile = await createProfile(admin, PROFILE_STATUS.ACTIVE, true);
    const cookie = await login(admin.email);

    const res = await request(app)
      .post("/api/contributors/me/deactivate")
      .set("Cookie", cookie)
      .send({
        userId: String(owner._id),
        contributorProfileId: String(profile._id),
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.error.fields.contributorProfileId).toBe("FIELD_NOT_ALLOWED");
    expect((await ContributorProfile.findById(profile._id)).status).toBe(PROFILE_STATUS.ACTIVE);
    expect((await ContributorProfile.findById(adminProfile._id)).status).toBe(PROFILE_STATUS.ACTIVE);
    expect((await User.findById(admin._id)).roles).toEqual(["admin"]);
  });

  it("does not deactivate a pending or already non-visible profile", async () => {
    const pendingUser = await createUser({
      username: "pendingdeactivate",
      email: "pending.deactivate@example.com",
      emailVerified: false,
    });
    const hiddenUser = await createUser({
      username: "hiddendeactivate",
      email: "hidden.deactivate@example.com",
    });
    const pending = await createProfile(
      pendingUser,
      PROFILE_STATUS.PENDING_EMAIL_VERIFICATION,
      false
    );
    const hidden = await createProfile(hiddenUser, PROFILE_STATUS.ACTIVE, false);

    const pendingRes = await request(app)
      .post("/api/contributors/me/deactivate")
      .set("Cookie", await login(pendingUser.email))
      .send({});
    const hiddenRes = await request(app)
      .post("/api/contributors/me/deactivate")
      .set("Cookie", await login(hiddenUser.email))
      .send({});

    expect(pendingRes.statusCode).toBe(409);
    expect(pendingRes.body.error.code).toBe("PROFILE_NOT_ELIGIBLE");
    expect(hiddenRes.statusCode).toBe(409);
    expect(hiddenRes.body.error.code).toBe("PROFILE_NOT_ELIGIBLE");
    expect((await ContributorProfile.findById(pending._id)).status).toBe(
      PROFILE_STATUS.PENDING_EMAIL_VERIFICATION
    );
    const hiddenStored = await ContributorProfile.findById(hidden._id);
    expect(hiddenStored.status).toBe(PROFILE_STATUS.ACTIVE);
    expect(hiddenStored.isVisible).toBe(false);
    expect(
      await UserAuditEvent.countDocuments({
        action: USER_AUDIT_ACTIONS.CONTRIBUTOR_PROFILE_DEACTIVATED,
      })
    ).toBe(0);
  });

  it("does not record a second transition for an already inactive profile", async () => {
    const user = await createUser({
      username: "alreadyinactive",
      email: "already.inactive@example.com",
    });
    const profile = await createProfile(user, PROFILE_STATUS.INACTIVE, false);
    const cookie = await login(user.email);

    const first = await request(app)
      .post("/api/contributors/me/deactivate")
      .set("Cookie", cookie)
      .send({});
    const second = await request(app)
      .post("/api/contributors/me/deactivate")
      .set("Cookie", cookie)
      .send({});

    expect(first.statusCode).toBe(409);
    expect(first.body.error.code).toBe("PROFILE_ALREADY_INACTIVE");
    expect(second.body.error.code).toBe("PROFILE_ALREADY_INACTIVE");
    const stored = await ContributorProfile.findById(profile._id);
    expect(stored.status).toBe(PROFILE_STATUS.INACTIVE);
    expect(stored.isVisible).toBe(false);
    expect(
      await UserAuditEvent.countDocuments({
        userId: user._id,
        action: USER_AUDIT_ACTIONS.CONTRIBUTOR_PROFILE_DEACTIVATED,
      })
    ).toBe(0);
  });

  it("does not create a second transition when deactivation is repeated", async () => {
    const user = await createUser({
      username: "duplicatedeactivate",
      email: "duplicate.deactivate@example.com",
    });
    const profile = await createProfile(user, PROFILE_STATUS.ACTIVE, true);
    const cookie = await login(user.email);

    const first = await request(app)
      .post("/api/contributors/me/deactivate")
      .set("Cookie", cookie)
      .send({});
    const second = await request(app)
      .post("/api/contributors/me/deactivate")
      .set("Cookie", cookie)
      .send({});

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(409);
    expect(second.body.error.code).toBe("PROFILE_ALREADY_INACTIVE");
    expect(String((await ContributorProfile.findById(profile._id))._id)).toBe(String(profile._id));
    expect(
      await UserAuditEvent.countDocuments({
        userId: user._id,
        action: USER_AUDIT_ACTIONS.CONTRIBUTOR_PROFILE_DEACTIVATED,
      })
    ).toBe(1);
  });

  it("does not overwrite a newer lifecycle state", async () => {
    const user = await createUser({
      username: "staledeactivate",
      email: "stale.deactivate@example.com",
    });
    const profile = await createProfile(user, PROFILE_STATUS.ACTIVE, true);
    const cookie = await login(user.email);
    const spy = jest
      .spyOn(ContributorProfile, "findOneAndUpdate")
      .mockImplementationOnce(async (filter, update, options) => {
        spy.mockRestore();
        await ContributorProfile.updateOne(
          { _id: profile._id },
          {
            $set: {
              status: PROFILE_STATUS.PENDING_EMAIL_VERIFICATION,
              isVisible: false,
            },
          }
        );
        return ContributorProfile.findOneAndUpdate(filter, update, options);
      });

    const res = await request(app)
      .post("/api/contributors/me/deactivate")
      .set("Cookie", cookie)
      .send({});

    spy.mockRestore();
    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe("PROFILE_NOT_ELIGIBLE");
    const stored = await ContributorProfile.findById(profile._id);
    expect(stored.status).toBe(PROFILE_STATUS.PENDING_EMAIL_VERIFICATION);
    expect(stored.isVisible).toBe(false);
    expect(
      await UserAuditEvent.countDocuments({
        userId: user._id,
        action: USER_AUDIT_ACTIONS.CONTRIBUTOR_PROFILE_DEACTIVATED,
      })
    ).toBe(0);
  });

  it("keeps one transition when two deactivations race", async () => {
    const user = await createUser({
      username: "racedeactivate",
      email: "race.deactivate@example.com",
    });
    const profile = await createProfile(user, PROFILE_STATUS.ACTIVE, true);
    const cookie = await login(user.email);

    const [first, second] = await Promise.all([
      request(app).post("/api/contributors/me/deactivate").set("Cookie", cookie).send({}),
      request(app).post("/api/contributors/me/deactivate").set("Cookie", cookie).send({}),
    ]);

    const statuses = [first.statusCode, second.statusCode].sort();
    expect(statuses).toEqual([200, 409]);
    const failure = first.statusCode === 409 ? first : second;
    expect(failure.body.error.code).toBe("PROFILE_ALREADY_INACTIVE");
    const stored = await ContributorProfile.findById(profile._id);
    expect(stored.status).toBe(PROFILE_STATUS.INACTIVE);
    expect(stored.isVisible).toBe(false);
    expect(
      await UserAuditEvent.countDocuments({
        userId: user._id,
        action: USER_AUDIT_ACTIONS.CONTRIBUTOR_PROFILE_DEACTIVATED,
      })
    ).toBe(1);
  });

  it("does not reactivate an inactive profile through edit or photo changes", async () => {
    const user = await createUser({
      username: "keepinactive",
      email: "keep.inactive@example.com",
    });
    const profile = await createProfile(user, PROFILE_STATUS.ACTIVE, true);
    const cookie = await login(user.email);

    const deactivated = await request(app)
      .post("/api/contributors/me/deactivate")
      .set("Cookie", cookie)
      .send({});
    expect(deactivated.statusCode).toBe(200);

    const edited = await request(app)
      .patch("/api/contributors/me")
      .set("Cookie", cookie)
      .send({
        ...patchBody(profile),
        status: PROFILE_STATUS.ACTIVE,
        isVisible: true,
        userId: String(user._id),
      });
    expect(edited.statusCode).toBe(400);
    expect(edited.body.error.fields.status).toBe("FIELD_NOT_ALLOWED");

    const allowedEdit = await request(app)
      .patch("/api/contributors/me")
      .set("Cookie", cookie)
      .send(patchBody(profile));
    expect(allowedEdit.statusCode).toBe(200);
    expect(allowedEdit.body.profile.status).toBe(PROFILE_STATUS.INACTIVE);
    expect(allowedEdit.body.profile.isVisible).toBe(false);
    expect(allowedEdit.body.profile.city).toBe("Douala");

    const uploaded = await request(app)
      .post("/api/contributors/me/photo")
      .set("Cookie", cookie)
      .attach("photo", PNG_1X1, { filename: "avatar.png", contentType: "image/png" });
    expect(uploaded.statusCode).toBe(200);
    expect(uploaded.body.profile.status).toBe(PROFILE_STATUS.INACTIVE);
    expect(uploaded.body.profile.isVisible).toBe(false);

    const removed = await request(app)
      .delete("/api/contributors/me/photo")
      .set("Cookie", cookie);
    expect(removed.statusCode).toBe(200);
    expect(removed.body.profile.status).toBe(PROFILE_STATUS.INACTIVE);
    expect(removed.body.profile.isVisible).toBe(false);

    const stored = await ContributorProfile.findById(profile._id);
    expect(stored.status).toBe(PROFILE_STATUS.INACTIVE);
    expect(stored.isVisible).toBe(false);
    const pub = await request(app).get(`/api/contributors/${profile._id}`);
    expect(pub.statusCode).toBe(404);
  });

  it("leaves the previous state in place when persistence fails", async () => {
    const user = await createUser({
      username: "failedddeactivate",
      email: "failed.deactivate@example.com",
    });
    const profile = await createProfile(user, PROFILE_STATUS.ACTIVE, true);
    const cookie = await login(user.email);
    const spy = jest
      .spyOn(ContributorProfile, "findOneAndUpdate")
      .mockRejectedValueOnce(new Error("db down"));

    const res = await request(app)
      .post("/api/contributors/me/deactivate")
      .set("Cookie", cookie)
      .send({});

    spy.mockRestore();
    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe("SERVER_ERROR");
    expect(res.body.profile).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("db down");
    const stored = await ContributorProfile.findById(profile._id);
    expect(stored.status).toBe(PROFILE_STATUS.ACTIVE);
    expect(stored.isVisible).toBe(true);
    expect(
      await UserAuditEvent.countDocuments({
        userId: user._id,
        action: USER_AUDIT_ACTIONS.CONTRIBUTOR_PROFILE_DEACTIVATED,
      })
    ).toBe(0);
  });

  it("returns not found when the authenticated user has no contributor profile", async () => {
    const user = await createUser({
      username: "noprofiledeactivate",
      email: "noprofile.deactivate@example.com",
    });
    const cookie = await login(user.email);
    const missingId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .post("/api/contributors/me/deactivate")
      .set("Cookie", cookie)
      .send({});

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("CONTRIBUTOR_PROFILE_NOT_FOUND");
    expect(await ContributorProfile.findById(missingId)).toBeNull();
  });
});
