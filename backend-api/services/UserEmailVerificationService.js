const crypto = require("crypto");
const UserEmailVerificationToken = require("../models/UserEmailVerificationToken");
const { USER_EMAIL_VERIFICATION } = require("../models/UserEmailVerificationToken");
const User = require("../models/user");
const ContributorProfile = require("../models/ContributorProfile");
const { PROFILE_STATUS } = require("../models/ContributorProfile");
const EmailService = require("./EmailService");
const { recordUserAuditEvent, USER_AUDIT_ACTIONS } = require("./AuditService");

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RAW_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

class UserEmailVerificationError extends Error {
  constructor(code, status) {
    super(code);
    this.name = "UserEmailVerificationError";
    this.code = code;
    this.status = status;
  }
}

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
}

function hashEmail(email) {
  return crypto
    .createHash("sha256")
    .update(String(email).trim().toLowerCase(), "utf8")
    .digest("hex");
}

function hashesEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Minimum publication fields already enforced at profile creation.
 * Re-checked here so a profile cannot become public when they are missing.
 */
function profileMeetsPublicationCriteria(profile) {
  if (!profile) return false;
  const displayName =
    typeof profile.displayName === "string" ? profile.displayName.trim() : "";
  const country = typeof profile.country === "string" ? profile.country.trim() : "";
  const skills = Array.isArray(profile.skills) ? profile.skills : [];
  const hasSkill = skills.some((skill) => {
    if (skill.isCustom) {
      return typeof skill.customLabel === "string" && skill.customLabel.trim().length > 0;
    }
    return Boolean(skill.skillId);
  });
  return (
    displayName.length >= 2 &&
    displayName.length <= 80 &&
    country.length > 0 &&
    Boolean(profile.domainId) &&
    hasSkill
  );
}

/**
 * Issues a fresh token and sends it.
 * Older unused tokens stay valid until the new message is actually sent.
 * A failed delivery deletes only the token that was not emailed.
 */
async function issueAndSend(user) {
  const rawToken = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  const tokenDoc = await UserEmailVerificationToken.create({
    userId: user._id,
    tokenHash: hashToken(rawToken),
    purpose: USER_EMAIL_VERIFICATION,
    boundEmailHash: hashEmail(user.email),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    isUsed: false,
  });

  const sent = await EmailService.sendUserEmailVerification(user.email, rawToken);
  if (!sent) {
    await UserEmailVerificationToken.deleteOne({ _id: tokenDoc._id });
    console.error("UserEmailVerificationService.issueAndSend:", {
      delivered: false,
      userPresent: true,
    });
    return false;
  }

  await UserEmailVerificationToken.updateMany(
    {
      userId: user._id,
      purpose: USER_EMAIL_VERIFICATION,
      isUsed: false,
      _id: { $ne: tokenDoc._id },
    },
    { $set: { isUsed: true } }
  );
  await recordUserAuditEvent({
    action: USER_AUDIT_ACTIONS.USER_EMAIL_VERIFICATION_REQUESTED,
    userId: user._id,
    metadata: { purpose: USER_EMAIL_VERIFICATION },
  });
  return true;
}

/**
 * Sends a verification email when the account is not yet verified.
 * Does not change ContributorProfile status or visibility.
 */
async function sendVerificationForUser(user) {
  if (!user) {
    throw new UserEmailVerificationError("UNAUTHORIZED", 401);
  }
  if (user.emailVerified === true) {
    return { verificationRequired: false, verificationEmailSent: false };
  }
  const sent = await issueAndSend(user);
  return { verificationRequired: true, verificationEmailSent: sent };
}

async function resendForAuthenticatedUser(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new UserEmailVerificationError("UNAUTHORIZED", 401);
  }
  if (user.emailVerified === true) {
    return {
      emailVerified: true,
      verificationEmailSent: false,
      profileStatusUnchanged: true,
    };
  }

  const profile = await ContributorProfile.findOne({ userId: user._id });
  if (!profile) {
    throw new UserEmailVerificationError("CONTRIBUTOR_PROFILE_NOT_FOUND", 404);
  }

  const sent = await issueAndSend(user);
  if (!sent) {
    throw new UserEmailVerificationError("VERIFICATION_EMAIL_FAILED", 503);
  }

  const fresh = await ContributorProfile.findById(profile._id);
  return {
    emailVerified: false,
    verificationEmailSent: true,
    status: fresh.status,
    isVisible: fresh.isVisible === true,
  };
}

async function activateEligibleProfile(user) {
  const profile = await ContributorProfile.findOne({ userId: user._id });
  if (!profile) {
    return { profile: null, profileActivated: false };
  }
  if (!profileMeetsPublicationCriteria(profile)) {
    return { profile, profileActivated: false };
  }
  if (
    profile.status !== PROFILE_STATUS.ACTIVE ||
    profile.isVisible !== true
  ) {
    profile.status = PROFILE_STATUS.ACTIVE;
    profile.isVisible = true;
    await profile.save();
    await recordUserAuditEvent({
      action: USER_AUDIT_ACTIONS.CONTRIBUTOR_PROFILE_ACTIVATED,
      userId: user._id,
      metadata: { contributorProfileId: String(profile._id) },
    });
  }
  return { profile, profileActivated: true };
}

async function consumeVerificationToken(rawToken) {
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  if (!RAW_TOKEN_PATTERN.test(token)) {
    throw new UserEmailVerificationError("TOKEN_INVALID", 400);
  }

  const tokenHash = hashToken(token);
  const existing = await UserEmailVerificationToken.findOne({ tokenHash });
  if (!existing || existing.purpose !== USER_EMAIL_VERIFICATION) {
    throw new UserEmailVerificationError("TOKEN_INVALID", 400);
  }
  if (existing.isUsed) {
    throw new UserEmailVerificationError("TOKEN_USED", 400);
  }
  if (existing.expiresAt.getTime() <= Date.now()) {
    throw new UserEmailVerificationError("TOKEN_EXPIRED", 400);
  }

  const consumed = await UserEmailVerificationToken.findOneAndUpdate(
    {
      _id: existing._id,
      isUsed: false,
      purpose: USER_EMAIL_VERIFICATION,
      expiresAt: { $gt: new Date() },
    },
    { $set: { isUsed: true } },
    { new: true }
  );
  if (!consumed) {
    throw new UserEmailVerificationError("TOKEN_USED", 400);
  }

  const user = await User.findById(consumed.userId);
  if (!user || !hashesEqual(consumed.boundEmailHash, hashEmail(user.email))) {
    throw new UserEmailVerificationError("TOKEN_INVALID", 400);
  }

  const wasVerified = user.emailVerified === true;
  if (!wasVerified) {
    user.emailVerified = true;
    await user.save();
  }

  try {
    const { profile, profileActivated } = await activateEligibleProfile(user);
    if (!wasVerified) {
      await recordUserAuditEvent({
        action: USER_AUDIT_ACTIONS.USER_EMAIL_VERIFIED,
        userId: user._id,
      });
    }
    return {
      emailVerified: true,
      profileActivated,
      profileId: profile ? String(profile._id) : null,
    };
  } catch (err) {
    if (!wasVerified) {
      user.emailVerified = false;
      await user.save();
    }
    console.error("UserEmailVerificationService.activate:", {
      name: err && err.name,
      code: err && err.code,
    });
    throw new UserEmailVerificationError("VERIFICATION_PROCESSING_FAILED", 500);
  }
}

module.exports = {
  USER_EMAIL_VERIFICATION,
  TOKEN_TTL_MS,
  UserEmailVerificationError,
  hashToken,
  profileMeetsPublicationCriteria,
  sendVerificationForUser,
  resendForAuthenticatedUser,
  consumeVerificationToken,
};
