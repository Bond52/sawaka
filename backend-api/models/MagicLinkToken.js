const mongoose = require("mongoose");

const TOKEN_PURPOSES = [
  "SUPPLIER_ACTIVATION",
  "SUPPLIER_MANAGEMENT",
  "CONTACT_EMAIL_VERIFICATION",
];

const MagicLinkTokenSchema = new mongoose.Schema(
  {
    /**
     * Compatibility: legacy activation tokens stored the raw token in plaintext.
     * New tokens omit this field and store only `tokenHash`.
     * Sparse unique so multiple hashed-only docs do not collide on null.
     */
    token: { type: String, sparse: true, unique: true },

    /** SHA-256 hex digest of the raw token. Required for newly issued tokens. */
    tokenHash: { type: String, sparse: true, unique: true },

    /**
     * Token purpose. Optional only for legacy activation docs issued before
     * purposes existed; MagicLinkService treats missing purpose as
     * SUPPLIER_ACTIVATION during validation/consumption.
     */
    purpose: {
      type: String,
      enum: TOKEN_PURPOSES,
    },

    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },

    /**
     * SHA-256 of normalized pending email for CONTACT_EMAIL_VERIFICATION.
     * Binds the token to a specific email without storing the address in cleartext.
     */
    boundEmailHash: { type: String },

    expiresAt: {
      type: Date,
      required: true,
      validate: {
        validator: function (v) {
          return v instanceof Date && !Number.isNaN(v.getTime()) && v.getTime() > Date.now();
        },
        message: "expiresAt must be a future date",
      },
    },

    isUsed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

MagicLinkTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
MagicLinkTokenSchema.index({ tokenHash: 1, isUsed: 1 });
MagicLinkTokenSchema.index({ token: 1, isUsed: 1 });
MagicLinkTokenSchema.index({ purpose: 1, supplierId: 1 });

module.exports = mongoose.model("MagicLinkToken", MagicLinkTokenSchema);
module.exports.TOKEN_PURPOSES = TOKEN_PURPOSES;
