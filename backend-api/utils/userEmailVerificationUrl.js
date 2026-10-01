const { resolveAppOrigin } = require("./supplierActivationUrl");

function buildUserEmailVerificationUrl(token) {
  const origin = resolveAppOrigin();
  const path = process.env.USER_EMAIL_VERIFY_PATH || "/contributor/verify-email";
  const pathPart = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${pathPart}?token=${encodeURIComponent(token)}`;
}

module.exports = { buildUserEmailVerificationUrl };
