const mongoose = require("mongoose");
const ContributorActivity = require("../models/ContributorActivity");

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const TITLE_MAX = 120;
const POSITIVE_INT = /^[1-9]\d*$/;

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

function readPageQuery(query) {
  const source = query && typeof query === "object" ? query : {};
  return {
    page: readPositiveInt(source.page, 1),
    limit: readPositiveInt(source.limit, DEFAULT_LIMIT, MAX_LIMIT),
  };
}

function readPositiveInt(value, fallback, max) {
  if (value === undefined) return fallback;
  if (Array.isArray(value) || typeof value !== "string" || !POSITIVE_INT.test(value)) {
    throw new ContributorActivityError("VALIDATION_ERROR", 400);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || (max !== undefined && parsed > max)) {
    throw new ContributorActivityError("VALIDATION_ERROR", 400);
  }
  return parsed;
}

/**
 * One page of activity for the authenticated user.
 * The caller must pass the session user id. query.ownerId is ignored.
 */
async function listOwnActivity(userId, query) {
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw new ContributorActivityError("UNAUTHORIZED", 401);
  }
  const { page, limit } = readPageQuery(query);
  const filter = { userId };
  const total = await ContributorActivity.countDocuments(filter);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const docs = await ContributorActivity.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  return {
    activities: docs.map(shapeActivity),
    page,
    limit,
    total,
    totalPages,
  };
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  ContributorActivityError,
  recordActivity,
  listOwnActivity,
};
