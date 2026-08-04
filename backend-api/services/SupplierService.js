const mongoose = require("mongoose");
const Supplier = require("../models/Supplier");
const MagicLinkService = require("./MagicLinkService");
const MagicLinkToken = require("../models/MagicLinkToken");
const EmailService = require("./EmailService");
const {
  createManagementSession,
  invalidateSessionsForSupplier,
} = require("../middleware/supplierManagementSession");
const { recordAuditEvent, AUDIT_ACTIONS } = require("./AuditService");

const PUBLIC_DIRECTORY_PROJECTION =
  "name categories country region city address postalCode publicEmail phone website";

const EDITABLE_PROJECTION =
  "name categories country region city address postalCode accountEmail pendingContactEmail publicEmail phone website";

const SUPPLIER_NOT_FOUND = "Supplier not found";
const SUPPLIER_UNAVAILABLE = "Supplier management is unavailable";

const EMAIL_FORMAT_STRICT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function toEditableSupplierDTO(supplier) {
  const entry = {
    id: supplier._id.toString(),
    name: supplier.name || "",
    categories: Array.isArray(supplier.categories) ? supplier.categories : [],
    country: supplier.country || "",
    region: typeof supplier.region === "string" ? supplier.region : "",
    city: typeof supplier.city === "string" ? supplier.city : "",
    address: typeof supplier.address === "string" ? supplier.address : "",
    postalCode:
      typeof supplier.postalCode === "string" ? supplier.postalCode : "",
    accountEmail: supplier.accountEmail || "",
    publicEmail:
      typeof supplier.publicEmail === "string" ? supplier.publicEmail : "",
    phone: supplier.phone || "",
    website: typeof supplier.website === "string" ? supplier.website : "",
  };

  if (
    typeof supplier.pendingContactEmail === "string" &&
    supplier.pendingContactEmail.trim()
  ) {
    entry.pendingContactEmail = supplier.pendingContactEmail.trim();
  }

  return entry;
}

function createUnavailableError() {
  const err = new Error(SUPPLIER_UNAVAILABLE);
  err.code = "SUPPLIER_UNAVAILABLE";
  return err;
}

async function invalidateUnusedVerificationTokens(supplierId) {
  await MagicLinkToken.updateMany(
    {
      supplierId,
      purpose: MagicLinkService.PURPOSES.CONTACT_EMAIL_VERIFICATION,
      isUsed: false,
    },
    { $set: { isUsed: true } }
  );
}

function isValidOptionalUrl(value) {
  if (!value) return true;
  try {
    const withProto = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    // eslint-disable-next-line no-new
    new URL(withProto);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate and normalize editable supplier update payload.
 * System fields (status, isVisible, ownerId, timestamps) are stripped.
 * @returns {{ updates: object, changedFields: string[], pendingContactEmail: string|null }}
 */
function parseEditableUpdate(data, currentSupplier) {
  if (!data || typeof data !== "object") {
    const err = new Error("Invalid supplier data");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const {
    status: _st,
    isVisible: _vis,
    ownerId: _own,
    _id: _id,
    id: _clientId,
    createdAt: _ca,
    updatedAt: _ua,
    deactivatedAt: _da,
    pendingContactEmail: _pe,
    contactEmailChangedAt: _cca,
    contactEmailVerifiedAt: _cva,
    ...raw
  } = data;

  const errors = {};
  const updates = {};
  const changedFields = [];
  /** @type {string|null} */
  let pendingContactEmail = null;

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name || name.length < 2) {
    errors.name = !name
      ? "name is required"
      : "name must be at least 2 characters";
  } else {
    updates.name = name;
    if (name !== (currentSupplier.name || "")) changedFields.push("name");
  }

  let categories = raw.categories;
  if (!Array.isArray(categories) || categories.length === 0) {
    errors.categories = "At least one category is required";
  } else {
    const normalized = [
      ...new Set(
        categories
          .filter((c) => typeof c === "string")
          .map((c) => c.trim())
          .filter(Boolean)
      ),
    ];
    if (
      normalized.length === 0 ||
      normalized.some((c) => !VALID_SUPPLIER_CATEGORIES.has(c))
    ) {
      errors.categories = "Invalid category";
    } else {
      updates.categories = normalized;
      const prev = Array.isArray(currentSupplier.categories)
        ? currentSupplier.categories
        : [];
      if (
        normalized.length !== prev.length ||
        normalized.some((c, i) => c !== prev[i])
      ) {
        changedFields.push("categories");
      }
    }
  }

  const country = typeof raw.country === "string" ? raw.country.trim() : "";
  if (!country) {
    errors.country = "country is required";
  } else {
    updates.country = country;
    if (country !== (currentSupplier.country || "")) changedFields.push("country");
  }

  const phone = typeof raw.phone === "string" ? raw.phone.trim() : "";
  if (!phone) {
    errors.phone = "phone is required";
  } else if (phone.length < 6) {
    errors.phone = "phone must be at least 6 characters";
  } else {
    updates.phone = phone;
    if (phone !== (currentSupplier.phone || "")) changedFields.push("phone");
  }

  // Contact email change → pending verification (verified email stays active).
  if (raw.accountEmail !== undefined) {
    if (typeof raw.accountEmail !== "string") {
      errors.accountEmail = "Invalid account email format";
    } else {
      const submitted = raw.accountEmail.trim();
      if (!submitted || !EMAIL_FORMAT_STRICT.test(submitted)) {
        errors.accountEmail = "Invalid account email format";
      } else {
        const current =
          typeof currentSupplier.accountEmail === "string"
            ? currentSupplier.accountEmail.trim()
            : "";
        if (submitted.toLowerCase() !== current.toLowerCase()) {
          pendingContactEmail = submitted;
          changedFields.push("pendingContactEmail");
        }
      }
    }
  }

  const optionalStringFields = [
    "region",
    "city",
    "address",
    "postalCode",
    "publicEmail",
    "website",
  ];
  for (const field of optionalStringFields) {
    if (raw[field] === undefined) continue;
    if (typeof raw[field] !== "string") {
      errors[field] = `${field} must be a string`;
      continue;
    }
    const trimmed = raw[field].trim();
    if (field === "publicEmail" && trimmed && !EMAIL_FORMAT_STRICT.test(trimmed)) {
      errors.publicEmail = "Invalid public email format";
      continue;
    }
    if (field === "website" && trimmed && !isValidOptionalUrl(trimmed)) {
      errors.website = "Invalid website URL";
      continue;
    }
    updates[field] = trimmed;
    const prev =
      typeof currentSupplier[field] === "string"
        ? currentSupplier[field].trim()
        : "";
    if (trimmed !== prev) changedFields.push(field);
  }

  if (Object.keys(errors).length > 0) {
    const err = new Error("Validation failed");
    err.code = "VALIDATION_ERROR";
    err.errors = errors;
    throw err;
  }

  return { updates, changedFields, pendingContactEmail };
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

  /**
   * Retrieve editable supplier fields for a management session's supplierId.
   * @param {string} supplierId
   */
  async getEditableSupplier(supplierId) {
    if (!isValidSupplierObjectId(String(supplierId))) {
      throw createUnavailableError();
    }

    const supplier = await Supplier.findOne({
      _id: supplierId,
      status: "Active",
      isVisible: true,
    })
      .select(EDITABLE_PROJECTION)
      .lean();

    if (!supplier) {
      throw createUnavailableError();
    }

    return toEditableSupplierDTO(supplier);
  },

  /**
   * Update permitted supplier fields under a management session.
   * Contact-email changes are stored as pendingContactEmail and verified separately.
   * @param {string} supplierId
   * @param {object} data
   * @param {{ sessionId?: string }} [options]
   * @returns {Promise<{ supplier: object, emailVerificationPending?: boolean }>}
   */
  async updateManagedSupplier(supplierId, data, options = {}) {
    if (!isValidSupplierObjectId(String(supplierId))) {
      throw createUnavailableError();
    }

    const current = await Supplier.findOne({
      _id: supplierId,
      status: "Active",
      isVisible: true,
    }).lean();

    if (!current) {
      throw createUnavailableError();
    }

    const { updates, changedFields, pendingContactEmail } = parseEditableUpdate(
      data,
      current
    );

    if (pendingContactEmail) {
      updates.pendingContactEmail = pendingContactEmail;
      updates.contactEmailChangedAt = new Date();
    }

    if (changedFields.length === 0 && !pendingContactEmail) {
      return { supplier: toEditableSupplierDTO(current) };
    }

    let updated;
    try {
      updated = await Supplier.findOneAndUpdate(
        { _id: supplierId, status: "Active", isVisible: true },
        { $set: updates },
        { new: true, runValidators: true }
      )
        .select(EDITABLE_PROJECTION)
        .lean();
    } catch (err) {
      if (err && err.name === "ValidationError") {
        const validationErr = new Error(err.message);
        validationErr.code = "VALIDATION_ERROR";
        throw validationErr;
      }
      throw err;
    }

    if (!updated) {
      throw createUnavailableError();
    }

    const profileChangedFields = changedFields.filter(
      (f) => f !== "pendingContactEmail"
    );

    if (profileChangedFields.length > 0) {
      await recordAuditEvent({
        action: AUDIT_ACTIONS.SUPPLIER_UPDATED,
        supplierId,
        sessionId: options.sessionId || null,
        metadata: { changedFields: profileChangedFields },
      });
    }

    let emailVerificationPending = false;
    if (pendingContactEmail) {
      emailVerificationPending = true;
      try {
        await invalidateUnusedVerificationTokens(supplierId);
        const generated = await MagicLinkService.generateToken({
          supplierId,
          purpose: MagicLinkService.PURPOSES.CONTACT_EMAIL_VERIFICATION,
          pendingEmail: pendingContactEmail,
        });
        const sent = await EmailService.sendContactEmailVerification(
          pendingContactEmail,
          generated.rawToken
        );
        if (!sent) {
          console.error("SupplierService.updateManagedSupplier verify email send failed", {
            supplierIdPresent: true,
          });
        }
        await recordAuditEvent({
          action: AUDIT_ACTIONS.SUPPLIER_CONTACT_EMAIL_CHANGE_REQUESTED,
          supplierId,
          sessionId: options.sessionId || null,
          metadata: { hasPendingEmail: true },
        });
      } catch (err) {
        console.error("SupplierService.updateManagedSupplier verify email:", {
          name: err && err.name,
          message: err && err.message,
          supplierIdPresent: true,
        });
      }
    }

    const result = { supplier: toEditableSupplierDTO(updated) };
    if (emailVerificationPending) {
      result.emailVerificationPending = true;
    }
    return result;
  },

  /**
   * Resend contact-email verification link for the current pending email.
   */
  async resendContactEmailVerification(supplierId, options = {}) {
    if (!isValidSupplierObjectId(String(supplierId))) {
      throw createUnavailableError();
    }

    const supplier = await Supplier.findOne({
      _id: supplierId,
      status: "Active",
      isVisible: true,
    })
      .select("pendingContactEmail accountEmail")
      .lean();

    if (!supplier) {
      throw createUnavailableError();
    }

    const pending =
      typeof supplier.pendingContactEmail === "string"
        ? supplier.pendingContactEmail.trim()
        : "";
    if (!pending) {
      const err = new Error("No pending contact email to verify");
      err.code = "NO_PENDING_EMAIL";
      throw err;
    }

    await invalidateUnusedVerificationTokens(supplierId);
    const generated = await MagicLinkService.generateToken({
      supplierId,
      purpose: MagicLinkService.PURPOSES.CONTACT_EMAIL_VERIFICATION,
      pendingEmail: pending,
    });
    const sent = await EmailService.sendContactEmailVerification(
      pending,
      generated.rawToken
    );
    if (!sent) {
      throw new Error("Failed to send verification email");
    }

    await recordAuditEvent({
      action: AUDIT_ACTIONS.SUPPLIER_CONTACT_EMAIL_CHANGE_REQUESTED,
      supplierId,
      sessionId: options.sessionId || null,
      metadata: { resent: true },
    });

    return { success: true };
  },

  /**
   * Cancel a pending contact-email change.
   */
  async cancelPendingContactEmail(supplierId, options = {}) {
    if (!isValidSupplierObjectId(String(supplierId))) {
      throw createUnavailableError();
    }

    const updated = await Supplier.findOneAndUpdate(
      {
        _id: supplierId,
        status: "Active",
        isVisible: true,
        pendingContactEmail: { $exists: true, $nin: [null, ""] },
      },
      {
        $unset: { pendingContactEmail: 1 },
        $set: { contactEmailChangedAt: null },
      },
      { new: true }
    )
      .select(EDITABLE_PROJECTION)
      .lean();

    if (!updated) {
      const stillActive = await Supplier.findOne({
        _id: supplierId,
        status: "Active",
        isVisible: true,
      })
        .select(EDITABLE_PROJECTION)
        .lean();
      if (!stillActive) throw createUnavailableError();
      return { supplier: toEditableSupplierDTO(stillActive) };
    }

    await invalidateUnusedVerificationTokens(supplierId);
    await recordAuditEvent({
      action: AUDIT_ACTIONS.SUPPLIER_CONTACT_EMAIL_CHANGE_CANCELLED,
      supplierId,
      sessionId: options.sessionId || null,
    });

    return { supplier: toEditableSupplierDTO(updated) };
  },

  /**
   * Consume a CONTACT_EMAIL_VERIFICATION token and activate the pending email.
   */
  async verifyContactEmail(rawToken) {
    const purpose = MagicLinkService.PURPOSES.CONTACT_EMAIL_VERIFICATION;

    if (!rawToken || typeof rawToken !== "string" || !rawToken.trim()) {
      const err = new Error("Token required");
      err.code = "TOKEN_MISSING";
      throw err;
    }

    const crypto = require("crypto");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken, "utf8")
      .digest("hex");
    let tokenDoc = await MagicLinkToken.findOne({ tokenHash });
    if (!tokenDoc) {
      tokenDoc = await MagicLinkToken.findOne({ token: rawToken });
    }
    if (!tokenDoc) {
      const err = new Error("Invalid magic link");
      err.code = "NOT_FOUND";
      throw err;
    }
    if (tokenDoc.purpose !== purpose) {
      const err = new Error("Invalid magic link");
      err.code = "PURPOSE_MISMATCH";
      throw err;
    }
    if (tokenDoc.isUsed) {
      const err = new Error("Magic link already used");
      err.code = "ALREADY_USED";
      throw err;
    }
    if (tokenDoc.expiresAt.getTime() <= Date.now()) {
      const err = new Error("Magic link expired");
      err.code = "EXPIRED";
      throw err;
    }

    const supplier = await Supplier.findById(tokenDoc.supplierId).lean();
    if (
      !supplier ||
      typeof supplier.pendingContactEmail !== "string" ||
      !supplier.pendingContactEmail.trim()
    ) {
      const err = new Error("Invalid magic link");
      err.code = "EMAIL_MISMATCH";
      throw err;
    }

    const pending = supplier.pendingContactEmail.trim();
    const validation = await MagicLinkService.validateToken(rawToken, purpose, {
      pendingEmail: pending,
    });
    if (!validation.valid) {
      const err = new Error(
        VALIDATION_REASON_MESSAGES[validation.reason] || "Invalid magic link"
      );
      err.code = validation.reason;
      throw err;
    }

    const previousEmail = supplier.accountEmail;
    const updated = await Supplier.findOneAndUpdate(
      {
        _id: supplier._id,
        pendingContactEmail: supplier.pendingContactEmail,
      },
      {
        $set: {
          accountEmail: pending,
          contactEmailVerifiedAt: new Date(),
          contactEmailChangedAt: new Date(),
        },
        $unset: { pendingContactEmail: 1 },
      },
      { new: true }
    )
      .select("_id accountEmail")
      .lean();

    if (!updated) {
      const err = new Error("Invalid magic link");
      err.code = "EMAIL_MISMATCH";
      throw err;
    }

    try {
      await MagicLinkService.consumeToken(rawToken, purpose);
    } catch (err) {
      try {
        await Supplier.findByIdAndUpdate(supplier._id, {
          $set: {
            accountEmail: previousEmail,
            pendingContactEmail: pending,
            contactEmailVerifiedAt: supplier.contactEmailVerifiedAt || null,
          },
        });
      } catch (rollbackErr) {
        console.error("SupplierService.verifyContactEmail rollback:", {
          name: rollbackErr && rollbackErr.name,
          message: rollbackErr && rollbackErr.message,
        });
      }
      throw err;
    }

    await invalidateUnusedVerificationTokens(supplier._id);
    await recordAuditEvent({
      action: AUDIT_ACTIONS.SUPPLIER_CONTACT_EMAIL_VERIFIED,
      supplierId: supplier._id,
      metadata: { verified: true },
    });

    return { success: true, supplierId: updated._id.toString() };
  },

  /**
   * Logically deactivate a supplier: Inactive, not visible, record deactivatedAt,
   * audit, invalidate management sessions. Record is retained.
   */
  async deactivateManagedSupplier(supplierId, options = {}) {
    if (!isValidSupplierObjectId(String(supplierId))) {
      throw createUnavailableError();
    }

    const updated = await Supplier.findOneAndUpdate(
      {
        _id: supplierId,
        status: "Active",
        isVisible: true,
      },
      {
        $set: {
          status: "Inactive",
          isVisible: false,
          deactivatedAt: new Date(),
        },
      },
      { new: true }
    )
      .select("_id name status isVisible deactivatedAt")
      .lean();

    if (!updated) {
      throw createUnavailableError();
    }

    await invalidateSessionsForSupplier(supplierId);
    await recordAuditEvent({
      action: AUDIT_ACTIONS.SUPPLIER_DEACTIVATED,
      supplierId,
      sessionId: options.sessionId || null,
      metadata: { status: "Inactive", isVisible: false },
    });

    return {
      success: true,
      supplierId: updated._id.toString(),
      name: updated.name || "",
    };
  },

  parsePublicDirectoryQuery,
  isValidSupplierObjectId,
  parseEditableUpdate,
  SUPPLIER_NOT_FOUND,
  SUPPLIER_UNAVAILABLE,
  AUDIT_ACTIONS,
};

module.exports = SupplierService;
