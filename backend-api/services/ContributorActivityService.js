const mongoose = require("mongoose");
const ContributorActivity = require("../models/ContributorActivity");

const DASHBOARD_LIMIT = 5;
const TITLE_MAX = 120;

class ContributorActivityError extends Error {
  constructor(code, status) {
    super(code);
    this.name = "ContributorActivityError";
    this.code = code;
    this.status = status;
  }
}

function titleSnapshot(value) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, TITLE_MAX);
}

/**
 * Records one activity after a business action has already succeeded.
 * A write failure is logged and does not undo that action.
 */
async function recordActivity({ userId, type, entityType, entityTitleSnapshot }) {
  try {
    if (!userId || !mongoose.isValidObjectId(userId)) return;
    await ContributorActivity.create({
      userId,
      type,
      entityType,
      entityTitleSnapshot: titleSnapshot(entityTitleSnapshot),
    });
  } catch (err) {
    console.error("ContributorActivityService.recordActivity:", {
      type,
      name: err && err.name,
      code: err && err.code,
    });
  }
}

function shapeActivity(doc) {
  const title = typeof doc.entityTitleSnapshot === "string" ? doc.entityTitleSnapshot.trim() : "";
  return {
    id: String(doc._id),
    type: doc.type,
    entityType: doc.entityType,
    title: title || null,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
  };
}

/**
 * Latest activity for the authenticated user. The caller must pass the session user id.
 */
async function listOwnActivity(userId) {
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw new ContributorActivityError("UNAUTHORIZED", 401);
  }
  const docs = await ContributorActivity.find({ userId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(DASHBOARD_LIMIT);
  return { activities: docs.map(shapeActivity) };
}

module.exports = {
  DASHBOARD_LIMIT,
  ContributorActivityError,
  recordActivity,
  listOwnActivity,
};
