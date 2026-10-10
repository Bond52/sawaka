const mongoose = require("mongoose");

const REALIZATION_STATUS = Object.freeze({
  DRAFT: "draft",
  PUBLISHED: "published",
});

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false }
);

const realizationSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    clientGroupId: { type: String, required: true },
    sequence: { type: Number, required: true },
    description: { type: String, default: "" },
    domainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Domain",
      default: null,
    },
    completedOn: { type: String, default: null },
    status: {
      type: String,
      enum: Object.values(REALIZATION_STATUS),
      required: true,
      default: REALIZATION_STATUS.DRAFT,
    },
    images: { type: [imageSchema], default: [] },
  },
  { timestamps: true }
);

realizationSchema.index({ ownerId: 1, clientGroupId: 1 }, { unique: true });
realizationSchema.index({ ownerId: 1, status: 1 });

realizationSchema.path("images").validate(function imagesMatchStatus(images) {
  if (this.status !== REALIZATION_STATUS.PUBLISHED) return true;
  return Array.isArray(images) && images.length > 0;
}, "PUBLISHED_REQUIRES_IMAGE");

module.exports = mongoose.model("Realization", realizationSchema);
module.exports.REALIZATION_STATUS = REALIZATION_STATUS;
