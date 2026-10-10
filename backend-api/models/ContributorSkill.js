const mongoose = require("mongoose");

/**
 * Embedded on ContributorProfile so profile and skills are one write.
 * Canonical rows reference Skill. Custom rows keep a label and no global taxonomy entry.
 */
const contributorSkillSchema = new mongoose.Schema(
  {
    skillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Skill",
      default: null,
    },
    customLabel: { type: String, default: "" },
    isCustom: { type: Boolean, required: true },
  },
  { _id: false }
);

module.exports = contributorSkillSchema;
module.exports.ContributorSkillSchema = contributorSkillSchema;
