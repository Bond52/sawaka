const mongoose = require("mongoose");

/**
 * Short-lived supplier-management sessions established after consuming a
 * SUPPLIER_MANAGEMENT magic link. Stored so sessions can be invalidated
 * (e.g. on deactivation) before JWT natural expiry.
 */
const SupplierManagementSessionSchema = new mongoose.Schema(
  {
    jti: { type: String, required: true, unique: true, index: true },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    expiresAt: { type: Date, required: true },
    invalidatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

SupplierManagementSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model(
  "SupplierManagementSession",
  SupplierManagementSessionSchema
);
