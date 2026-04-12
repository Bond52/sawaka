const crypto = require("crypto");
const mongoose = require("mongoose");
const MagicLinkToken = require("../models/MagicLinkToken");

const TWENTY_FOUR_H_MS = 24 * 60 * 60 * 1000;
const TOKEN_BYTES = 32;

const MagicLinkService = {
  async generateToken(supplierId) {
    if (!mongoose.Types.ObjectId.isValid(supplierId)) {
      throw new Error("Invalid supplierId");
    }

    const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
    const expiresAt = new Date(Date.now() + TWENTY_FOUR_H_MS);

    try {
      return await MagicLinkToken.create({
        token,
        supplierId,
        expiresAt,
      });
    } catch (err) {
      if (err && err.code === 11000) {
        throw new Error("Failed to generate a unique magic link token");
      }
      if (err && err.name === "ValidationError") {
        throw new Error(
          err.message || "Magic link token validation failed"
        );
      }
      throw err;
    }
  },

  async validateToken(token) {
    if (!token || typeof token !== "string") {
      return { valid: false, reason: "TOKEN_MISSING" };
    }

    try {
      const tokenDoc = await MagicLinkToken.findOne({ token });

      if (!tokenDoc) {
        return { valid: false, reason: "NOT_FOUND" };
      }

      if (tokenDoc.isUsed) {
        return { valid: false, reason: "ALREADY_USED" };
      }

      if (tokenDoc.expiresAt.getTime() <= Date.now()) {
        return { valid: false, reason: "EXPIRED" };
      }

      return { valid: true, tokenDoc };
    } catch (err) {
      console.error("MagicLinkService.validateToken:", err);
      throw err;
    }
  },

  async consumeToken(token) {
    if (!token || typeof token !== "string") {
      throw new Error("Invalid token");
    }

    let updated;
    try {
      updated = await MagicLinkToken.findOneAndUpdate(
        {
          token,
          isUsed: false,
          expiresAt: { $gt: new Date() },
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

    return updated;
  },
};

module.exports = MagicLinkService;
