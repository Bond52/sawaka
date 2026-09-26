const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../../index");
const User = require("../../models/user");
const Domain = require("../../models/Domain");
const Skill = require("../../models/Skill");
const ContributorProfile = require("../../models/ContributorProfile");
const UserEmailVerificationToken = require("../../models/UserEmailVerificationToken");
const MagicLinkToken = require("../../models/MagicLinkToken");
const Supplier = require("../../models/Supplier");
const { ensureContributorTaxonomy } = require("../../services/contributorTaxonomySeed");
const EmailService = require("../../services/EmailService");
const contributorRoutes = require("../../routes/contributor.routes");
const { PROFILE_STATUS } = require("../../services/ContributorProfileService");

async function loadTaxonomy() {
  await ensureContributorTaxonomy();
  const domain = await Domain.findOne({ isActive: true }).sort({ nameEN: 1 });
  const skill = await Skill.findOne({ domainId: domain._id, isActive: true });
  return { domain, skill };
}

function payload(domain, skill, account) {
  return {
    account,
    displayName: "Amina Nguema",
    domainId: String(domain._id),
    skillIds: [String(skill._id)],
    country: "Cameroun",
    city: "Yaoundé",
    biography: "Maçonne.",
  };
}

describe("Contributor account email verification", () => {
  let sendSpy;

  beforeEach(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-auth";
    process.env.FRONTEND_URL = "https://app.example.com";
    contributorRoutes.verificationResendRateLimit.reset();
    contributorRoutes.verificationConsumeRateLimit.reset();
    sendSpy = jest
      .spyOn(EmailService, "sendUserEmailVerification")
      .mockResolvedValue(true);
  });

  afterEach(() => {
    sendSpy.mockRestore();
  });

  function latestToken() {
    const call = sendSpy.mock.calls[sendSpy.mock.calls.length - 1];
    return call && call[1];
  }

  it("sends a verification email and keeps a new profile pending", async () => {
    const { domain, skill } = await loadTaxonomy();
    const res = await request(app)
      .post("/api/contributors")
      .send(
        payload(domain, skill, {
          username: "aminaverify",
          email: "amina.verify@example.com",
          password: "Secret123!",
        })
      );

    expect(res.statusCode).toBe(201);
    expect(res.body.verificationRequired).toBe(true);
    expect(res.body.verificationEmailSent).toBe(true);
    expect(res.body.profile.status).toBe(PROFILE_STATUS.PENDING_EMAIL_VERIFICATION);
    expect(res.body.profile.isVisible).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain("amina.verify@example.com");
    expect(JSON.stringify(res.body)).not.toContain(latestToken());
    expect(sendSpy).toHaveBeenCalledTimes(1);

    const stored = await UserEmailVerificationToken.findOne({ isUsed: false });
    expect(stored.tokenHash).not.toBe(latestToken());
    expect(stored.purpose).toBe("USER_EMAIL_VERIFICATION");
  });

  it("does not send a second email when the account is already verified", async () => {
    const { domain, skill } = await loadTaxonomy();
    const hash = await bcrypt.hash("Secret123!", 10);
    const user = await User.create({
      username: "alreadyverified",
      email: "already.verified@example.com",
      password: hash,
      roles: ["acheteur"],
      emailVerified: true,
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "Secret123!" });

    const res = await request(app)
      .post("/api/contributors")
      .set("Cookie", login.headers["set-cookie"])
      .send({
        displayName: "Amina Nguema",
        domainId: String(domain._id),
        skillIds: [String(skill._id)],
        country: "Cameroun",
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.verificationRequired).toBe(false);
    expect(res.body.verificationEmailSent).toBe(false);
    expect(res.body.profile.status).toBe(PROFILE_STATUS.ACTIVE);
    expect(res.body.profile.isVisible).toBe(true);
    expect(sendSpy).not.toHaveBeenCalled();
    expect(await UserEmailVerificationToken.countDocuments()).toBe(0);
  });

  it("activates an eligible profile when the verification link is consumed", async () => {
    const { domain, skill } = await loadTaxonomy();
    const created = await request(app)
      .post("/api/contributors")
      .send(
        payload(domain, skill, {
          username: "activateuser",
          email: "activate.user@example.com",
          password: "Secret123!",
        })
      );
    const token = latestToken();

    const verified = await request(app)
      .post("/api/contributors/email-verification")
      .send({ token });

    expect(verified.statusCode).toBe(200);
    expect(verified.body.emailVerified).toBe(true);
    expect(verified.body.profileActivated).toBe(true);
    expect(JSON.stringify(verified.body)).not.toContain("activate.user@example.com");
    expect(JSON.stringify(verified.body)).not.toContain(token);

    const user = await User.findOne({ username: "activateuser" });
    expect(user.emailVerified).toBe(true);
    const profile = await ContributorProfile.findOne({ userId: user._id });
    expect(profile.status).toBe(PROFILE_STATUS.ACTIVE);
    expect(profile.isVisible).toBe(true);

    const pub = await request(app).get(`/api/contributors/${profile._id}`);
    expect(pub.statusCode).toBe(200);
    expect(JSON.stringify(pub.body)).not.toContain(user.email);

    const reused = await request(app)
      .post("/api/contributors/email-verification")
      .send({ token });
    expect(reused.statusCode).toBe(400);
    expect(reused.body.error.code).toBe("TOKEN_USED");
  });

  it("keeps the profile pending when verification is resent", async () => {
    const { domain, skill } = await loadTaxonomy();
    const created = await request(app)
      .post("/api/contributors")
      .send(
        payload(domain, skill, {
          username: "resenduser",
          email: "resend.user@example.com",
          password: "Secret123!",
        })
      );
    const firstToken = latestToken();

    const resend = await request(app)
      .post("/api/contributors/me/verification-email")
      .set("Cookie", created.headers["set-cookie"]);

    expect(resend.statusCode).toBe(200);
    expect(resend.body.verificationEmailSent).toBe(true);
    expect(resend.body.status).toBe(PROFILE_STATUS.PENDING_EMAIL_VERIFICATION);
    expect(resend.body.isVisible).toBe(false);
    expect(JSON.stringify(resend.body)).not.toContain("resend.user@example.com");

    const secondToken = latestToken();
    expect(secondToken).not.toBe(firstToken);

    const oldLink = await request(app)
      .post("/api/contributors/email-verification")
      .send({ token: firstToken });
    expect(oldLink.statusCode).toBe(400);
    expect(oldLink.body.error.code).toBe("TOKEN_USED");

    const user = await User.findOne({ username: "resenduser" });
    expect(user.emailVerified).toBe(false);
    const profile = await ContributorProfile.findOne({ userId: user._id });
    expect(profile.status).toBe(PROFILE_STATUS.PENDING_EMAIL_VERIFICATION);
    expect(profile.isVisible).toBe(false);
  });

  it("rejects expired, malformed, and unknown tokens without activating a profile", async () => {
    const { domain, skill } = await loadTaxonomy();
    const created = await request(app)
      .post("/api/contributors")
      .send(
        payload(domain, skill, {
          username: "expireduser",
          email: "expired.user@example.com",
          password: "Secret123!",
        })
      );
    const token = latestToken();
    await UserEmailVerificationToken.updateOne(
      { tokenHash: require("../../services/UserEmailVerificationService").hashToken(token) },
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );

    const expired = await request(app)
      .post("/api/contributors/email-verification")
      .send({ token });
    const malformed = await request(app)
      .post("/api/contributors/email-verification")
      .send({ token: "not-a-token" });
    const unknown = await request(app)
      .post("/api/contributors/email-verification")
      .send({ token: "ab".repeat(32) });

    expect(expired.body.error.code).toBe("TOKEN_EXPIRED");
    expect(malformed.body.error.code).toBe("TOKEN_INVALID");
    expect(unknown.body.error.code).toBe("TOKEN_INVALID");

    const user = await User.findOne({ username: "expireduser" });
    expect(user.emailVerified).toBe(false);
    const profile = await ContributorProfile.findOne({ userId: user._id });
    expect(profile.isVisible).toBe(false);
    expect(created.body.profile.id).toBe(String(profile._id));
  });

  it("verifies only the account bound to the token", async () => {
    const { domain, skill } = await loadTaxonomy();
    await request(app)
      .post("/api/contributors")
      .send(
        payload(domain, skill, {
          username: "ownerone",
          email: "owner.one@example.com",
          password: "Secret123!",
        })
      );
    const token = latestToken();
    const hash = await bcrypt.hash("Secret123!", 10);
    await User.create({
      username: "ownertwo",
      email: "owner.two@example.com",
      password: hash,
      roles: ["acheteur"],
      emailVerified: false,
    });

    const verified = await request(app)
      .post("/api/contributors/email-verification")
      .send({ token });
    expect(verified.body.emailVerified).toBe(true);

    const other = await User.findOne({ username: "ownertwo" });
    expect(other.emailVerified).toBe(false);
  });

  it("verifies the account but does not publish a profile that misses publication data", async () => {
    const { domain, skill } = await loadTaxonomy();
    const created = await request(app)
      .post("/api/contributors")
      .send(
        payload(domain, skill, {
          username: "incomplete",
          email: "incomplete.user@example.com",
          password: "Secret123!",
        })
      );
    await ContributorProfile.updateOne(
      { _id: created.body.profile.id },
      { $set: { skills: [], country: "" } }
    );

    const verified = await request(app)
      .post("/api/contributors/email-verification")
      .send({ token: latestToken() });

    expect(verified.statusCode).toBe(200);
    expect(verified.body.emailVerified).toBe(true);
    expect(verified.body.profileActivated).toBe(false);

    const profile = await ContributorProfile.findById(created.body.profile.id);
    expect(profile.status).toBe(PROFILE_STATUS.PENDING_EMAIL_VERIFICATION);
    expect(profile.isVisible).toBe(false);
    const pub = await request(app).get(`/api/contributors/${profile._id}`);
    expect(pub.statusCode).toBe(404);

    const user = await User.findOne({ username: "incomplete" });
    expect(user.emailVerified).toBe(true);
  });

  it("keeps the profile when the verification email cannot be sent", async () => {
    sendSpy.mockResolvedValue(false);
    const { domain, skill } = await loadTaxonomy();
    const res = await request(app)
      .post("/api/contributors")
      .send(
        payload(domain, skill, {
          username: "mailfail",
          email: "mail.fail@example.com",
          password: "Secret123!",
        })
      );

    expect(res.statusCode).toBe(201);
    expect(res.body.verificationEmailSent).toBe(false);
    expect(res.body.profile.status).toBe(PROFILE_STATUS.PENDING_EMAIL_VERIFICATION);
    expect(res.body.profile.isVisible).toBe(false);
    expect(await User.findOne({ username: "mailfail" })).toBeTruthy();
    expect(await UserEmailVerificationToken.countDocuments()).toBe(0);

    sendSpy.mockResolvedValue(true);
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "mail.fail@example.com", password: "Secret123!" });
    const resend = await request(app)
      .post("/api/contributors/me/verification-email")
      .set("Cookie", login.headers["set-cookie"]);
    expect(resend.statusCode).toBe(200);
    expect(resend.body.status).toBe(PROFILE_STATUS.PENDING_EMAIL_VERIFICATION);
  });

  it("rate limits verification resend without changing the profile", async () => {
    const { domain, skill } = await loadTaxonomy();
    const created = await request(app)
      .post("/api/contributors")
      .send(
        payload(domain, skill, {
          username: "ratelimit",
          email: "rate.limit@example.com",
          password: "Secret123!",
        })
      );
    const cookie = created.headers["set-cookie"];

    for (let i = 0; i < 5; i += 1) {
      const ok = await request(app)
        .post("/api/contributors/me/verification-email")
        .set("Cookie", cookie);
      expect(ok.statusCode).toBe(200);
    }
    const limited = await request(app)
      .post("/api/contributors/me/verification-email")
      .set("Cookie", cookie);
    expect(limited.statusCode).toBe(429);

    const user = await User.findOne({ username: "ratelimit" });
    const profile = await ContributorProfile.findOne({ userId: user._id });
    expect(profile.status).toBe(PROFILE_STATUS.PENDING_EMAIL_VERIFICATION);
    expect(profile.isVisible).toBe(false);
  });

  it("rejects a supplier magic-link token without verifying the account", async () => {
    const { domain, skill } = await loadTaxonomy();
    const created = await request(app)
      .post("/api/contributors")
      .send(
        payload(domain, skill, {
          username: "wrongpurpose",
          email: "wrong.purpose@example.com",
          password: "Secret123!",
        })
      );
    const supplier = await Supplier.create({
      accountEmail: "supplier.purpose@example.com",
      phone: "600000000",
    });
    const supplierToken = "cd".repeat(32);
    const supplierLink = await MagicLinkToken.create({
      tokenHash: require("../../services/UserEmailVerificationService").hashToken(
        supplierToken
      ),
      purpose: "CONTACT_EMAIL_VERIFICATION",
      supplierId: supplier._id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      isUsed: false,
    });

    const rejected = await request(app)
      .post("/api/contributors/email-verification")
      .send({ token: supplierToken });

    expect(rejected.statusCode).toBe(400);
    expect(rejected.body.error.code).toBe("TOKEN_INVALID");
    const user = await User.findOne({ username: "wrongpurpose" });
    expect(user.emailVerified).toBe(false);
    const profile = await ContributorProfile.findById(created.body.profile.id);
    expect(profile.status).toBe(PROFILE_STATUS.PENDING_EMAIL_VERIFICATION);
    expect(profile.isVisible).toBe(false);
    const stillStored = await MagicLinkToken.findById(supplierLink._id);
    expect(stillStored.isUsed).toBe(false);
  });

  it("does not let an unauthenticated caller choose an account to resend", async () => {
    const res = await request(app)
      .post("/api/contributors/me/verification-email")
      .send({ userId: "64b000000000000000000099", email: "someone@example.com" });
    expect(res.statusCode).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain("someone@example.com");
  });
});
