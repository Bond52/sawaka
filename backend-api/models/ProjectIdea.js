const mongoose = require("mongoose");

const NEED_KINDS = Object.freeze(["skill", "service", "resource", "assistance"]);

const matchedEntitySchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    kind: { type: String, enum: ["contributor", "supplier"], required: true },
    label: { type: String, default: "" },
    detail: { type: String, default: "" },
    location: { type: String, default: "" },
    href: { type: String, default: "" },
  },
  { _id: false }
);

const ideaNeedSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    kind: { type: String, enum: NEED_KINDS, required: true },
    domainOrSkills: { type: String, default: "" },
    geographicNote: { type: String, default: "" },
    matchedContributors: { type: [matchedEntitySchema], default: [] },
    matchedSuppliers: { type: [matchedEntitySchema], default: [] },
    missingCapabilities: { type: [String], default: [] },
  },
  { _id: true }
);

const ideaStageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    position: { type: Number, default: 0 },
    needs: { type: [ideaNeedSchema], default: [] },
  },
  { _id: true }
);

const criteriaSchema = new mongoose.Schema(
  {
    interests: { type: String, default: "" },
    objective: { type: String, default: "" },
    category: { type: String, default: "" },
    skills: { type: String, default: "" },
    country: { type: String, default: "" },
    city: { type: String, default: "" },
    budgetAmount: { type: Number, default: null },
    budgetCurrency: { type: String, default: "" },
    resources: { type: String, default: "" },
    constraints: { type: String, default: "" },
  },
  { _id: false }
);

const projectIdeaSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    summary: { type: String, default: "" },
    description: { type: String, default: "" },
    objective: { type: String, default: "" },
    category: { type: String, default: "" },
    country: { type: String, default: "" },
    city: { type: String, default: "" },
    relevance: { type: String, default: "" },
    budgetNotes: { type: String, default: "" },
    challenges: { type: [String], default: [] },
    stages: { type: [ideaStageSchema], default: [] },
    criteria: { type: criteriaSchema, default: () => ({}) },
    locale: { type: String, enum: ["fr", "en"], default: "fr" },
    sourceIdeaKey: { type: String, default: "" },
  },
  { timestamps: true }
);

projectIdeaSchema.index({ ownerId: 1, updatedAt: -1 });

module.exports = mongoose.model("ProjectIdea", projectIdeaSchema);
module.exports.NEED_KINDS = NEED_KINDS;
