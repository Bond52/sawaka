const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const SupplierManagementSession = require("../models/SupplierManagementSession");

/** Management sessions expire after 1 hour (aligned with SUPPLIER_MANAGEMENT magic-link TTL). */
const MANAGEMENT_SESSION_TTL = "1h";
const MANAGEMENT_SESSION_TTL_MS = 60 * 60 * 1000;
const TOKEN_TYPE = "SUPPLIER_MANAGEMENT";

const SAFE_UNAUTHORIZED = { error: "Management session required" };
const SAFE_INVALID = { error: "Management session is invalid or expired" };

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
}

/**
 * Create a management session JWT + persisted session row for a supplier.
 * @param {string} supplierId
 * @returns {Promise<{ token: string, expiresAt: Date, jti: string }>}
 */
async function createManagementSession(supplierId) {
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + MANAGEMENT_SESSION_TTL_MS);

  await SupplierManagementSession.create({
    jti,
    supplierId,
    expiresAt,
  });

  const token = jwt.sign(
    {
      supplierId: String(supplierId),
      typ: TOKEN_TYPE,
      jti,
    },
    getJwtSecret(),
    { expiresIn: MANAGEMENT_SESSION_TTL }
  );

  return { token, expiresAt, jti };
}

/**
 * Invalidate all active management sessions for a supplier.
 * @param {string|mongoose.Types.ObjectId} supplierId
 */
async function invalidateSessionsForSupplier(supplierId) {
  await SupplierManagementSession.updateMany(
    {
      supplierId,
      invalidatedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { invalidatedAt: new Date() } }
  );
}

/**
 * Invalidate a single session by jti.
 * @param {string} jti
 */
async function invalidateSessionByJti(jti) {
  if (!jti) return;
  await SupplierManagementSession.updateOne(
    { jti, invalidatedAt: null },
    { $set: { invalidatedAt: new Date() } }
  );
}

function extractBearerToken(req) {
  const bearer = req.headers.authorization;
  if (bearer && bearer.startsWith("Bearer ")) {
    return bearer.slice(7).trim();
  }
  return null;
}

/**
 * Express middleware: requires a valid supplier-management session.
 * Sets `req.managementSession = { supplierId, jti }`.
 */
async function requireSupplierManagementSession(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json(SAFE_UNAUTHORIZED);
  }

  let payload;
  try {
    payload = jwt.verify(token, getJwtSecret());
  } catch {
    return res.status(401).json(SAFE_INVALID);
  }

  if (
    !payload ||
    payload.typ !== TOKEN_TYPE ||
    typeof payload.supplierId !== "string" ||
    typeof payload.jti !== "string"
  ) {
    return res.status(401).json(SAFE_INVALID);
  }

  try {
    const session = await SupplierManagementSession.findOne({
      jti: payload.jti,
      supplierId: payload.supplierId,
    }).lean();

    if (
      !session ||
      session.invalidatedAt ||
      !(session.expiresAt instanceof Date
        ? session.expiresAt.getTime() > Date.now()
        : new Date(session.expiresAt).getTime() > Date.now())
    ) {
      return res.status(401).json(SAFE_INVALID);
    }

    req.managementSession = {
      supplierId: payload.supplierId,
      jti: payload.jti,
    };
    return next();
  } catch (err) {
    console.error("requireSupplierManagementSession:", {
      name: err && err.name,
      message: err && err.message,
    });
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

module.exports = {
  TOKEN_TYPE,
  MANAGEMENT_SESSION_TTL,
  MANAGEMENT_SESSION_TTL_MS,
  createManagementSession,
  invalidateSessionsForSupplier,
  invalidateSessionByJti,
  requireSupplierManagementSession,
};
