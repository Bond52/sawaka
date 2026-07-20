const mongoose = require("mongoose");
const Supplier = require("../models/Supplier");
const MagicLinkService = require("./MagicLinkService");
const MagicLinkToken = require("../models/MagicLinkToken");
const transporter = require("../utils/mailer");
const { buildSupplierActivationUrl } = require("../utils/supplierActivationUrl");

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
};

async function sendMagicLinkEmail(to, token) {
  const url = buildSupplierActivationUrl(token);

  const from =
    process.env.MAIL_FROM || process.env.BREVO_SMTP_USER;
  if (!from) {
    throw new Error("MAIL_FROM or BREVO_SMTP_USER is required to send email");
  }

  await transporter.sendMail({
    from,
    to,
    subject: "Activer votre compte fournisseur Sawaka",
    text: `Activez votre compte : ${url}`,
    html: `<p>Activez votre compte fournisseur en cliquant sur le lien ci-dessous :</p><p><a href="${url}">${url}</a></p>`,
  });
}

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
      tokenDoc = await MagicLinkService.generateToken(supplier._id);
      await sendMagicLinkEmail(supplier.accountEmail, tokenDoc.token);
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
    const validation = await MagicLinkService.validateToken(token);
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
      await MagicLinkService.consumeToken(token);
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

  parsePublicDirectoryQuery,
  SUPPLIER_NOT_FOUND,
};

module.exports = SupplierService;
