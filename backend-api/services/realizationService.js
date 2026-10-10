const mongoose = require("mongoose");
const Domain = require("../models/Domain");
const Realization = require("../models/Realization");
const { REALIZATION_STATUS } = require("../models/Realization");
const ContributorProfile = require("../models/ContributorProfile");
const { profilePhotoIssue } = require("./profilePhoto");
const { uploadRealizationImage, destroyStoredImage } = require("./imageStorage");
const {
  ContributorProfileError,
  getPublicProfile,
} = require("./ContributorProfileService");

const DESCRIPTION_MAX = 2000;
const MAX_GROUPS = 40;
const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const GROUP_FIELDS = new Set([
  "clientId",
  "description",
  "domainId",
  "completedOn",
  "photoIds",
  "sequence",
]);

class RealizationError extends Error {
  constructor(code, status, fields) {
    super(code);
    this.name = "RealizationError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

/** Same rule as the frontend isRealizationReady helper: at least one image. */
function isReadyToPublish(images) {
  return Array.isArray(images) && images.length > 0;
}

function metadataIssue(group) {
  if (typeof group.description !== "string") return "DESCRIPTION_INVALID";
  if (group.description.length > DESCRIPTION_MAX) return "DESCRIPTION_TOO_LONG";
  if (group.completedOn !== null && group.completedOn !== undefined && group.completedOn !== "") {
    if (!validDate(group.completedOn)) return "DATE_INVALID";
  }
  return null;
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function summarizeCommit(items) {
  const publishedCount = items.filter((item) => item.status === "published").length;
  const draftCount = items.filter((item) => item.status === "draft").length;
  const failedCount = items.filter((item) => item.status === "failed").length;
  let outcome = "success";
  if (failedCount > 0 && publishedCount + draftCount > 0) outcome = "partial";
  else if (failedCount > 0) outcome = "failed";
  return { outcome, publishedCount, draftCount, failedCount, items };
}

function parseManifest(raw) {
  let manifest = raw;
  if (typeof raw === "string") {
    try {
      manifest = JSON.parse(raw);
    } catch {
      throw new RealizationError("VALIDATION_ERROR", 400, { manifest: "INVALID" });
    }
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new RealizationError("VALIDATION_ERROR", 400, { manifest: "INVALID" });
  }
  const unexpected = Object.keys(manifest).filter((key) => key !== "intent" && key !== "groups");
  if (unexpected.length > 0) {
    throw new RealizationError("VALIDATION_ERROR", 400, { [unexpected[0]]: "FIELD_NOT_ALLOWED" });
  }
  if (manifest.intent !== "publish-ready" && manifest.intent !== "save-drafts") {
    throw new RealizationError("VALIDATION_ERROR", 400, { intent: "INVALID" });
  }
  if (!Array.isArray(manifest.groups) || manifest.groups.length === 0) {
    throw new RealizationError("VALIDATION_ERROR", 400, { groups: "REQUIRED" });
  }
  if (manifest.groups.length > MAX_GROUPS) {
    throw new RealizationError("VALIDATION_ERROR", 400, { groups: "TOO_MANY" });
  }
  return manifest;
}

function readGroup(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "GROUP_INVALID" };
  }
  const unexpected = Object.keys(raw).filter((key) => !GROUP_FIELDS.has(key));
  if (unexpected.length > 0) return { error: "FIELD_NOT_ALLOWED" };
  if (typeof raw.clientId !== "string" || !CLIENT_ID_PATTERN.test(raw.clientId)) {
    return { error: "CLIENT_ID_INVALID" };
  }
  if (!Number.isInteger(raw.sequence) || raw.sequence < 1 || raw.sequence > 10000) {
    return { error: "SEQUENCE_INVALID" };
  }
  const description = raw.description === undefined ? "" : raw.description;
  if (typeof description !== "string") return { error: "DESCRIPTION_INVALID" };
  let domainId = raw.domainId === undefined || raw.domainId === "" ? null : raw.domainId;
  if (domainId !== null && (typeof domainId !== "string" || !OBJECT_ID_PATTERN.test(domainId))) {
    return { error: "DOMAIN_INVALID" };
  }
  const completedOn =
    raw.completedOn === undefined || raw.completedOn === "" ? null : raw.completedOn;
  if (!Array.isArray(raw.photoIds) || raw.photoIds.some((id) => typeof id !== "string" || !id)) {
    return { error: "PHOTO_IDS_INVALID" };
  }
  return {
    group: {
      clientId: raw.clientId,
      sequence: raw.sequence,
      description,
      domainId,
      completedOn,
      photoIds: raw.photoIds,
    },
  };
}

function filesByKey(files) {
  const map = new Map();
  for (const file of files || []) {
    const name = String(file.originalname || "").split(/[/\\]/).pop();
    if (name) map.set(name, file);
  }
  return map;
}

function publicImage(image) {
  return { url: image.url };
}

function shapeOwned(doc) {
  return {
    id: String(doc._id),
    clientGroupId: doc.clientGroupId,
    sequence: doc.sequence,
    description: doc.description || "",
    domainId: doc.domainId ? String(doc.domainId) : null,
    completedOn: doc.completedOn || null,
    status: doc.status,
    images: (doc.images || []).map(publicImage),
  };
}

function shapePublic(doc) {
  return {
    id: String(doc._id),
    sequence: doc.sequence,
    description: doc.description || "",
    domainId: doc.domainId ? String(doc.domainId) : null,
    completedOn: doc.completedOn || null,
    images: (doc.images || []).map(publicImage),
  };
}

async function discard(images) {
  for (const image of images) {
    try {
      await destroyStoredImage(image.publicId);
    } catch (err) {
      console.error("realizationService.discard:", { name: err && err.name, code: err && err.code });
    }
  }
}

async function storeImages(photoIds, files) {
  const stored = [];
  for (const photoId of photoIds) {
    const file = files.get(photoId);
    if (!file) {
      await discard(stored);
      return { error: "IMAGE_MISSING" };
    }
    const issue = profilePhotoIssue(file);
    if (issue) {
      await discard(stored);
      return { error: issue === "PHOTO_REQUIRED" ? "IMAGE_MISSING" : issue };
    }
    try {
      const uploaded = await uploadRealizationImage(file.buffer);
      stored.push(uploaded);
    } catch (err) {
      console.error("realizationService.storeImages:", { name: err && err.name, code: err && err.code });
      await discard(stored);
      return { error: "UPLOAD_FAILED" };
    } finally {
      file.buffer = null;
    }
  }
  return { images: stored };
}

async function domainExists(domainId) {
  if (!domainId) return true;
  if (!mongoose.isValidObjectId(domainId)) return false;
  const domain = await Domain.findOne({ _id: domainId, isActive: true }).select("_id");
  return Boolean(domain);
}

async function commitBatch({ ownerId, manifest: rawManifest, files }) {
  if (!ownerId || !mongoose.isValidObjectId(ownerId)) {
    throw new RealizationError("UNAUTHORIZED", 401);
  }
  const manifest = parseManifest(rawManifest);
  const library = filesByKey(files);
  const seen = new Set();
  const items = [];

  for (const rawGroup of manifest.groups) {
    const parsed = readGroup(rawGroup);
    if (parsed.error) {
      items.push({ clientId: null, status: "failed", code: parsed.error });
      continue;
    }
    const group = parsed.group;
    if (seen.has(group.clientId)) {
      items.push({ clientId: group.clientId, status: "failed", code: "CLIENT_ID_DUPLICATE" });
      continue;
    }
    seen.add(group.clientId);

    const issue = metadataIssue(group);
    if (issue || !(await domainExists(group.domainId))) {
      items.push({
        clientId: group.clientId,
        status: "failed",
        code: issue || "DOMAIN_INVALID",
      });
      continue;
    }

    const existing = await Realization.findOne({ ownerId, clientGroupId: group.clientId });
    if (existing && existing.status === REALIZATION_STATUS.PUBLISHED) {
      items.push({ clientId: group.clientId, status: "published", id: String(existing._id) });
      continue;
    }

    const stored = group.photoIds.length === 0 ? { images: [] } : await storeImages(group.photoIds, library);
    if (stored.error) {
      items.push({ clientId: group.clientId, status: "failed", code: stored.error });
      continue;
    }

    const publish =
      manifest.intent === "publish-ready" && isReadyToPublish(stored.images);
    const status = publish ? REALIZATION_STATUS.PUBLISHED : REALIZATION_STATUS.DRAFT;
    const completedOn = group.completedOn || null;

    try {
      if (existing) {
        const previous = existing.images || [];
        existing.sequence = group.sequence;
        existing.description = group.description;
        existing.domainId = group.domainId;
        existing.completedOn = completedOn;
        existing.status = status;
        existing.images = stored.images;
        await existing.save();
        await discard(previous);
        items.push({ clientId: group.clientId, status, id: String(existing._id) });
      } else {
        const created = await Realization.create({
          ownerId,
          clientGroupId: group.clientId,
          sequence: group.sequence,
          description: group.description,
          domainId: group.domainId,
          completedOn,
          status,
          images: stored.images,
        });
        items.push({ clientId: group.clientId, status, id: String(created._id) });
      }
    } catch (err) {
      await discard(stored.images);
      if (err && err.code === 11000) {
        const raced = await Realization.findOne({ ownerId, clientGroupId: group.clientId });
        if (raced) {
          items.push({
            clientId: group.clientId,
            status: raced.status,
            id: String(raced._id),
          });
          continue;
        }
      }
      console.error("realizationService.commitBatch:", { name: err && err.name, code: err && err.code });
      items.push({ clientId: group.clientId, status: "failed", code: "SAVE_FAILED" });
    }
  }

  return summarizeCommit(items);
}

async function listOwned(ownerId) {
  if (!ownerId || !mongoose.isValidObjectId(ownerId)) {
    throw new RealizationError("UNAUTHORIZED", 401);
  }
  const docs = await Realization.find({ ownerId }).sort({ sequence: 1, createdAt: 1 });
  return { realizations: docs.map(shapeOwned) };
}

async function listPublic(profileId) {
  let profile;
  try {
    profile = await getPublicProfile(profileId);
  } catch (err) {
    if (err instanceof ContributorProfileError) throw err;
    throw err;
  }
  const stored = await ContributorProfile.findById(profile.id).select("userId");
  if (!stored) {
    throw new ContributorProfileError("CONTRIBUTOR_PROFILE_NOT_FOUND", 404);
  }
  const docs = await Realization.find({
    ownerId: stored.userId,
    status: REALIZATION_STATUS.PUBLISHED,
  }).sort({ sequence: 1, createdAt: 1 });
  return { realizations: docs.map(shapePublic) };
}

module.exports = {
  DESCRIPTION_MAX,
  REALIZATION_STATUS,
  RealizationError,
  isReadyToPublish,
  metadataIssue,
  summarizeCommit,
  commitBatch,
  listOwned,
  listPublic,
};
