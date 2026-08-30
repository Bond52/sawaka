jest.mock("../../models/Supplier");
jest.mock("../../models/MagicLinkToken");
jest.mock("../../services/MagicLinkService");
jest.mock("../../services/EmailService");
jest.mock("../../middleware/supplierManagementSession", () => ({
  createManagementSession: jest.fn(),
  requireSupplierManagementSession: jest.fn((req, res, next) => next()),
  invalidateSessionsForSupplier: jest.fn(),
  invalidateSessionByJti: jest.fn(),
  TOKEN_TYPE: "SUPPLIER_MANAGEMENT",
  MANAGEMENT_SESSION_TTL: "1h",
  MANAGEMENT_SESSION_TTL_MS: 3600000,
}));

const mongoose = require("mongoose");
const Supplier = require("../../models/Supplier");
const MagicLinkToken = require("../../models/MagicLinkToken");
const MagicLinkService = require("../../services/MagicLinkService");
const EmailService = require("../../services/EmailService");
const {
  createManagementSession,
} = require("../../middleware/supplierManagementSession");
const SupplierService = require("../../services/SupplierService");

describe("SupplierService", () => {
  const supplierId = new mongoose.Types.ObjectId();
  const tokenDocId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FRONTEND_URL = "https://app.example.com";
    process.env.MAIL_FROM = "noreply@example.com";
    MagicLinkService.PURPOSES = {
      SUPPLIER_ACTIVATION: "SUPPLIER_ACTIVATION",
      SUPPLIER_MANAGEMENT: "SUPPLIER_MANAGEMENT",
      CONTACT_EMAIL_VERIFICATION: "CONTACT_EMAIL_VERIFICATION",
    };
  });

  describe("createSupplier", () => {
    it("creates supplier, generates activation token, sends email via EmailService", async () => {
      const supplierDoc = {
        _id: supplierId,
        accountEmail: "s@example.com",
        phone: "0612345678",
      };
      Supplier.create.mockResolvedValue(supplierDoc);
      MagicLinkService.generateToken.mockResolvedValue({
        rawToken: "abc123token",
        tokenDoc: { _id: tokenDocId },
      });
      EmailService.sendSupplierActivationEmail.mockResolvedValue(true);

      const result = await SupplierService.createSupplier({
        accountEmail: "s@example.com",
        phone: "0612345678",
        companyName: "Acme",
        categories: ["construction_materials"],
      });

      expect(Supplier.create).toHaveBeenCalledWith(
        expect.objectContaining({
          accountEmail: "s@example.com",
          phone: "0612345678",
          companyName: "Acme",
          categories: ["construction_materials"],
          status: "Invited",
          isVisible: false,
        })
      );
      expect(MagicLinkService.generateToken).toHaveBeenCalledWith({
        supplierId,
        purpose: "SUPPLIER_ACTIVATION",
      });
      expect(EmailService.sendSupplierActivationEmail).toHaveBeenCalledWith(
        "s@example.com",
        "abc123token"
      );
      expect(result).toBe(supplierDoc);
    });

    it("creates supplier with multiple categories", async () => {
      const supplierDoc = {
        _id: supplierId,
        accountEmail: "s@example.com",
        phone: "0612345678",
        categories: ["construction_materials", "wood_lumber"],
      };
      Supplier.create.mockResolvedValue(supplierDoc);
      MagicLinkService.generateToken.mockResolvedValue({
        rawToken: "abc123token",
        tokenDoc: { _id: tokenDocId },
      });
      EmailService.sendSupplierActivationEmail.mockResolvedValue(true);

      const result = await SupplierService.createSupplier({
        accountEmail: "s@example.com",
        phone: "0612345678",
        categories: ["construction_materials", "wood_lumber"],
      });

      expect(Supplier.create).toHaveBeenCalledWith(
        expect.objectContaining({
          categories: ["construction_materials", "wood_lumber"],
        })
      );
      expect(result).toBe(supplierDoc);
    });

    it("throws when categories is missing", async () => {
      await expect(
        SupplierService.createSupplier({
          accountEmail: "s@example.com",
          phone: "0612345678",
        })
      ).rejects.toMatchObject({
        message: "categories is required",
        errors: { categories: "At least one category is required" },
      });
      expect(Supplier.create).not.toHaveBeenCalled();
    });

    it("throws when categories is an empty array", async () => {
      await expect(
        SupplierService.createSupplier({
          accountEmail: "s@example.com",
          phone: "0612345678",
          categories: [],
        })
      ).rejects.toMatchObject({
        message: "categories is required",
        errors: { categories: "At least one category is required" },
      });
      expect(Supplier.create).not.toHaveBeenCalled();
    });

    it("throws when categories is null", async () => {
      await expect(
        SupplierService.createSupplier({
          accountEmail: "s@example.com",
          phone: "0612345678",
          categories: null,
        })
      ).rejects.toMatchObject({
        message: "categories is required",
        errors: { categories: "At least one category is required" },
      });
      expect(Supplier.create).not.toHaveBeenCalled();
    });

    it("throws when accountEmail is missing", async () => {
      await expect(
        SupplierService.createSupplier({
          phone: "0612345678",
          categories: ["construction_materials"],
        })
      ).rejects.toThrow("accountEmail is required");
      expect(Supplier.create).not.toHaveBeenCalled();
    });

    it("throws when phone is too short", async () => {
      await expect(
        SupplierService.createSupplier({
          accountEmail: "s@example.com",
          phone: "12345",
          categories: ["construction_materials"],
        })
      ).rejects.toThrow("phone must be at least 6 characters");
      expect(Supplier.create).not.toHaveBeenCalled();
    });

    it("throws when phone is missing", async () => {
      await expect(
        SupplierService.createSupplier({
          accountEmail: "s@example.com",
          categories: ["construction_materials"],
        })
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
          categories: ["construction_materials"],
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
          categories: ["construction_materials"],
        })
      ).rejects.toThrow("Invalid phone format");
    });
  });

  describe("activateSupplier", () => {
    it("activates supplier and consumes activation token when validation succeeds", async () => {
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
        "valid-token",
        "SUPPLIER_ACTIVATION"
      );
      expect(Supplier.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: supplierId, status: "Invited" },
        { $set: { status: "Active", isVisible: true } },
        { new: true }
      );
      expect(MagicLinkService.consumeToken).toHaveBeenCalledWith(
        "valid-token",
        "SUPPLIER_ACTIVATION"
      );
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

  describe("getPublicDirectory", () => {
    it("returns active and visible suppliers as public DTOs", async () => {
      const id = new mongoose.Types.ObjectId();
      Supplier.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([
              {
                _id: id,
                name: "Acme Supplies",
                categories: ["wood_lumber"],
                country: "CM",
                region: "Centre",
                city: "Yaoundé",
                address: "  12 Main St  ",
                postalCode: "12345",
                publicEmail: "contact@acme.com",
                phone: "0612345678",
                website: "https://acme.com",
              },
            ]),
          }),
        }),
      });

      const result = await SupplierService.getPublicDirectory();

      expect(Supplier.find).toHaveBeenCalledWith({
        status: "Active",
        isVisible: true,
      });
      expect(result).toEqual([
        {
          id: id.toString(),
          name: "Acme Supplies",
          categories: ["wood_lumber"],
          country: "CM",
          region: "Centre",
          city: "Yaoundé",
          address: "12 Main St",
          postalCode: "12345",
          publicEmail: "contact@acme.com",
          phone: "0612345678",
          website: "https://acme.com",
        },
      ]);
    });

    it("omits optional public fields when not available", async () => {
      const id = new mongoose.Types.ObjectId();
      Supplier.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([
              {
                _id: id,
                name: "Minimal Co",
                categories: ["construction_materials"],
                country: "CM",
                region: "",
                city: "Douala",
                address: "",
                postalCode: "   ",
                publicEmail: "",
                phone: "0699999999",
                website: "",
              },
            ]),
          }),
        }),
      });

      const result = await SupplierService.getPublicDirectory();

      expect(result).toEqual([
        {
          id: id.toString(),
          name: "Minimal Co",
          categories: ["construction_materials"],
          country: "CM",
          city: "Douala",
          phone: "0699999999",
        },
      ]);
    });

    it.each([
      ["null", { region: null }],
      ["undefined", {}],
      ["empty string", { region: "" }],
      ["whitespace-only", { region: "   " }],
    ])("omits region when %s", async (_label, regionField) => {
      const id = new mongoose.Types.ObjectId();
      Supplier.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([
              {
                _id: id,
                name: "No Region Co",
                categories: ["construction_materials"],
                country: "CM",
                city: "Douala",
                phone: "0699999999",
                ...regionField,
              },
            ]),
          }),
        }),
      });

      const result = await SupplierService.getPublicDirectory();

      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty("region");
    });

    it("includes region when provided", async () => {
      const id = new mongoose.Types.ObjectId();
      Supplier.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([
              {
                _id: id,
                name: "Regional Co",
                categories: ["construction_materials"],
                country: "CM",
                region: "  Littoral  ",
                city: "Douala",
                phone: "0699999999",
              },
            ]),
          }),
        }),
      });

      const result = await SupplierService.getPublicDirectory();

      expect(result[0].region).toBe("Littoral");
    });

    it("returns an empty array when no public suppliers exist", async () => {
      Supplier.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await SupplierService.getPublicDirectory();

      expect(result).toEqual([]);
    });

    it("filters by case-insensitive partial name search", async () => {
      Supplier.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await SupplierService.getPublicDirectory({ search: "acme" });

      expect(Supplier.find).toHaveBeenCalledWith({
        status: "Active",
        isVisible: true,
        name: { $regex: "acme", $options: "i" },
      });
    });

    it("filters by category", async () => {
      Supplier.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await SupplierService.getPublicDirectory({ category: "wood_lumber" });

      expect(Supplier.find).toHaveBeenCalledWith({
        status: "Active",
        isVisible: true,
        categories: "wood_lumber",
      });
    });

    it("combines name search and category filters", async () => {
      Supplier.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await SupplierService.getPublicDirectory({
        search: "Acme",
        category: "wood_lumber",
      });

      expect(Supplier.find).toHaveBeenCalledWith({
        status: "Active",
        isVisible: true,
        name: { $regex: "Acme", $options: "i" },
        categories: "wood_lumber",
      });
    });

    it("escapes regex special characters in search", async () => {
      Supplier.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await SupplierService.getPublicDirectory({ search: "Acme (Ltd.)" });

      expect(Supplier.find).toHaveBeenCalledWith({
        status: "Active",
        isVisible: true,
        name: { $regex: "Acme \\(Ltd\\.\\)", $options: "i" },
      });
    });

    it("propagates unexpected repository failures for directory retrieval", async () => {
      Supplier.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockRejectedValue(new Error("mongo timeout")),
          }),
        }),
      });

      await expect(SupplierService.getPublicDirectory()).rejects.toThrow(
        "mongo timeout"
      );
    });

    it("propagates unexpected repository failures for search", async () => {
      Supplier.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest
              .fn()
              .mockRejectedValue(new Error("collection suppliers unavailable")),
          }),
        }),
      });

      await expect(
        SupplierService.getPublicDirectory({ search: "acme" })
      ).rejects.toThrow("collection suppliers unavailable");
    });
  });

  describe("parsePublicDirectoryQuery", () => {
    it("returns empty filters when no query params are provided", () => {
      expect(SupplierService.parsePublicDirectoryQuery({})).toEqual({});
    });

    it("trims search and ignores whitespace-only values", () => {
      expect(
        SupplierService.parsePublicDirectoryQuery({ search: "  acme  " })
      ).toEqual({ search: "acme" });
      expect(
        SupplierService.parsePublicDirectoryQuery({ search: "   " })
      ).toEqual({});
    });

    it("trims category and ignores whitespace-only values", () => {
      expect(
        SupplierService.parsePublicDirectoryQuery({
          category: " wood_lumber ",
        })
      ).toEqual({ category: "wood_lumber" });
      expect(
        SupplierService.parsePublicDirectoryQuery({ category: "   " })
      ).toEqual({});
    });

    it("throws when search is not a string", () => {
      expect(() =>
        SupplierService.parsePublicDirectoryQuery({ search: ["acme"] })
      ).toThrow("search must be a string");
    });

    it("throws when category is not a string", () => {
      expect(() =>
        SupplierService.parsePublicDirectoryQuery({ category: 123 })
      ).toThrow("category must be a string");
    });

    it("throws when category is invalid", () => {
      expect(() =>
        SupplierService.parsePublicDirectoryQuery({ category: "invalid_cat" })
      ).toThrow("Invalid category");
    });

    it("throws when search exceeds max length", () => {
      expect(() =>
        SupplierService.parsePublicDirectoryQuery({
          search: "a".repeat(201),
        })
      ).toThrow("search is too long");
    });
  });

  describe("getPublicProfile", () => {
    function mockFindOneResult(doc) {
      Supplier.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(doc),
        }),
      });
    }

    function mockFindOneRejected(error) {
      Supplier.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockRejectedValue(error),
        }),
      });
    }

    it("returns the public profile DTO for an active visible supplier", async () => {
      const id = new mongoose.Types.ObjectId();
      mockFindOneResult({
        _id: id,
        name: "Acme Supplies",
        categories: ["wood_lumber"],
        country: "CM",
        region: "Centre",
        city: "Yaoundé",
        address: "12 Main St",
        postalCode: "12345",
        publicEmail: "contact@acme.com",
        phone: "0612345678",
        website: "https://acme.com",
      });

      const result = await SupplierService.getPublicProfile(id.toString());

      expect(Supplier.findOne).toHaveBeenCalledWith({
        _id: id.toString(),
        status: "Active",
        isVisible: true,
      });
      expect(result).toEqual({
        id: id.toString(),
        name: "Acme Supplies",
        categories: ["wood_lumber"],
        country: "CM",
        region: "Centre",
        city: "Yaoundé",
        address: "12 Main St",
        postalCode: "12345",
        publicEmail: "contact@acme.com",
        phone: "0612345678",
        website: "https://acme.com",
      });
    });

    it("throws Supplier not found for an invalid identifier without querying", async () => {
      await expect(
        SupplierService.getPublicProfile("not-a-valid-id")
      ).rejects.toMatchObject({
        message: SupplierService.SUPPLIER_NOT_FOUND,
        code: "SUPPLIER_NOT_FOUND",
      });
      expect(Supplier.findOne).not.toHaveBeenCalled();
    });

    it("throws Supplier not found when no public supplier matches", async () => {
      const id = new mongoose.Types.ObjectId().toString();
      mockFindOneResult(null);

      await expect(SupplierService.getPublicProfile(id)).rejects.toMatchObject({
        message: SupplierService.SUPPLIER_NOT_FOUND,
        code: "SUPPLIER_NOT_FOUND",
      });
    });

    it("propagates unexpected repository failures", async () => {
      const id = new mongoose.Types.ObjectId().toString();
      mockFindOneRejected(new Error("db connection lost"));

      await expect(SupplierService.getPublicProfile(id)).rejects.toThrow(
        "db connection lost"
      );
    });
  });

  describe("requestManagementAccess", () => {
    function mockFindOneLean(result) {
      Supplier.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(result),
        }),
      });
    }

    it("sends a management link when email matches an active visible supplier", async () => {
      const id = new mongoose.Types.ObjectId();
      mockFindOneLean({
        _id: id,
        accountEmail: "Owner@Example.com",
      });
      MagicLinkService.generateToken.mockResolvedValue({
        rawToken: "mgmt-raw-token",
        tokenDoc: { _id: tokenDocId },
      });
      EmailService.sendSupplierManagementEmail.mockResolvedValue(true);

      const result = await SupplierService.requestManagementAccess(
        id.toString(),
        "  owner@example.com  "
      );

      expect(result).toEqual({ success: true });
      expect(MagicLinkService.generateToken).toHaveBeenCalledWith({
        supplierId: id,
        purpose: "SUPPLIER_MANAGEMENT",
      });
      expect(EmailService.sendSupplierManagementEmail).toHaveBeenCalledWith(
        "owner@example.com",
        "mgmt-raw-token"
      );
      expect(result).not.toHaveProperty("token");
      expect(result).not.toHaveProperty("rawToken");
      expect(JSON.stringify(result)).not.toMatch(/Owner@Example|mgmt-raw/i);
    });

    it("returns the same generic confirmation when email does not match", async () => {
      const id = new mongoose.Types.ObjectId();
      mockFindOneLean({
        _id: id,
        accountEmail: "owner@example.com",
      });

      const result = await SupplierService.requestManagementAccess(
        id.toString(),
        "other@example.com"
      );

      expect(result).toEqual({ success: true });
      expect(MagicLinkService.generateToken).not.toHaveBeenCalled();
      expect(EmailService.sendSupplierManagementEmail).not.toHaveBeenCalled();
    });

    it("returns the same generic confirmation for inactive or non-visible suppliers", async () => {
      const id = new mongoose.Types.ObjectId();
      mockFindOneLean(null);

      const result = await SupplierService.requestManagementAccess(
        id.toString(),
        "owner@example.com"
      );

      expect(result).toEqual({ success: true });
      expect(MagicLinkService.generateToken).not.toHaveBeenCalled();
      expect(EmailService.sendSupplierManagementEmail).not.toHaveBeenCalled();
    });

    it("rejects an invalid supplier identifier", async () => {
      await expect(
        SupplierService.requestManagementAccess("bad-id", "a@b.com")
      ).rejects.toMatchObject({
        code: "INVALID_SUPPLIER_ID",
      });
      expect(Supplier.findOne).not.toHaveBeenCalled();
    });

    it("rejects an invalid email format", async () => {
      const id = new mongoose.Types.ObjectId().toString();
      await expect(
        SupplierService.requestManagementAccess(id, "not-an-email")
      ).rejects.toMatchObject({
        code: "INVALID_EMAIL",
      });
      expect(Supplier.findOne).not.toHaveBeenCalled();
    });

    it("returns generic confirmation and cleans up when email send fails", async () => {
      const id = new mongoose.Types.ObjectId();
      mockFindOneLean({
        _id: id,
        accountEmail: "owner@example.com",
      });
      MagicLinkService.generateToken.mockResolvedValue({
        rawToken: "mgmt-raw-token",
        tokenDoc: { _id: tokenDocId },
      });
      EmailService.sendSupplierManagementEmail.mockResolvedValue(false);
      MagicLinkToken.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await SupplierService.requestManagementAccess(
        id.toString(),
        "owner@example.com"
      );

      expect(result).toEqual({ success: true });
      expect(MagicLinkToken.deleteOne).toHaveBeenCalledWith({
        _id: tokenDocId,
      });
    });
  });

  describe("establishManagementSession", () => {
    it("consumes a valid management token and returns a session JWT", async () => {
      MagicLinkService.validateToken.mockResolvedValue({
        valid: true,
        tokenDoc: { supplierId },
      });
      MagicLinkService.consumeToken.mockResolvedValue({ isUsed: true });
      Supplier.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: supplierId }),
        }),
      });
      const expiresAt = new Date(Date.now() + 3600000);
      createManagementSession.mockResolvedValue({
        token: "mgmt.jwt.token",
        expiresAt,
        jti: "jti-1",
      });

      const result =
        await SupplierService.establishManagementSession("raw-token");

      expect(MagicLinkService.validateToken).toHaveBeenCalledWith(
        "raw-token",
        "SUPPLIER_MANAGEMENT"
      );
      expect(MagicLinkService.consumeToken).toHaveBeenCalledWith(
        "raw-token",
        "SUPPLIER_MANAGEMENT"
      );
      expect(createManagementSession).toHaveBeenCalledWith(supplierId);
      expect(result).toEqual({
        token: "mgmt.jwt.token",
        supplierId: supplierId.toString(),
        expiresAt,
      });
    });

    it("rejects invalid tokens without creating a session", async () => {
      MagicLinkService.validateToken.mockResolvedValue({
        valid: false,
        reason: "EXPIRED",
      });

      await expect(
        SupplierService.establishManagementSession("bad")
      ).rejects.toMatchObject({ code: "EXPIRED" });

      expect(MagicLinkService.consumeToken).not.toHaveBeenCalled();
      expect(createManagementSession).not.toHaveBeenCalled();
    });

    it("rejects when supplier is not active/visible", async () => {
      MagicLinkService.validateToken.mockResolvedValue({
        valid: true,
        tokenDoc: { supplierId },
      });
      Supplier.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        SupplierService.establishManagementSession("raw-token")
      ).rejects.toMatchObject({ code: "SUPPLIER_UNAVAILABLE" });

      expect(MagicLinkService.consumeToken).not.toHaveBeenCalled();
    });
  });

  describe("parseEditableUpdate", () => {
    const current = {
      name: "Editable Co",
      categories: ["construction_materials"],
      country: "CM",
      city: "Yaoundé",
      accountEmail: "owner@example.com",
      phone: "0612345678",
      publicEmail: "public@example.com",
      website: "https://before.example.com",
    };

    it("accepts a partial payload with only an optional field", () => {
      const result = SupplierService.parseEditableUpdate(
        { website: "https://after.example.com" },
        current
      );

      expect(result.updates).toEqual({
        website: "https://after.example.com",
      });
      expect(result.changedFields).toEqual(["website"]);
      expect(result.pendingContactEmail).toBeNull();
    });

    it("accepts a partial payload with only phone", () => {
      const result = SupplierService.parseEditableUpdate(
        { phone: "0699887766" },
        current
      );

      expect(result.updates).toEqual({ phone: "0699887766" });
      expect(result.changedFields).toEqual(["phone"]);
    });

    it("accepts a partial payload with only categories", () => {
      const result = SupplierService.parseEditableUpdate(
        { categories: ["wood_lumber"] },
        current
      );

      expect(result.updates).toEqual({ categories: ["wood_lumber"] });
      expect(result.changedFields).toEqual(["categories"]);
    });

    it("rejects clearing a required field when it is present in the payload", () => {
      expect(() =>
        SupplierService.parseEditableUpdate({ name: "" }, current)
      ).toThrow("Validation failed");

      try {
        SupplierService.parseEditableUpdate({ name: "" }, current);
      } catch (err) {
        expect(err.code).toBe("VALIDATION_ERROR");
        expect(err.errors).toMatchObject({ name: "name is required" });
      }
    });

    it("rejects an empty categories array when present in the payload", () => {
      expect(() =>
        SupplierService.parseEditableUpdate({ categories: [] }, current)
      ).toThrow("Validation failed");

      try {
        SupplierService.parseEditableUpdate({ categories: [] }, current);
      } catch (err) {
        expect(err.code).toBe("VALIDATION_ERROR");
        expect(err.errors).toMatchObject({
          categories: "At least one category is required",
        });
      }
    });

    it("does not overwrite omitted required fields", () => {
      const result = SupplierService.parseEditableUpdate(
        { city: "Douala" },
        current
      );

      expect(result.updates).toEqual({ city: "Douala" });
      expect(result.updates).not.toHaveProperty("name");
      expect(result.updates).not.toHaveProperty("categories");
      expect(result.updates).not.toHaveProperty("country");
      expect(result.updates).not.toHaveProperty("phone");
      expect(result.updates).not.toHaveProperty("accountEmail");
    });
  });
});
