const mongoose = require("mongoose");

const TWENTY_FOUR_H_MS = 24 * 60 * 60 * 1000;

const MagicLinkTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },

    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      validate: {
        validator: function (v) {
          if (!(v instanceof Date) || Number.isNaN(v.getTime())) return false;
          const now = Date.now();
          const exp = v.getTime();
          return exp > now && exp <= now + TWENTY_FOUR_H_MS;
        },
        message:
          "expiresAt must be in the future and within 24 hours from now",
      },
    },

    isUsed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

MagicLinkTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
MagicLinkTokenSchema.index({ token: 1, isUsed: 1 });

module.exports = mongoose.model("MagicLinkToken", MagicLinkTokenSchema);
