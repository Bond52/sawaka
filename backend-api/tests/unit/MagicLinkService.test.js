jest.mock("../../models/MagicLinkToken");

const mongoose = require("mongoose");
const MagicLinkToken = require("../../models/MagicLinkToken");
const MagicLinkService = require("../../services/MagicLinkService");

describe("MagicLinkService", () => {
  const supplierId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateToken", () => {
    it("throws Invalid supplierId when supplierId is not a valid ObjectId", async () => {
      await expect(
        MagicLinkService.generateToken("not-a-valid-objectid")
      ).rejects.toThrow("Invalid supplierId");
      expect(MagicLinkToken.create).not.toHaveBeenCalled();
    });

    it("creates a token document with supplierId and expiry", async () => {
      MagicLinkToken.create.mockImplementation(async (doc) => ({
        ...doc,
        _id: new mongoose.Types.ObjectId(),
      }));

      const result = await MagicLinkService.generateToken(supplierId);

      expect(MagicLinkToken.create).toHaveBeenCalled();
      const arg = MagicLinkToken.create.mock.calls[0][0];
      expect(arg.supplierId).toEqual(supplierId);
      expect(typeof arg.token).toBe("string");
      expect(arg.token.length).toBeGreaterThan(0);
      expect(arg.expiresAt).toBeInstanceOf(Date);
      expect(result.token).toBe(arg.token);
    });
  });

  describe("validateToken", () => {
    it("returns TOKEN_MISSING when token is empty", async () => {
      await expect(MagicLinkService.validateToken("")).resolves.toEqual({
        valid: false,
        reason: "TOKEN_MISSING",
      });
      expect(MagicLinkToken.findOne).not.toHaveBeenCalled();
    });

    it("returns TOKEN_MISSING when token is not a string", async () => {
      await expect(
        MagicLinkService.validateToken(null)
      ).resolves.toEqual({
        valid: false,
        reason: "TOKEN_MISSING",
      });
      expect(MagicLinkToken.findOne).not.toHaveBeenCalled();
    });

    it("returns NOT_FOUND when no token document exists", async () => {
      MagicLinkToken.findOne.mockResolvedValue(null);
      const result = await MagicLinkService.validateToken("unknown-token");
      expect(result).toEqual({ valid: false, reason: "NOT_FOUND" });
    });

    it("returns valid true for active unused token", async () => {
      const tokenDoc = {
        token: "t1",
        isUsed: false,
        expiresAt: new Date(Date.now() + 60000),
      };
      MagicLinkToken.findOne.mockResolvedValue(tokenDoc);

      const result = await MagicLinkService.validateToken("t1");

      expect(result.valid).toBe(true);
      expect(result.tokenDoc).toBe(tokenDoc);
    });

    it("returns EXPIRED when expiresAt is in the past", async () => {
      MagicLinkToken.findOne.mockResolvedValue({
        token: "t2",
        isUsed: false,
        expiresAt: new Date(Date.now() - 1000),
      });

      const result = await MagicLinkService.validateToken("t2");

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("EXPIRED");
    });

    it("returns ALREADY_USED when token is used", async () => {
      MagicLinkToken.findOne.mockResolvedValue({
        token: "t3",
        isUsed: true,
        expiresAt: new Date(Date.now() + 60000),
      });

      const result = await MagicLinkService.validateToken("t3");

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("ALREADY_USED");
    });
  });

  describe("consumeToken", () => {
    it("throws Invalid token when token is missing or not a string", async () => {
      await expect(MagicLinkService.consumeToken("")).rejects.toThrow(
        "Invalid token"
      );
      await expect(MagicLinkService.consumeToken(null)).rejects.toThrow(
        "Invalid token"
      );
      expect(MagicLinkToken.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("throws when token cannot be consumed (missing, expired, or already used)", async () => {
      MagicLinkToken.findOneAndUpdate.mockResolvedValue(null);
      await expect(MagicLinkService.consumeToken("dead-token")).rejects.toThrow(
        "Token cannot be consumed (missing, expired, or already used)"
      );
    });

    it("marks token used and returns updated document", async () => {
      const updated = { token: "t4", isUsed: true };
      MagicLinkToken.findOneAndUpdate.mockResolvedValue(updated);

      const result = await MagicLinkService.consumeToken("t4");

      expect(MagicLinkToken.findOneAndUpdate).toHaveBeenCalledWith(
        {
          token: "t4",
          isUsed: false,
          expiresAt: { $gt: expect.any(Date) },
        },
        { $set: { isUsed: true } },
        { new: true }
      );
      expect(result).toBe(updated);
    });
  });
});
