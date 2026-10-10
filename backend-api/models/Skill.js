const mongoose = require("mongoose");

const skillSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    domainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Domain",
      required: true,
      index: true,
    },
    nameFR: { type: String, required: true },
    nameEN: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Skill", skillSchema);
