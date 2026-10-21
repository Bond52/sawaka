const mongoose = require("mongoose");

const ACTIVITY_TYPES = Object.freeze([
  "profile.updated",
  "realization.created",
  "realization.published",
  "realization.moved_to_draft",
  "realization.edited",
  "realization.deleted",
]);

const ENTITY_TYPES = Object.freeze(["contributor_profile", "realization"]);

/**
 * Owner-facing recent activity. This is not the supplier AuditEvent log
 * and not the UserAuditEvent security log.
 */
const contributorActivitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ACTIVITY_TYPES,
    },
    entityType: {
      type: String,
      required: true,
      enum: ENTITY_TYPES,
    },
    /** Title captured when the event is written. Empty when the realization has none. */
    entityTitleSnapshot: { type: String, default: "", maxlength: 120 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

contributorActivitySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("ContributorActivity", contributorActivitySchema);
module.exports.ACTIVITY_TYPES = ACTIVITY_TYPES;
module.exports.ENTITY_TYPES = ENTITY_TYPES;
