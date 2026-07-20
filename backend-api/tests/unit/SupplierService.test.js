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

    it("creates supplier with multiple categories", async () => {
      const supplierDoc = {
        _id: supplierId,
        accountEmail: "s@example.com",
        phone: "0612345678",
        categories: ["construction_materials", "wood_lumber"],
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
});
