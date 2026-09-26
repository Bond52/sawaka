const ContributorProfileService = require("../services/ContributorProfileService");
const { ContributorProfileError } = ContributorProfileService;
const {
  AccountRegistrationError,
} = require("../services/accountRegistration");
const {
  issueSessionToken,
  sessionCookieOptions,
} = require("../services/accountRegistration");
const {
  resendForAuthenticatedUser,
  consumeVerificationToken,
  UserEmailVerificationError,
} = require("../services/UserEmailVerificationService");

function sendFunctionalError(res, err) {
  const body = { error: { code: err.code } };
  if (err.fields) body.error.fields = err.fields;
  if (err.profileId) body.error.profileId = err.profileId;
  return res.status(err.status || 400).json(body);
}

function logContributorError(operation, err) {
  console.error(`contributor.controller.${operation}:`, {
    name: err && err.name,
    code: err && err.code,
  });
}

async function createContributor(req, res) {
  try {
    const result = await ContributorProfileService.createContributorProfile({
      authUserId: req.user ? req.user.id : null,
      body: req.body,
    });
    const profile = ContributorProfileService.shapeProfile(
      result.profile,
      result.domain,
      result.canonical,
      { includeLifecycle: true }
    );
    const payload = {
      profile,
      accountCreated: result.accountCreated,
      verificationRequired: result.verificationRequired === true,
      verificationEmailSent: result.verificationEmailSent === true,
    };

    if (result.accountCreated) {
      const token = issueSessionToken(result.user);
      res.cookie("token", token, sessionCookieOptions());
      payload.token = token;
      payload.roles = result.user.roles;
      payload.username = result.user.username;
    }

    return res.status(201).json(payload);
  } catch (err) {
    if (err instanceof ContributorProfileError || err instanceof AccountRegistrationError) {
      return sendFunctionalError(res, err);
    }
    logContributorError("createContributor", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function getOwnContributor(req, res) {
  try {
    const profile = await ContributorProfileService.getOwnProfile(req.user.id);
    return res.json({ profile });
  } catch (err) {
    if (err instanceof ContributorProfileError) {
      return sendFunctionalError(res, err);
    }
    logContributorError("getOwnContributor", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function getPublicContributor(req, res) {
  try {
    const profile = await ContributorProfileService.getPublicProfile(req.params.id);
    return res.json({ profile });
  } catch (err) {
    if (err instanceof ContributorProfileError) {
      return sendFunctionalError(res, err);
    }
    logContributorError("getPublicContributor", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function listDomains(_req, res) {
  try {
    const domains = await ContributorProfileService.listActiveDomains();
    return res.json({ domains });
  } catch (err) {
    logContributorError("listDomains", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function listDomainSkills(req, res) {
  try {
    const skills = await ContributorProfileService.listSkillsForDomain(
      req.params.domainId
    );
    return res.json({ skills });
  } catch (err) {
    if (err instanceof ContributorProfileError) {
      return sendFunctionalError(res, err);
    }
    logContributorError("listDomainSkills", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function resendVerificationEmail(req, res) {
  try {
    const result = await resendForAuthenticatedUser(req.user.id);
    return res.json(result);
  } catch (err) {
    if (err instanceof UserEmailVerificationError) {
      return sendFunctionalError(res, err);
    }
    logContributorError("resendVerificationEmail", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function verifyAccountEmail(req, res) {
  try {
    const result = await consumeVerificationToken(req.body && req.body.token);
    return res.json(result);
  } catch (err) {
    if (err instanceof UserEmailVerificationError) {
      return sendFunctionalError(res, err);
    }
    logContributorError("verifyAccountEmail", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

module.exports = {
  createContributor,
  getOwnContributor,
  getPublicContributor,
  listDomains,
  listDomainSkills,
  resendVerificationEmail,
  verifyAccountEmail,
};
