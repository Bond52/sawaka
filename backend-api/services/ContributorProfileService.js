const mongoose = require("mongoose");
const Domain = require("../models/Domain");
const Skill = require("../models/Skill");
const ContributorProfile = require("../models/ContributorProfile");
const { PROFILE_STATUS } = require("../models/ContributorProfile");
const User = require("../models/user");
const {
  createUserAccount,
  AccountRegistrationError,
  ACCOUNT_FIELDS_REQUIRED,
  ACCOUNT_ALREADY_EXISTS,
} = require("./accountRegistration");
const {
  sendVerificationForUser,
} = require("./UserEmailVerificationService");

const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 80;
const MAX_SELECTED_SKILLS = 20;
const MAX_CUSTOM_SKILLS = 5;
const CUSTOM_SKILL_MAX = 30;
/** Technical bound. The requirements ask for a reasonable length and do not give a number. */
const BIOGRAPHY_MAX = 2000;
/** Technical bound for free-text location. No controlled country list is approved. */
const LOCATION_MAX = 120;

const PROFILE_FIELDS = new Set([
  "displayName",
  "domainId",
  "skillIds",
  "customSkills",
  "country",
  "region",
  "city",
  "biography",
]);
const ACCOUNT_FIELDS = new Set(["username", "email", "password"]);
const MARKUP_PATTERN = /<\/?[a-z][^>]*>/i;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

class ContributorProfileError extends Error {
  constructor(code, status, extra = {}) {
    super(code);
    this.name = "ContributorProfileError";
    this.code = code;
    this.status = status;
    this.fields = extra.fields;
    this.profileId = extra.profileId;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function initialLifecycle(user) {
  if (user && user.emailVerified === true) {
    return {
      status: PROFILE_STATUS.ACTIVE,
      isVisible: true,
    };
  }
  return {
    status: PROFILE_STATUS.PENDING_EMAIL_VERIFICATION,
    isVisible: false,
  };
}

function assertAllowlist(body) {
  if (!isPlainObject(body)) {
    throw new ContributorProfileError("VALIDATION_ERROR", 400, {
      fields: { body: "INVALID_BODY" },
    });
  }

  const fields = {};
  for (const key of Object.keys(body)) {
    if (key !== "account" && !PROFILE_FIELDS.has(key)) {
      fields[key] = "FIELD_NOT_ALLOWED";
    }
  }
  if (body.account !== undefined) {
    if (!isPlainObject(body.account)) {
      fields.account = "FIELD_NOT_ALLOWED";
    } else {
      for (const key of Object.keys(body.account)) {
        if (!ACCOUNT_FIELDS.has(key)) {
          fields[`account.${key}`] = "FIELD_NOT_ALLOWED";
        }
      }
    }
  }
  if (Object.keys(fields).length > 0) {
    throw new ContributorProfileError("VALIDATION_ERROR", 400, { fields });
  }
}

function trimToString(value) {
  return typeof value === "string" ? value.trim() : null;
}

function collectProfileFieldErrors(body) {
  const fields = {};
  const displayName = trimToString(body.displayName);
  if (displayName === null || displayName.length === 0) {
    fields.displayName = "DISPLAY_NAME_REQUIRED";
  } else if (
    displayName.length < DISPLAY_NAME_MIN ||
    displayName.length > DISPLAY_NAME_MAX
  ) {
    fields.displayName = "DISPLAY_NAME_LENGTH";
  }

  const domainId = trimToString(body.domainId);
  if (domainId === null || domainId.length === 0) {
    fields.domainId = "DOMAIN_REQUIRED";
  } else if (!OBJECT_ID_PATTERN.test(domainId)) {
    fields.domainId = "DOMAIN_INVALID";
  }

  let skillIds = [];
  if (body.skillIds === undefined) {
    skillIds = [];
  } else if (!Array.isArray(body.skillIds)) {
    fields.skillIds = "SKILL_INVALID";
  } else {
    skillIds = body.skillIds.map((id) => (typeof id === "string" ? id.trim() : ""));
    if (skillIds.some((id) => !OBJECT_ID_PATTERN.test(id))) {
      fields.skillIds = "SKILL_INVALID";
    } else if (new Set(skillIds).size !== skillIds.length) {
      fields.skillIds = "SKILL_DUPLICATE";
    }
  }

  let customSkills = [];
  if (body.customSkills === undefined) {
    customSkills = [];
  } else if (!Array.isArray(body.customSkills)) {
    fields.customSkills = "CUSTOM_SKILL_INVALID";
  } else {
    customSkills = [];
    const seen = new Set();
    for (const raw of body.customSkills) {
      const label = trimToString(raw);
      if (label === null || label.length === 0) {
        fields.customSkills = "CUSTOM_SKILL_INVALID";
        break;
      }
      if ([...label].length > CUSTOM_SKILL_MAX) {
        fields.customSkills = "CUSTOM_SKILL_LENGTH";
        break;
      }
      const key = label.toLocaleLowerCase();
      if (seen.has(key)) {
        fields.customSkills = "CUSTOM_SKILL_DUPLICATE";
        break;
      }
      seen.add(key);
      customSkills.push(label);
    }
    if (!fields.customSkills && customSkills.length > MAX_CUSTOM_SKILLS) {
      fields.customSkills = "CUSTOM_SKILL_LIMIT";
    }
  }

  if (!fields.skillIds && !fields.customSkills) {
    const total = skillIds.length + customSkills.length;
    if (total < 1) {
      fields.skillIds = "SKILL_REQUIRED";
    } else if (total > MAX_SELECTED_SKILLS) {
      fields.skillIds = "SKILL_LIMIT";
    }
  }

  const country = trimToString(body.country);
  if (country === null || country.length === 0) {
    fields.country = "COUNTRY_REQUIRED";
  } else if ([...country].length > LOCATION_MAX) {
    fields.country = "COUNTRY_LENGTH";
  }

  const region = body.region === undefined ? "" : trimToString(body.region);
  if (region === null) {
    fields.region = "REGION_INVALID";
  } else if ([...region].length > LOCATION_MAX) {
    fields.region = "REGION_LENGTH";
  }

  const city = body.city === undefined ? "" : trimToString(body.city);
  if (city === null) {
    fields.city = "CITY_INVALID";
  } else if ([...city].length > LOCATION_MAX) {
    fields.city = "CITY_LENGTH";
  }

  const biography =
    body.biography === undefined ? "" : trimToString(body.biography);
  if (biography === null) {
    fields.biography = "BIOGRAPHY_INVALID";
  } else if (MARKUP_PATTERN.test(biography)) {
    fields.biography = "BIOGRAPHY_MARKUP";
  } else if ([...biography].length > BIOGRAPHY_MAX) {
    fields.biography = "BIOGRAPHY_LENGTH";
  }

  return {
    fields,
    value: {
      displayName: displayName || "",
      domainId: domainId || "",
      skillIds,
      customSkills,
      country: country || "",
      region: region || "",
      city: city || "",
      biography: biography || "",
    },
  };
}

function toSkillEntry(stored, skillDoc) {
  if (stored.isCustom) {
    return { customLabel: stored.customLabel, isCustom: true };
  }
  return {
    id: String(stored.skillId),
    nameFR: skillDoc ? skillDoc.nameFR : "",
    nameEN: skillDoc ? skillDoc.nameEN : "",
    isCustom: false,
  };
}

function shapeProfile(profile, domain, skillDocs, { includeLifecycle }) {
  const byId = new Map(skillDocs.map((skill) => [String(skill._id), skill]));
  const body = {
    id: String(profile._id),
    displayName: profile.displayName,
    biography: profile.biography || "",
    country: profile.country,
    region: profile.region || "",
    city: profile.city || "",
    domain: domain
      ? {
          id: String(domain._id),
          nameFR: domain.nameFR,
          nameEN: domain.nameEN,
        }
      : null,
    skills: (profile.skills || []).map((skill) =>
      toSkillEntry(skill, byId.get(String(skill.skillId)))
    ),
  };
  if (includeLifecycle) {
    body.status = profile.status;
    body.isVisible = profile.isVisible === true;
  }
  return body;
}

async function loadProfileContext(profile) {
  const domain = await Domain.findById(profile.domainId);
  const skillIds = (profile.skills || [])
    .filter((skill) => !skill.isCustom && skill.skillId)
    .map((skill) => skill.skillId);
  const skillDocs = skillIds.length
    ? await Skill.find({ _id: { $in: skillIds } })
    : [];
  return { domain, skillDocs };
}

async function resolveTaxonomy(value) {
  const fields = {};
  let domain = null;
  if (OBJECT_ID_PATTERN.test(value.domainId)) {
    domain = await Domain.findById(value.domainId);
    if (!domain) {
      fields.domainId = "DOMAIN_NOT_FOUND";
    } else if (domain.isActive !== true) {
      fields.domainId = "DOMAIN_INACTIVE";
    }
  }

  let canonical = [];
  if (!fields.domainId && value.skillIds.length > 0) {
    canonical = await Skill.find({
      _id: { $in: value.skillIds.map((id) => new mongoose.Types.ObjectId(id)) },
    });
    const byId = new Map(canonical.map((skill) => [String(skill._id), skill]));
    const missing = value.skillIds.some((id) => !byId.has(id));
    const inactive = value.skillIds.some((id) => {
      const skill = byId.get(id);
      return skill && skill.isActive !== true;
    });
    const skillDomainIds = [
      ...new Set(canonical.map((skill) => String(skill.domainId))),
    ];
    const skillDomains = skillDomainIds.length
      ? await Domain.find({ _id: { $in: skillDomainIds } })
      : [];
    const activeDomainIds = new Set(
      skillDomains
        .filter((item) => item.isActive === true)
        .map((item) => String(item._id))
    );
    const inactiveDomain = value.skillIds.some((id) => {
      const skill = byId.get(id);
      return (
        skill &&
        skill.isActive === true &&
        !activeDomainIds.has(String(skill.domainId))
      );
    });
    if (missing || inactive || inactiveDomain) {
      fields.skillIds = "SKILL_INVALID";
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new ContributorProfileError("VALIDATION_ERROR", 400, { fields });
  }

  return { domain, canonical };
}

async function removeOrphanAccount(userId) {
  const kept = await ContributorProfile.exists({ userId });
  if (!kept) {
    await User.deleteOne({ _id: userId });
  }
}

async function createContributorProfile({ authUserId, body }) {
  assertAllowlist(body);
  const { fields, value } = collectProfileFieldErrors(body);
  if (Object.keys(fields).length > 0) {
    throw new ContributorProfileError("VALIDATION_ERROR", 400, { fields });
  }

  const { domain, canonical } = await resolveTaxonomy(value);

  let user;
  let createdUser = null;

  if (!authUserId) {
    const account = body.account || {};
    const username = typeof account.username === "string" ? account.username.trim() : "";
    const email = typeof account.email === "string" ? account.email.trim() : "";
    const password = typeof account.password === "string" ? account.password : "";
    try {
      user = await createUserAccount(
        { username, email, password },
        { isSeller: false }
      );
      createdUser = user;
    } catch (err) {
      if (err instanceof AccountRegistrationError) {
        const status = err.code === ACCOUNT_ALREADY_EXISTS ? 400 : 400;
        throw new ContributorProfileError(err.code, status);
      }
      throw err;
    }
  } else {
    user = await User.findById(authUserId);
    if (!user) {
      throw new ContributorProfileError("UNAUTHORIZED", 401);
    }
  }

  const existing = await ContributorProfile.findOne({ userId: user._id }).select("_id");
  if (existing) {
    if (createdUser) {
      await removeOrphanAccount(createdUser._id);
    }
    throw new ContributorProfileError("CONTRIBUTOR_PROFILE_EXISTS", 409, {
      profileId: String(existing._id),
    });
  }

  const lifecycle = initialLifecycle(user);
  const skills = [
    ...value.skillIds.map((id) => ({
      skillId: id,
      customLabel: "",
      isCustom: false,
    })),
    ...value.customSkills.map((label) => ({
      skillId: null,
      customLabel: label,
      isCustom: true,
    })),
  ];

  try {
    const profile = await ContributorProfile.create({
      userId: user._id,
      displayName: value.displayName,
      biography: value.biography,
      country: value.country,
      region: value.region,
      city: value.city,
      domainId: domain._id,
      skills,
      status: lifecycle.status,
      isVisible: lifecycle.isVisible,
    });
    let verification = {
      verificationRequired: false,
      verificationEmailSent: false,
    };
    try {
      verification = await sendVerificationForUser(user);
    } catch (sendErr) {
      console.error("ContributorProfileService.verificationEmail:", {
        name: sendErr && sendErr.name,
        code: sendErr && sendErr.code,
      });
      verification = {
        verificationRequired: user.emailVerified !== true,
        verificationEmailSent: false,
      };
    }
    return {
      user,
      profile,
      domain,
      canonical,
      accountCreated: Boolean(createdUser),
      verificationRequired: verification.verificationRequired,
      verificationEmailSent: verification.verificationEmailSent,
    };
  } catch (err) {
    if (createdUser) {
      try {
        await removeOrphanAccount(createdUser._id);
      } catch (cleanupErr) {
        console.error("ContributorProfileService.compensation:", {
          name: cleanupErr && cleanupErr.name,
          code: cleanupErr && cleanupErr.code,
        });
      }
    }
    if (err && err.code === 11000) {
      const raced = await ContributorProfile.findOne({ userId: user._id }).select("_id");
      throw new ContributorProfileError("CONTRIBUTOR_PROFILE_EXISTS", 409, {
        profileId: raced ? String(raced._id) : undefined,
      });
    }
    console.error("ContributorProfileService.create:", {
      name: err && err.name,
      code: err && err.code,
    });
    throw err;
  }
}

async function getOwnProfile(authUserId) {
  const profile = await ContributorProfile.findOne({ userId: authUserId });
  if (!profile) {
    throw new ContributorProfileError("CONTRIBUTOR_PROFILE_NOT_FOUND", 404);
  }
  const { domain, skillDocs } = await loadProfileContext(profile);
  return shapeProfile(profile, domain, skillDocs, { includeLifecycle: true });
}

async function getPublicProfile(profileId) {
  if (!OBJECT_ID_PATTERN.test(String(profileId || ""))) {
    throw new ContributorProfileError("CONTRIBUTOR_PROFILE_NOT_FOUND", 404);
  }
  const profile = await ContributorProfile.findById(profileId);
  if (
    !profile ||
    profile.status !== PROFILE_STATUS.ACTIVE ||
    profile.isVisible !== true
  ) {
    throw new ContributorProfileError("CONTRIBUTOR_PROFILE_NOT_FOUND", 404);
  }
  const { domain, skillDocs } = await loadProfileContext(profile);
  return shapeProfile(profile, domain, skillDocs, { includeLifecycle: false });
}

async function listActiveDomains() {
  const domains = await Domain.find({ isActive: true }).sort({ nameEN: 1 });
  return domains.map((domain) => ({
    id: String(domain._id),
    nameFR: domain.nameFR,
    nameEN: domain.nameEN,
  }));
}

async function listSkillsForDomain(domainId) {
  if (!OBJECT_ID_PATTERN.test(String(domainId || ""))) {
    throw new ContributorProfileError("DOMAIN_NOT_FOUND", 404);
  }
  const domain = await Domain.findById(domainId);
  if (!domain || domain.isActive !== true) {
    throw new ContributorProfileError("DOMAIN_NOT_FOUND", 404);
  }
  const skills = await Skill.find({ domainId: domain._id, isActive: true }).sort({
    nameEN: 1,
  });
  return skills.map((skill) => ({
    id: String(skill._id),
    nameFR: skill.nameFR,
    nameEN: skill.nameEN,
  }));
}

module.exports = {
  DISPLAY_NAME_MIN,
  DISPLAY_NAME_MAX,
  MAX_SELECTED_SKILLS,
  MAX_CUSTOM_SKILLS,
  CUSTOM_SKILL_MAX,
  BIOGRAPHY_MAX,
  LOCATION_MAX,
  PROFILE_STATUS,
  ContributorProfileError,
  AccountRegistrationError,
  ACCOUNT_FIELDS_REQUIRED,
  ACCOUNT_ALREADY_EXISTS,
  initialLifecycle,
  collectProfileFieldErrors,
  shapeProfile,
  createContributorProfile,
  getOwnProfile,
  getPublicProfile,
  listActiveDomains,
  listSkillsForDomain,
};
