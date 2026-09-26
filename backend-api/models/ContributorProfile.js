const mongoose = require("mongoose");
const contributorSkillSchema = require("./ContributorSkill");

const PROFILE_STATUS = Object.freeze({
  PENDING_EMAIL_VERIFICATION: "Pending Email Verification",
  ACTIVE: "Active",
});

const contributorProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    displayName: { type: String, required: true },
    biography: { type: String, default: "" },
    country: { type: String, required: true },
    region: { type: String, default: "" },
    city: { type: String, default: "" },
    domainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Domain",
      required: true,
    },
    skills: { type: [contributorSkillSchema], default: [] },
    status: {
      type: String,
      enum: Object.values(PROFILE_STATUS),
      required: true,
    },
    isVisible: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ContributorProfile", contributorProfileSchema);
module.exports.PROFILE_STATUS = PROFILE_STATUS;
