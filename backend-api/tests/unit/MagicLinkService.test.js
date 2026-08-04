jest.mock("../../models/MagicLinkToken");

const crypto = require("crypto");
const mongoose = require("mongoose");
const MagicLinkToken = require("../../models/MagicLinkToken");
const MagicLinkService = require("../../services/MagicLinkService");

const { PURPOSES } = MagicLinkService;

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
}

function hashEmail(email) {
  return crypto
    .createHash("sha256")
    .update(String(email).trim().toLowerCase(), "utf8")
    .digest("hex");
}

describe("MagicLinkService", () => {
  const supplierId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateToken", () => {
    it("throws Invalid supplierId when supplierId is not a valid ObjectId", async () => {
      await expect(
        MagicLinkService.generateToken({
          supplierId: "not-a-valid-objectid",
          purpose: PURPOSES.SUPPLIER_ACTIVATION,
        })
      ).rejects.toThrow("Invalid supplierId");
      expect(MagicLinkToken.create).not.toHaveBeenCalled();
    });

    it("throws when purpose is missing or unknown", async () => {
      await expect(
        MagicLinkService.generateToken({ supplierId })
      ).rejects.toThrow("Invalid token purpose");
      await expect(
        MagicLinkService.generateToken({
          supplierId,
          purpose: "UNKNOWN_PURPOSE",
        })
      ).rejects.toThrow("Invalid token purpose");
      expect(MagicLinkToken.create).not.toHaveBeenCalled();
    });

    it("creates an activation token storing only the hash, not the raw token", async () => {
      MagicLinkToken.create.mockImplementation(async (doc) => ({
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        isUsed: false,
      }));

      const result = await MagicLinkService.generateToken({
        supplierId,
        purpose: PURPOSES.SUPPLIER_ACTIVATION,
      });

      expect(MagicLinkToken.create).toHaveBeenCalled();
      const arg = MagicLinkToken.create.mock.calls[0][0];
      expect(arg.supplierId).toEqual(supplierId);
      expect(arg.purpose).toBe(PURPOSES.SUPPLIER_ACTIVATION);
      expect(arg.token).toBeUndefined();
      expect(typeof arg.tokenHash).toBe("string");
      expect(arg.tokenHash).toBe(hashToken(result.rawToken));
      expect(arg.expiresAt).toBeInstanceOf(Date);
      expect(result.rawToken).toMatch(/^[a-f0-9]{64}$/);
      expect(result.tokenDoc).not.toHaveProperty("token");
      expect(result.tokenDoc).not.toHaveProperty("tokenHash");
      expect(result.tokenDoc.purpose).toBe(PURPOSES.SUPPLIER_ACTIVATION);
    });

    it("creates a management token with the management TTL and purpose", async () => {
      const before = Date.now();
      MagicLinkToken.create.mockImplementation(async (doc) => ({
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        isUsed: false,
      }));

      const result = await MagicLinkService.generateToken({
        supplierId,
        purpose: PURPOSES.SUPPLIER_MANAGEMENT,
      });

      const arg = MagicLinkToken.create.mock.calls[0][0];
      expect(arg.purpose).toBe(PURPOSES.SUPPLIER_MANAGEMENT);
      expect(arg.tokenHash).toBe(hashToken(result.rawToken));
      expect(arg.token).toBeUndefined();
      const ttl = arg.expiresAt.getTime() - before;
      expect(ttl).toBeGreaterThan(55 * 60 * 1000);
      expect(ttl).toBeLessThanOrEqual(
        MagicLinkService.TOKEN_TTL_MS[PURPOSES.SUPPLIER_MANAGEMENT] + 5000
      );
    });

    it("creates a contact-email verification token bound to the pending email hash", async () => {
      MagicLinkToken.create.mockImplementation(async (doc) => ({
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        isUsed: false,
      }));

      const pendingEmail = "  New.Contact@Example.com ";
      const result = await MagicLinkService.generateToken({
        supplierId,
        purpose: PURPOSES.CONTACT_EMAIL_VERIFICATION,
        pendingEmail,
      });

      const arg = MagicLinkToken.create.mock.calls[0][0];
      expect(arg.purpose).toBe(PURPOSES.CONTACT_EMAIL_VERIFICATION);
      expect(arg.tokenHash).toBe(hashToken(result.rawToken));
      expect(arg.boundEmailHash).toBe(hashEmail(pendingEmail));
      expect(arg.boundEmailHash).not.toContain("@");
      expect(result.tokenDoc).not.toHaveProperty("boundEmailHash");
    });

    it("requires pendingEmail for CONTACT_EMAIL_VERIFICATION", async () => {
      await expect(
        MagicLinkService.generateToken({
          supplierId,
          purpose: PURPOSES.CONTACT_EMAIL_VERIFICATION,
        })
      ).rejects.toThrow(
        "pendingEmail is required for CONTACT_EMAIL_VERIFICATION"
      );
      expect(MagicLinkToken.create).not.toHaveBeenCalled();
    });
  });

  describe("validateToken", () => {
    it("returns TOKEN_MISSING when token is empty", async () => {
      await expect(
        MagicLinkService.validateToken("", PURPOSES.SUPPLIER_ACTIVATION)
      ).resolves.toEqual({
        valid: false,
        reason: "TOKEN_MISSING",
      });
      expect(MagicLinkToken.findOne).not.toHaveBeenCalled();
    });

    it("returns TOKEN_MISSING when token is not a string", async () => {
      await expect(
        MagicLinkService.validateToken(null, PURPOSES.SUPPLIER_ACTIVATION)
      ).resolves.toEqual({
        valid: false,
        reason: "TOKEN_MISSING",
      });
      expect(MagicLinkToken.findOne).not.toHaveBeenCalled();
    });

    it("returns PURPOSE_MISMATCH when purpose argument is unknown", async () => {
      const result = await MagicLinkService.validateToken(
        "some-token",
        "NOT_A_PURPOSE"
      );
      expect(result).toEqual({ valid: false, reason: "PURPOSE_MISMATCH" });
      expect(MagicLinkToken.findOne).not.toHaveBeenCalled();
    });

    it("returns NOT_FOUND when no token document exists", async () => {
      MagicLinkToken.findOne.mockResolvedValue(null);
      const result = await MagicLinkService.validateToken(
        "unknown-token",
        PURPOSES.SUPPLIER_ACTIVATION
      );
      expect(result).toEqual({ valid: false, reason: "NOT_FOUND" });
    });

    it("looks up new tokens by hash and returns a sanitized public tokenDoc", async () => {
      const raw = "a".repeat(64);
      const tokenDoc = {
        _id: new mongoose.Types.ObjectId(),
        tokenHash: hashToken(raw),
        purpose: PURPOSES.SUPPLIER_ACTIVATION,
        supplierId,
        isUsed: false,
        expiresAt: new Date(Date.now() + 60000),
      };
      MagicLinkToken.findOne.mockImplementation(async (query) => {
        if (query.tokenHash === hashToken(raw)) return tokenDoc;
        return null;
      });

      const result = await MagicLinkService.validateToken(
        raw,
        PURPOSES.SUPPLIER_ACTIVATION
      );

      expect(result.valid).toBe(true);
      expect(result.tokenDoc.supplierId).toEqual(supplierId);
      expect(result.tokenDoc).not.toHaveProperty("token");
      expect(result.tokenDoc).not.toHaveProperty("tokenHash");
    });

    it("accepts legacy plaintext activation tokens without purpose (compatibility)", async () => {
      // Compatibility: tokens issued before hashing/purpose stored the raw value
      // in `token` and omitted `purpose`. They remain valid for SUPPLIER_ACTIVATION
      // until expiry so existing unexpired activation emails keep working.
      const raw = "legacy-plaintext-token";
      const tokenDoc = {
        _id: new mongoose.Types.ObjectId(),
        token: raw,
        supplierId,
        isUsed: false,
        expiresAt: new Date(Date.now() + 60000),
      };
      MagicLinkToken.findOne.mockImplementation(async (query) => {
        if (query.tokenHash) return null;
        if (query.token === raw) return tokenDoc;
        return null;
      });

      const result = await MagicLinkService.validateToken(
        raw,
        PURPOSES.SUPPLIER_ACTIVATION
      );

      expect(result.valid).toBe(true);
      expect(result.tokenDoc.purpose).toBe(PURPOSES.SUPPLIER_ACTIVATION);
    });

    it("rejects legacy tokens when purpose is not SUPPLIER_ACTIVATION", async () => {
      const raw = "legacy-plaintext-token";
      const tokenDoc = {
        _id: new mongoose.Types.ObjectId(),
        token: raw,
        supplierId,
        isUsed: false,
        expiresAt: new Date(Date.now() + 60000),
      };
      MagicLinkToken.findOne.mockImplementation(async (query) => {
        if (query.tokenHash) return null;
        if (query.token === raw) return tokenDoc;
        return null;
      });

      const result = await MagicLinkService.validateToken(
        raw,
        PURPOSES.SUPPLIER_MANAGEMENT
      );

      expect(result).toEqual({ valid: false, reason: "PURPOSE_MISMATCH" });
    });

    it("returns PURPOSE_MISMATCH when stored purpose does not match", async () => {
      const raw = "b".repeat(64);
      MagicLinkToken.findOne.mockResolvedValue({
        tokenHash: hashToken(raw),
        purpose: PURPOSES.SUPPLIER_MANAGEMENT,
        isUsed: false,
        expiresAt: new Date(Date.now() + 60000),
        supplierId,
      });

      const result = await MagicLinkService.validateToken(
        raw,
        PURPOSES.SUPPLIER_ACTIVATION
      );

      expect(result).toEqual({ valid: false, reason: "PURPOSE_MISMATCH" });
    });

    it("returns EXPIRED when expiresAt is in the past", async () => {
      MagicLinkToken.findOne.mockResolvedValue({
        tokenHash: "x",
        purpose: PURPOSES.SUPPLIER_ACTIVATION,
        isUsed: false,
        expiresAt: new Date(Date.now() - 1000),
        supplierId,
      });

      const result = await MagicLinkService.validateToken(
        "t2",
        PURPOSES.SUPPLIER_ACTIVATION
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("EXPIRED");
    });

    it("returns ALREADY_USED when token is used", async () => {
      MagicLinkToken.findOne.mockResolvedValue({
        tokenHash: "x",
        purpose: PURPOSES.SUPPLIER_ACTIVATION,
        isUsed: true,
        expiresAt: new Date(Date.now() + 60000),
        supplierId,
      });

      const result = await MagicLinkService.validateToken(
        "t3",
        PURPOSES.SUPPLIER_ACTIVATION
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("ALREADY_USED");
    });

    it("enforces pending-email binding for CONTACT_EMAIL_VERIFICATION", async () => {
      const raw = "c".repeat(64);
      const bound = hashEmail("pending@example.com");
      MagicLinkToken.findOne.mockResolvedValue({
        tokenHash: hashToken(raw),
        purpose: PURPOSES.CONTACT_EMAIL_VERIFICATION,
        boundEmailHash: bound,
        isUsed: false,
        expiresAt: new Date(Date.now() + 60000),
        supplierId,
      });

      await expect(
        MagicLinkService.validateToken(raw, PURPOSES.CONTACT_EMAIL_VERIFICATION, {
          pendingEmail: "other@example.com",
        })
      ).resolves.toEqual({ valid: false, reason: "EMAIL_MISMATCH" });

      await expect(
        MagicLinkService.validateToken(raw, PURPOSES.CONTACT_EMAIL_VERIFICATION, {
          pendingEmail: "  Pending@Example.com ",
        })
      ).resolves.toMatchObject({ valid: true });
    });
  });

  describe("consumeToken", () => {
    it("throws Invalid token when token is missing or not a string", async () => {
      await expect(
        MagicLinkService.consumeToken("", PURPOSES.SUPPLIER_ACTIVATION)
      ).rejects.toThrow("Invalid token");
      await expect(
        MagicLinkService.consumeToken(null, PURPOSES.SUPPLIER_ACTIVATION)
      ).rejects.toThrow("Invalid token");
      expect(MagicLinkToken.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("throws when token cannot be consumed (missing, expired, or already used)", async () => {
      MagicLinkToken.findOneAndUpdate.mockResolvedValue(null);
      await expect(
        MagicLinkService.consumeToken("dead-token", PURPOSES.SUPPLIER_ACTIVATION)
      ).rejects.toThrow(
        "Token cannot be consumed (missing, expired, or already used)"
      );
    });

    it("atomically marks token used via findOneAndUpdate with hash identity and purpose", async () => {
      const raw = "d".repeat(64);
      const updated = {
        _id: new mongoose.Types.ObjectId(),
        tokenHash: hashToken(raw),
        purpose: PURPOSES.SUPPLIER_ACTIVATION,
        supplierId,
        isUsed: true,
        expiresAt: new Date(Date.now() + 60000),
      };
      MagicLinkToken.findOneAndUpdate.mockResolvedValue(updated);

      const result = await MagicLinkService.consumeToken(
        raw,
        PURPOSES.SUPPLIER_ACTIVATION
      );

      expect(MagicLinkToken.findOneAndUpdate).toHaveBeenCalledWith(
        {
          $and: [
            {
              $or: [{ tokenHash: hashToken(raw) }, { token: raw }],
            },
            {
              $or: [
                { purpose: PURPOSES.SUPPLIER_ACTIVATION },
                { purpose: { $exists: false } },
                { purpose: null },
              ],
            },
            { isUsed: false },
            { expiresAt: { $gt: expect.any(Date) } },
          ],
        },
        { $set: { isUsed: true } },
        { new: true }
      );
      expect(result.isUsed).toBe(true);
      expect(result).not.toHaveProperty("tokenHash");
    });

    it("consumes management tokens with an exact purpose filter", async () => {
      const raw = "e".repeat(64);
      MagicLinkToken.findOneAndUpdate.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        purpose: PURPOSES.SUPPLIER_MANAGEMENT,
        supplierId,
        isUsed: true,
        expiresAt: new Date(Date.now() + 60000),
      });

      await MagicLinkService.consumeToken(raw, PURPOSES.SUPPLIER_MANAGEMENT);

      const filter = MagicLinkToken.findOneAndUpdate.mock.calls[0][0];
      expect(filter.$and).toEqual(
        expect.arrayContaining([
          { purpose: PURPOSES.SUPPLIER_MANAGEMENT },
          { isUsed: false },
        ])
      );
    });
  });
});
