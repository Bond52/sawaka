const Supplier = require("../models/Supplier");
const MagicLinkService = require("./MagicLinkService");
const MagicLinkToken = require("../models/MagicLinkToken");
const transporter = require("../utils/mailer");

const VALIDATION_REASON_MESSAGES = {
  TOKEN_MISSING: "Token required",
  NOT_FOUND: "Invalid magic link",
  ALREADY_USED: "Magic link already used",
  EXPIRED: "Magic link expired",
};

async function sendMagicLinkEmail(to, token) {
  const base = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
  const path = process.env.SUPPLIER_MAGIC_LINK_PATH || "/supplier/activate";
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}?token=${encodeURIComponent(
    token
  )}`;

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
};

module.exports = SupplierService;
