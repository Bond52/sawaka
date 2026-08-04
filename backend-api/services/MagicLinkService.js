const crypto = require("crypto");
const mongoose = require("mongoose");
const MagicLinkToken = require("../models/MagicLinkToken");

const TOKEN_BYTES = 32;

const PURPOSES = Object.freeze({
  SUPPLIER_ACTIVATION: "SUPPLIER_ACTIVATION",
  SUPPLIER_MANAGEMENT: "SUPPLIER_MANAGEMENT",
  CONTACT_EMAIL_VERIFICATION: "CONTACT_EMAIL_VERIFICATION",
});

/** Expiration window per purpose (ms). */
const TOKEN_TTL_MS = Object.freeze({
  [PURPOSES.SUPPLIER_ACTIVATION]: 24 * 60 * 60 * 1000,
  [PURPOSES.SUPPLIER_MANAGEMENT]: 60 * 60 * 1000,
  [PURPOSES.CONTACT_EMAIL_VERIFICATION]: 24 * 60 * 60 * 1000,
});

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function hashEmail(email) {
  return crypto.createHash("sha256").update(normalizeEmail(email), "utf8").digest("hex");
}

function hashesEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function isKnownPurpose(purpose) {
  return Object.values(PURPOSES).includes(purpose);
}

/**
 * Compatibility: legacy activation tokens have no `purpose` field.
 * Treat missing/null purpose as SUPPLIER_ACTIVATION only.
 */
function purposeMatches(tokenDoc, expectedPurpose) {
  const stored = tokenDoc.purpose;
  if (stored == null) {
    return expectedPurpose === PURPOSES.SUPPLIER_ACTIVATION;
  }
  return stored === expectedPurpose;
}

function purposeFilter(expectedPurpose) {
  if (expectedPurpose === PURPOSES.SUPPLIER_ACTIVATION) {
    return {
      $or: [
        { purpose: PURPOSES.SUPPLIER_ACTIVATION },
        { purpose: { $exists: false } },
        { purpose: null },
      ],
    };
  }
  return { purpose: expectedPurpose };
}

/**
 * Resolve a token document by hash first, then by legacy plaintext `token`.
 * Existing unexpired activation links remain valid until natural expiry.
 */
async function findTokenByRaw(rawToken) {
  const tokenHash = hashToken(rawToken);
  let tokenDoc = await MagicLinkToken.findOne({ tokenHash });
  if (tokenDoc) {
    return { tokenDoc, lookup: "hash" };
  }
  // Compatibility fallback for pre-hash tokens that stored the raw value.
  tokenDoc = await MagicLinkToken.findOne({ token: rawToken });
  if (tokenDoc) {
    return { tokenDoc, lookup: "legacy" };
  }
  return null;
}

function tokenIdentityFilter(rawToken) {
  const tokenHash = hashToken(rawToken);
  return {
    $or: [{ tokenHash }, { token: rawToken }],
  };
}

function toPublicTokenDoc(tokenDoc) {
  return {
    _id: tokenDoc._id,
    supplierId: tokenDoc.supplierId,
    purpose: tokenDoc.purpose || PURPOSES.SUPPLIER_ACTIVATION,
    expiresAt: tokenDoc.expiresAt,
    isUsed: tokenDoc.isUsed,
  };
}

const MagicLinkService = {
  PURPOSES,
  TOKEN_TTL_MS,

  /**
   * @param {{ supplierId: string|mongoose.Types.ObjectId, purpose: string, pendingEmail?: string }} params
   * @returns {Promise<{ rawToken: string, tokenDoc: object }>}
   *   `rawToken` is returned only to the caller for email delivery.
   *   The persisted document stores only `tokenHash` (plus optional boundEmailHash).
   */
  async generateToken({ supplierId, purpose, pendingEmail } = {}) {
    if (!mongoose.Types.ObjectId.isValid(supplierId)) {
      throw new Error("Invalid supplierId");
    }
    if (!isKnownPurpose(purpose)) {
      throw new Error("Invalid token purpose");
    }

    const ttlMs = TOKEN_TTL_MS[purpose];
    if (!ttlMs) {
      throw new Error("Invalid token purpose");
    }

    let boundEmailHash;
    if (purpose === PURPOSES.CONTACT_EMAIL_VERIFICATION) {
      if (!pendingEmail || typeof pendingEmail !== "string" || !pendingEmail.trim()) {
        throw new Error("pendingEmail is required for CONTACT_EMAIL_VERIFICATION");
      }
      boundEmailHash = hashEmail(pendingEmail);
    }

    const rawToken = crypto.randomBytes(TOKEN_BYTES).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + ttlMs);

    try {
      const tokenDoc = await MagicLinkToken.create({
        tokenHash,
        supplierId,
        purpose,
        expiresAt,
        ...(boundEmailHash ? { boundEmailHash } : {}),
      });

      return {
        rawToken,
        tokenDoc: toPublicTokenDoc(tokenDoc),
      };
    } catch (err) {
      if (err && err.code === 11000) {
        throw new Error("Failed to generate a unique magic link token");
      }
      if (err && err.name === "ValidationError") {
        throw new Error(err.message || "Magic link token validation failed");
      }
      throw err;
    }
  },

  /**
   * @param {string} rawToken
   * @param {string} purpose
   * @param {{ pendingEmail?: string }} [options]
   */
  async validateToken(rawToken, purpose, options = {}) {
    if (!rawToken || typeof rawToken !== "string") {
      return { valid: false, reason: "TOKEN_MISSING" };
    }
    if (!isKnownPurpose(purpose)) {
      return { valid: false, reason: "PURPOSE_MISMATCH" };
    }

    try {
      const found = await findTokenByRaw(rawToken);
      if (!found) {
        return { valid: false, reason: "NOT_FOUND" };
      }

      const { tokenDoc } = found;

      if (!purposeMatches(tokenDoc, purpose)) {
        return { valid: false, reason: "PURPOSE_MISMATCH" };
      }

      if (tokenDoc.isUsed) {
        return { valid: false, reason: "ALREADY_USED" };
      }

      if (tokenDoc.expiresAt.getTime() <= Date.now()) {
        return { valid: false, reason: "EXPIRED" };
      }

      if (purpose === PURPOSES.CONTACT_EMAIL_VERIFICATION) {
        const { pendingEmail } = options;
        if (!pendingEmail || typeof pendingEmail !== "string" || !pendingEmail.trim()) {
          return { valid: false, reason: "EMAIL_MISMATCH" };
        }
        if (
          !tokenDoc.boundEmailHash ||
          !hashesEqual(tokenDoc.boundEmailHash, hashEmail(pendingEmail))
        ) {
          return { valid: false, reason: "EMAIL_MISMATCH" };
        }
      }

      return { valid: true, tokenDoc: toPublicTokenDoc(tokenDoc) };
    } catch (err) {
      console.error("MagicLinkService.validateToken:", err);
      throw err;
    }
  },

  /**
   * Atomically mark a token as used. Purpose must match (with legacy activation
   * compatibility for missing purpose).
   *
   * @param {string} rawToken
   * @param {string} purpose
   */
  async consumeToken(rawToken, purpose) {
    if (!rawToken || typeof rawToken !== "string") {
      throw new Error("Invalid token");
    }
    if (!isKnownPurpose(purpose)) {
      throw new Error("Invalid token purpose");
    }

    let updated;
    try {
      updated = await MagicLinkToken.findOneAndUpdate(
        {
          $and: [
            tokenIdentityFilter(rawToken),
            purposeFilter(purpose),
            { isUsed: false },
            { expiresAt: { $gt: new Date() } },
          ],
        },
        { $set: { isUsed: true } },
        { new: true }
      );
    } catch (err) {
      console.error("MagicLinkService.consumeToken:", err);
      throw err;
    }

    if (!updated) {
      throw new Error(
        "Token cannot be consumed (missing, expired, or already used)"
      );
    }

    return toPublicTokenDoc(updated);
  },
};

module.exports = MagicLinkService;
