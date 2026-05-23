jest.mock("../../models/Supplier");
jest.mock("../../models/MagicLinkToken");
jest.mock("../../utils/mailer");
jest.mock("../../services/MagicLinkService");

const mongoose = require("mongoose");
const Supplier = require("../../models/Supplier");
const MagicLinkToken = require("../../models/MagicLinkToken");
const transporter = require("../../utils/mailer");
const MagicLinkService = require("../../services/MagicLinkService");
const SupplierService = require("../../services/SupplierService");

describe("SupplierService", () => {
  const supplierId = new mongoose.Types.ObjectId();
  const tokenDocId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FRONTEND_URL = "https://app.example.com";
    process.env.MAIL_FROM = "noreply@example.com";
  });

  describe("createSupplier", () => {
    it("creates supplier, generates token, sends email, returns supplier", async () => {
      const supplierDoc = {
        _id: supplierId,
        accountEmail: "s@example.com",
        phone: "0612345678",
      };
      Supplier.create.mockResolvedValue(supplierDoc);
      MagicLinkService.generateToken.mockResolvedValue({
        _id: tokenDocId,
        token: "abc123token",
      });
      transporter.sendMail.mockResolvedValue({ messageId: "1" });

      const result = await SupplierService.createSupplier({
        accountEmail: "s@example.com",
        phone: "0612345678",
        companyName: "Acme",
      });

      expect(Supplier.create).toHaveBeenCalledWith(
        expect.objectContaining({
          accountEmail: "s@example.com",
          phone: "0612345678",
          companyName: "Acme",
          status: "Invited",
          isVisible: false,
        })
      );
      expect(MagicLinkService.generateToken).toHaveBeenCalledWith(supplierId);
      expect(transporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "s@example.com",
          text: expect.stringContaining(
            "https://app.example.com/supplier/activate?token=abc123token"
          ),
          html: expect.stringContaining(
            "https://app.example.com/supplier/activate?token=abc123token"
          ),
        })
      );
      expect(result).toBe(supplierDoc);
    });

    it("throws when accountEmail is missing", async () => {
      await expect(
        SupplierService.createSupplier({ phone: "0612345678" })
      ).rejects.toThrow("accountEmail is required");
      expect(Supplier.create).not.toHaveBeenCalled();
    });

    it("throws when phone is too short", async () => {
      await expect(
        SupplierService.createSupplier({
          accountEmail: "s@example.com",
          phone: "12345",
        })
      ).rejects.toThrow("phone must be at least 6 characters");
      expect(Supplier.create).not.toHaveBeenCalled();
    });

    it("throws when phone is missing", async () => {
      await expect(
        SupplierService.createSupplier({ accountEmail: "s@example.com" })
      ).rejects.toThrow("phone is required");
      expect(Supplier.create).not.toHaveBeenCalled();
    });

    it("throws when supplier payload is not an object", async () => {
      await expect(SupplierService.createSupplier(null)).rejects.toThrow(
        "Invalid supplier data"
      );
      expect(Supplier.create).not.toHaveBeenCalled();
    });

    it("throws with model message when account email format is invalid", async () => {
      const err = new Error("Invalid account email format");
      err.name = "ValidationError";
      Supplier.create.mockRejectedValue(err);
      await expect(
        SupplierService.createSupplier({
          accountEmail: "not-an-email",
          phone: "0612345678",
        })
      ).rejects.toThrow("Invalid account email format");
    });

    it("throws with model message when phone fails schema validation", async () => {
      const err = new Error("Invalid phone format");
      err.name = "ValidationError";
      Supplier.create.mockRejectedValue(err);
      await expect(
        SupplierService.createSupplier({
          accountEmail: "s@example.com",
          phone: "0612345678",
        })
      ).rejects.toThrow("Invalid phone format");
    });
  });

  describe("activateSupplier", () => {
    it("activates supplier and consumes token when validation succeeds", async () => {
      const updated = {
        _id: supplierId,
        status: "Active",
        isVisible: true,
      };
      MagicLinkService.validateToken.mockResolvedValue({
        valid: true,
        tokenDoc: { supplierId },
      });
      Supplier.findOneAndUpdate.mockResolvedValue(updated);
      MagicLinkService.consumeToken.mockResolvedValue({});

      const result = await SupplierService.activateSupplier("valid-token");

      expect(MagicLinkService.validateToken).toHaveBeenCalledWith(
        "valid-token"
      );
      expect(Supplier.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: supplierId, status: "Invited" },
        { $set: { status: "Active", isVisible: true } },
        { new: true }
      );
      expect(MagicLinkService.consumeToken).toHaveBeenCalledWith("valid-token");
      expect(result).toEqual(updated);
    });

    it("throws when token validation fails", async () => {
      MagicLinkService.validateToken.mockResolvedValue({
        valid: false,
        reason: "NOT_FOUND",
      });

      await expect(
        SupplierService.activateSupplier("bad")
      ).rejects.toThrow("Invalid magic link");

      expect(Supplier.findOneAndUpdate).not.toHaveBeenCalled();
      expect(MagicLinkService.consumeToken).not.toHaveBeenCalled();
    });

    it("throws Token required when validation reason is TOKEN_MISSING", async () => {
      MagicLinkService.validateToken.mockResolvedValue({
        valid: false,
        reason: "TOKEN_MISSING",
      });
      await expect(SupplierService.activateSupplier("")).rejects.toThrow(
        "Token required"
      );
      expect(Supplier.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("throws Magic link expired when validation reason is EXPIRED", async () => {
      MagicLinkService.validateToken.mockResolvedValue({
        valid: false,
        reason: "EXPIRED",
      });
      await expect(
        SupplierService.activateSupplier("expired-token")
      ).rejects.toThrow("Magic link expired");
    });

    it("throws Magic link already used when validation reason is ALREADY_USED", async () => {
      MagicLinkService.validateToken.mockResolvedValue({
        valid: false,
        reason: "ALREADY_USED",
      });
      await expect(
        SupplierService.activateSupplier("used-token")
      ).rejects.toThrow("Magic link already used");
    });

    it("throws when supplier is already active or not in Invited state", async () => {
      MagicLinkService.validateToken.mockResolvedValue({
        valid: true,
        tokenDoc: { supplierId },
      });
      Supplier.findOneAndUpdate.mockResolvedValue(null);
      await expect(
        SupplierService.activateSupplier("valid-shape-token")
      ).rejects.toThrow(
        "Supplier could not be activated (not found or no longer invited)"
      );
      expect(MagicLinkService.consumeToken).not.toHaveBeenCalled();
    });

    it("rethrows consumeToken error and rolls supplier back to Invited", async () => {
      MagicLinkService.validateToken.mockResolvedValue({
        valid: true,
        tokenDoc: { supplierId },
      });
      Supplier.findOneAndUpdate.mockResolvedValue({
        _id: supplierId,
        status: "Active",
        isVisible: true,
      });
      MagicLinkService.consumeToken.mockRejectedValue(
        new Error(
          "Token cannot be consumed (missing, expired, or already used)"
        )
      );
      Supplier.findByIdAndUpdate.mockResolvedValue({});

      await expect(
        SupplierService.activateSupplier("consume-fails")
      ).rejects.toThrow(
        "Token cannot be consumed (missing, expired, or already used)"
      );
      expect(Supplier.findByIdAndUpdate).toHaveBeenCalledWith(supplierId, {
        $set: { status: "Invited", isVisible: false },
      });
    });
  });
});
