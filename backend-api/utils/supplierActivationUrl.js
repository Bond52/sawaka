const DEFAULT_ORIGIN = "https://qa.sawaka.org";

function resolveAppOrigin() {
  const raw = (
    process.env.FRONTEND_URL ||
    process.env.APP_BASE_URL ||
    DEFAULT_ORIGIN
  )
    .trim()
    .replace(/\/$/, "");
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function buildTokenUrl(token, pathEnvKey, defaultPath) {
  const origin = resolveAppOrigin();
  const path = process.env[pathEnvKey] || defaultPath;
  const pathPart = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${pathPart}?token=${encodeURIComponent(token)}`;
}

function buildSupplierActivationUrl(token) {
  return buildTokenUrl(token, "SUPPLIER_MAGIC_LINK_PATH", "/supplier/activate");
}

function buildSupplierManagementUrl(token) {
  return buildTokenUrl(
    token,
    "SUPPLIER_MANAGEMENT_LINK_PATH",
    "/supplier/manage"
  );
}

function buildContactEmailVerificationUrl(token) {
  return buildTokenUrl(
    token,
    "SUPPLIER_CONTACT_EMAIL_VERIFY_PATH",
    "/supplier/verify-email"
  );
}

module.exports = {
  resolveAppOrigin,
  buildSupplierActivationUrl,
  buildSupplierManagementUrl,
  buildContactEmailVerificationUrl,
  DEFAULT_ORIGIN,
};
