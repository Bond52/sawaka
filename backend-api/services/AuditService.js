const mongoose = require("mongoose");

const AUDIT_ACTIONS = Object.freeze({
  SUPPLIER_UPDATED: "SupplierUpdated",
  SUPPLIER_CONTACT_EMAIL_CHANGE_REQUESTED: "SupplierContactEmailChangeRequested",
  SUPPLIER_CONTACT_EMAIL_VERIFIED: "SupplierContactEmailVerified",
  SUPPLIER_CONTACT_EMAIL_CHANGE_CANCELLED: "SupplierContactEmailChangeCancelled",
  SUPPLIER_DEACTIVATED: "SupplierDeactivated",
});

const AuditEventSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: Object.values(AUDIT_ACTIONS),
      index: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    /** Management session jti when the action was performed via a management session. */
    sessionId: { type: String, default: null },
    /**
     * Non-sensitive metadata only (field names changed, counts, flags).
     * Never store raw tokens or private email values.
     */
    metadata: { type: mongoose.Schema.Types.Mixed, default: undefined },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditEventSchema.index({ createdAt: -1 });

const AuditEvent = mongoose.model("AuditEvent", AuditEventSchema);

/**
 * Persist an audit event. Failures are logged and do not fail the caller.
 */
async function recordAuditEvent({
  action,
  supplierId,
  sessionId = null,
  metadata,
}) {
  try {
    await AuditEvent.create({
      action,
      supplierId,
      sessionId: sessionId || null,
      ...(metadata !== undefined ? { metadata } : {}),
    });
  } catch (err) {
    console.error("recordAuditEvent:", {
      action,
      supplierIdPresent: Boolean(supplierId),
      name: err && err.name,
      message: err && err.message,
    });
  }
}

module.exports = {
  AuditEvent,
  AUDIT_ACTIONS,
  recordAuditEvent,
};
