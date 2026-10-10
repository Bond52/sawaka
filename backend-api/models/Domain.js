const mongoose = require("mongoose");

const domainSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    nameFR: { type: String, required: true },
    nameEN: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Domain", domainSchema);
