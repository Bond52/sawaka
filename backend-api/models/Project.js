const mongoose = require("mongoose");

const PROJECT_STATUS = Object.freeze({
  DRAFT: "draft",
  PUBLISHED: "published",
});

const PROJECT_VISIBILITY = Object.freeze({
  PRIVATE: "private",
  PUBLIC: "public",
});

const STAGE_STATUS = Object.freeze({
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  BLOCKED: "blocked",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
});

const stageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
    position: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: Object.values(STAGE_STATUS),
      required: true,
      default: STAGE_STATUS.NOT_STARTED,
    },
    blockerExplanation: { type: String, default: "", trim: true, maxlength: 1000 },
  },
  { _id: true }
);

const projectSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, default: "", trim: true, maxlength: 120 },
    summary: { type: String, default: "", trim: true, maxlength: 280 },
    description: { type: String, default: "", trim: true, maxlength: 4000 },
    objective: { type: String, default: "", trim: true, maxlength: 2000 },
    category: { type: String, default: "", trim: true, maxlength: 80 },
    country: { type: String, default: "", trim: true, maxlength: 80 },
    city: { type: String, default: "", trim: true, maxlength: 80 },
    status: {
      type: String,
      enum: Object.values(PROJECT_STATUS),
      required: true,
      default: PROJECT_STATUS.DRAFT,
      index: true,
    },
    visibility: {
      type: String,
      enum: Object.values(PROJECT_VISIBILITY),
      required: true,
      default: PROJECT_VISIBILITY.PRIVATE,
    },
    publishedAt: { type: Date, default: null },
    stages: { type: [stageSchema], default: [] },
  },
  { timestamps: true }
);

projectSchema.index({ ownerId: 1, updatedAt: -1 });
projectSchema.index({ status: 1, visibility: 1, updatedAt: -1 });

module.exports = mongoose.model("Project", projectSchema);
module.exports.PROJECT_STATUS = PROJECT_STATUS;
module.exports.PROJECT_VISIBILITY = PROJECT_VISIBILITY;
module.exports.STAGE_STATUS = STAGE_STATUS;
