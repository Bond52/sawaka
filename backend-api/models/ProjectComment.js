const mongoose = require("mongoose");

const COMMENT_AUTHOR_TYPE = Object.freeze({
  MEMBER: "member",
  VISITOR: "visitor",
});

const COMMENT_TARGET = Object.freeze({
  PROJECT: "project",
  NEED: "need",
});

const projectCommentSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    target: {
      type: String,
      enum: Object.values(COMMENT_TARGET),
      required: true,
    },
    stageId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    needId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    authorType: {
      type: String,
      enum: Object.values(COMMENT_AUTHOR_TYPE),
      required: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

projectCommentSchema.index({ projectId: 1, target: 1, needId: 1, createdAt: 1 });
projectCommentSchema.index({ projectId: 1, deletedAt: 1, createdAt: 1 });

module.exports = mongoose.model("ProjectComment", projectCommentSchema);
module.exports.COMMENT_AUTHOR_TYPE = COMMENT_AUTHOR_TYPE;
module.exports.COMMENT_TARGET = COMMENT_TARGET;
