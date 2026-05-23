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

function buildSupplierActivationUrl(token) {
  const origin = resolveAppOrigin();
  const path = process.env.SUPPLIER_MAGIC_LINK_PATH || "/supplier/activate";
  const pathPart = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${pathPart}?token=${encodeURIComponent(token)}`;
}

module.exports = { resolveAppOrigin, buildSupplierActivationUrl, DEFAULT_ORIGIN };
