const mongoose = require("mongoose");
const Supplier = require("../models/Supplier");
const MagicLinkService = require("./MagicLinkService");
const MagicLinkToken = require("../models/MagicLinkToken");
const EmailService = require("./EmailService");
const {
  createManagementSession,
} = require("../middleware/supplierManagementSession");

const PUBLIC_DIRECTORY_PROJECTION =
  "name categories country region city address postalCode publicEmail phone website";

const SUPPLIER_NOT_FOUND = "Supplier not found";

function isValidSupplierObjectId(id) {
  return (
    typeof id === "string" &&
    mongoose.Types.ObjectId.isValid(id) &&
    new mongoose.Types.ObjectId(id).toString() === id
  );
}

function createSupplierNotFoundError() {
  const err = new Error(SUPPLIER_NOT_FOUND);
  err.code = "SUPPLIER_NOT_FOUND";
  return err;
}

const MAX_DIRECTORY_SEARCH_LENGTH = 200;

const EMAIL_FORMAT = /^.+@.+\..+$/;

const VALID_SUPPLIER_CATEGORIES = new Set([
  "construction_materials",
  "wood_lumber",
  "metal_steel",
  "electrical_supplies",
  "plumbing_supplies",
  "paints_finishes",
  "hardware_fasteners",
  "hand_tools",
  "power_tools",
  "industrial_machinery",
  "safety_equipment",
  "textiles_fabrics",
  "leather_accessories",
  "art_craft_materials",
  "agro_raw_materials",
  "food_processing_equipment",
  "packaging_containers",
  "equipment_rental",
  "transport_logistics",
  "import_wholesale_distribution",
]);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePublicDirectoryQuery(query = {}) {
  const filters = {};

  if (query.search !== undefined) {
    if (typeof query.search !== "string") {
      throw new Error("search must be a string");
    }
    const search = query.search.trim();
    if (search) {
      if (search.length > MAX_DIRECTORY_SEARCH_LENGTH) {
        throw new Error("search is too long");
      }
      filters.search = search;
    }
  }

  if (query.category !== undefined) {
    if (typeof query.category !== "string") {
      throw new Error("category must be a string");
    }
    const category = query.category.trim();
    if (category) {
      if (!VALID_SUPPLIER_CATEGORIES.has(category)) {
        throw new Error("Invalid category");
      }
      filters.category = category;
    }
  }

  return filters;
}

function buildPublicDirectoryFilter(filters = {}) {
  const query = {
    status: "Active",
    isVisible: true,
  };

  if (filters.search) {
    query.name = { $regex: escapeRegex(filters.search), $options: "i" };
  }

  if (filters.category) {
    query.categories = filters.category;
  }

  return query;
}

function toPublicSupplierDTO(supplier) {
  const entry = {
    id: supplier._id.toString(),
    name: supplier.name || "",
    categories: Array.isArray(supplier.categories) ? supplier.categories : [],
    country: supplier.country || "",
    city: supplier.city || "",
    phone: supplier.phone || "",
  };

  const region = typeof supplier.region === "string" ? supplier.region.trim() : "";
  if (region) {
    entry.region = region;
  }

  const address = typeof supplier.address === "string" ? supplier.address.trim() : "";
  if (address) {
    entry.address = address;
  }

  const postalCode =
    typeof supplier.postalCode === "string" ? supplier.postalCode.trim() : "";
  if (postalCode) {
    entry.postalCode = postalCode;
  }

  const publicEmail =
    typeof supplier.publicEmail === "string" ? supplier.publicEmail.trim() : "";
  if (publicEmail) {
    entry.publicEmail = publicEmail;
  }

  const website =
    typeof supplier.website === "string" ? supplier.website.trim() : "";
  if (website) {
    entry.website = website;
  }

  return entry;
}

const VALIDATION_REASON_MESSAGES = {
  TOKEN_MISSING: "Token required",
  NOT_FOUND: "Invalid magic link",
  ALREADY_USED: "Magic link already used",
  EXPIRED: "Magic link expired",
  PURPOSE_MISMATCH: "Invalid magic link",
  EMAIL_MISMATCH: "Invalid magic link",
};

const SupplierService = {
  async createSupplier(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid supplier data");
    }

    const { status: _st, isVisible: _vis, ownerId: _own, ...clean } = data;

    if (!clean.accountEmail || typeof clean.accountEmail !== "string") {
      throw new Error("accountEmail is required");
    }
    if (!clean.phone || typeof clean.phone !== "string") {
      throw new Error("phone is required");
    }
    if (clean.phone.length < 6) {
      throw new Error("phone must be at least 6 characters");
    }

    if (!Array.isArray(clean.categories) || clean.categories.length === 0) {
      const err = new Error("categories is required");
      err.errors = {
        categories: "At least one category is required",
      };
      throw err;
    }

    let supplier;
    try {
      supplier = await Supplier.create({
        ...clean,
        status: "Invited",
        isVisible: false,
      });
    } catch (err) {
      if (err && err.name === "ValidationError") {
        throw new Error(err.message);
      }
      throw err;
    }

    let tokenDoc;
    try {
      const generated = await MagicLinkService.generateToken({
        supplierId: supplier._id,
        purpose: MagicLinkService.PURPOSES.SUPPLIER_ACTIVATION,
      });
      tokenDoc = generated.tokenDoc;
      const sent = await EmailService.sendSupplierActivationEmail(
        supplier.accountEmail,
        generated.rawToken
      );
      if (!sent) {
        throw new Error("Failed to send activation email");
      }
    } catch (err) {
      try {
        if (tokenDoc && tokenDoc._id) {
          await MagicLinkToken.deleteOne({ _id: tokenDoc._id });
        }
      } catch (cleanupErr) {
        console.error("SupplierService.createSupplier cleanup token:", cleanupErr);
      }
      try {
        await Supplier.deleteOne({ _id: supplier._id });
      } catch (cleanupErr) {
        console.error("SupplierService.createSupplier cleanup supplier:", cleanupErr);
      }
      throw err;
    }

    return supplier;
  },

  async activateSupplier(token) {
    const purpose = MagicLinkService.PURPOSES.SUPPLIER_ACTIVATION;
    const validation = await MagicLinkService.validateToken(token, purpose);
    if (!validation.valid) {
      const reason = validation.reason || "INVALID";
      const message =
        VALIDATION_REASON_MESSAGES[reason] || "Invalid magic link";
      throw new Error(message);
    }

    const supplierId = validation.tokenDoc.supplierId;

    const updated = await Supplier.findOneAndUpdate(
      { _id: supplierId, status: "Invited" },
      {
        $set: {
          status: "Active",
          isVisible: true,
        },
      },
      { new: true }
    );

    if (!updated) {
      throw new Error(
        "Supplier could not be activated (not found or no longer invited)"
      );
    }

    try {
      await MagicLinkService.consumeToken(token, purpose);
    } catch (err) {
      try {
        await Supplier.findByIdAndUpdate(supplierId, {
          $set: { status: "Invited", isVisible: false },
        });
      } catch (rollbackErr) {
        console.error("SupplierService.activateSupplier rollback:", rollbackErr);
      }
      throw err;
    }

    return updated;
  },

  async getPublicDirectory(filters = {}) {
    const query = buildPublicDirectoryFilter(filters);
    const suppliers = await Supplier.find(query)
      .select(PUBLIC_DIRECTORY_PROJECTION)
      .sort({ name: 1 })
      .lean();

    return suppliers.map(toPublicSupplierDTO);
  },

  async getPublicProfile(id) {
    if (!isValidSupplierObjectId(id)) {
      throw createSupplierNotFoundError();
    }

    const supplier = await Supplier.findOne({
      _id: id,
      status: "Active",
      isVisible: true,
    })
      .select(PUBLIC_DIRECTORY_PROJECTION)
      .lean();

    if (!supplier) {
      throw createSupplierNotFoundError();
    }

    return toPublicSupplierDTO(supplier);
  },

  /**
   * Request a temporary supplier-management magic link.
   * Always returns the same generic confirmation whether or not the email matches,
   * to prevent contact-email enumeration. Only Active + visible suppliers receive a link.
   *
   * @param {string} supplierId
   * @param {string} email Submitted private contact email
   * @returns {Promise<{ success: true }>}
   */
  async requestManagementAccess(supplierId, email) {
    if (!isValidSupplierObjectId(supplierId)) {
      const err = new Error("Invalid supplier identifier");
      err.code = "INVALID_SUPPLIER_ID";
      throw err;
    }

    if (typeof email !== "string") {
      const err = new Error("email is required");
      err.code = "INVALID_EMAIL";
      throw err;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !EMAIL_FORMAT.test(trimmedEmail)) {
      const err = new Error("Invalid email format");
      err.code = "INVALID_EMAIL";
      throw err;
    }

    const GENERIC = { success: true };

    let supplier;
    try {
      supplier = await Supplier.findOne({
        _id: supplierId,
        status: "Active",
        isVisible: true,
      })
        .select("accountEmail")
        .lean();
    } catch (err) {
      console.error("SupplierService.requestManagementAccess lookup:", {
        operation: "requestManagementAccess",
        name: err && err.name,
        message: err && err.message,
        supplierIdPresent: Boolean(supplierId),
      });
      throw err;
    }

    if (!supplier || typeof supplier.accountEmail !== "string") {
      return GENERIC;
    }

    const storedNormalized = supplier.accountEmail.trim().toLowerCase();
    const submittedNormalized = trimmedEmail.toLowerCase();
    if (storedNormalized !== submittedNormalized) {
      return GENERIC;
    }

    let tokenDoc;
    try {
      const generated = await MagicLinkService.generateToken({
        supplierId: supplier._id,
        purpose: MagicLinkService.PURPOSES.SUPPLIER_MANAGEMENT,
      });
      tokenDoc = generated.tokenDoc;

      const sent = await EmailService.sendSupplierManagementEmail(
        trimmedEmail,
        generated.rawToken
      );
      if (!sent) {
        throw new Error("Failed to send management email");
      }
    } catch (err) {
      try {
        if (tokenDoc && tokenDoc._id) {
          await MagicLinkToken.deleteOne({ _id: tokenDoc._id });
        }
      } catch (cleanupErr) {
        console.error(
          "SupplierService.requestManagementAccess cleanup token:",
          {
            name: cleanupErr && cleanupErr.name,
            message: cleanupErr && cleanupErr.message,
          }
        );
      }
      console.error("SupplierService.requestManagementAccess send:", {
        operation: "requestManagementAccess",
        name: err && err.name,
        message: err && err.message,
        supplierIdPresent: Boolean(supplierId),
      });
      // Still return generic confirmation to avoid email enumeration via error paths.
      return GENERIC;
    }

    return GENERIC;
  },

  /**
   * Exchange a SUPPLIER_MANAGEMENT magic-link token for a short-lived management session.
   * Consumes the magic-link token (single-use) on success.
   *
   * @param {string} rawToken
   * @returns {Promise<{ token: string, supplierId: string, expiresAt: Date }>}
   */
  async establishManagementSession(rawToken) {
    const purpose = MagicLinkService.PURPOSES.SUPPLIER_MANAGEMENT;
    const validation = await MagicLinkService.validateToken(rawToken, purpose);
    if (!validation.valid) {
      const reason = validation.reason || "INVALID";
      const message =
        VALIDATION_REASON_MESSAGES[reason] || "Invalid magic link";
      const err = new Error(message);
      err.code = reason;
      throw err;
    }

    const supplierId = validation.tokenDoc.supplierId;

    const supplier = await Supplier.findOne({
      _id: supplierId,
      status: "Active",
      isVisible: true,
    })
      .select("_id")
      .lean();

    if (!supplier) {
      const err = new Error("Supplier management is unavailable");
      err.code = "SUPPLIER_UNAVAILABLE";
      throw err;
    }

    try {
      await MagicLinkService.consumeToken(rawToken, purpose);
    } catch (err) {
      const consumeErr = new Error(
        VALIDATION_REASON_MESSAGES.ALREADY_USED || "Magic link already used"
      );
      consumeErr.code = "ALREADY_USED";
      throw consumeErr;
    }

    const session = await createManagementSession(supplier._id);

    return {
      token: session.token,
      supplierId: supplier._id.toString(),
      expiresAt: session.expiresAt,
    };
  },

  parsePublicDirectoryQuery,
  isValidSupplierObjectId,
  SUPPLIER_NOT_FOUND,
};

module.exports = SupplierService;
