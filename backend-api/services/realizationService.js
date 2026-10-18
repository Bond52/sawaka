const mongoose = require("mongoose");
const Domain = require("../models/Domain");
const Realization = require("../models/Realization");
const { REALIZATION_STATUS } = require("../models/Realization");
const ContributorProfile = require("../models/ContributorProfile");
const { PROFILE_STATUS } = ContributorProfile;
const { profilePhotoIssue } = require("./profilePhoto");
const { uploadRealizationImage, destroyStoredImage } = require("./imageStorage");
const {
  ContributorProfileError,
  getPublicProfile,
} = require("./ContributorProfileService");

const DESCRIPTION_MAX = 2000;
const MATERIAL_MAX = 120;
const CATALOG_LIMIT = 200;
const SEARCH_MAX = 200;
const MAX_GROUPS = 40;
const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const GROUP_FIELDS = new Set([
  "clientId",
  "description",
  "domainId",
  "completedOn",
  "mainMaterial",
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
  if (group.mainMaterial !== undefined && group.mainMaterial !== null && group.mainMaterial !== "") {
    if (typeof group.mainMaterial !== "string") return "MATERIAL_INVALID";
    if (group.mainMaterial.trim().length > MATERIAL_MAX) return "MATERIAL_TOO_LONG";
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
  const mainMaterial = raw.mainMaterial === undefined || raw.mainMaterial === null ? "" : raw.mainMaterial;
  if (typeof mainMaterial !== "string") return { error: "MATERIAL_INVALID" };
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
      mainMaterial: mainMaterial.trim(),
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
    mainMaterial: doc.mainMaterial || "",
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
    mainMaterial: doc.mainMaterial || "",
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
    const mainMaterial = group.mainMaterial || "";

    try {
      if (existing) {
        const previous = existing.images || [];
        existing.sequence = group.sequence;
        existing.description = group.description;
        existing.domainId = group.domainId;
        existing.completedOn = completedOn;
        existing.mainMaterial = mainMaterial;
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
          mainMaterial,
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

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readCatalogSearch(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") {
    throw new RealizationError("VALIDATION_ERROR", 400, { q: "INVALID" });
  }
  const trimmed = value.trim();
  if (trimmed.length > SEARCH_MAX) {
    throw new RealizationError("VALIDATION_ERROR", 400, { q: "TOO_LONG" });
  }
  return trimmed;
}

function readCatalogDomainId(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !OBJECT_ID_PATTERN.test(value) || !mongoose.isValidObjectId(value)) {
    throw new RealizationError("VALIDATION_ERROR", 400, { domainId: "INVALID" });
  }
  return value;
}

/**
 * Published realizations across publicly visible contributors.
 * The status filter is part of the query. Drafts are never loaded.
 * Search matches description and the contributor domain name only.
 */
async function listPublished(query = {}) {
  const q = readCatalogSearch(query.q);
  const domainId = readCatalogDomainId(query.domainId);
  const profiles = await ContributorProfile.find({
    status: PROFILE_STATUS.ACTIVE,
    isVisible: true,
  }).select("userId");
  const filter = {
    ownerId: { $in: profiles.map((profile) => profile.userId) },
    status: REALIZATION_STATUS.PUBLISHED,
  };
  if (domainId) filter.domainId = domainId;
  if (q) {
    const pattern = escapeRegex(q);
    const domains = await Domain.find({
      isActive: true,
      $or: [
        { nameFR: { $regex: pattern, $options: "i" } },
        { nameEN: { $regex: pattern, $options: "i" } },
      ],
    }).select("_id");
    filter.$or = [
      { description: { $regex: pattern, $options: "i" } },
      { domainId: { $in: domains.map((domain) => domain._id) } },
    ];
  }
  const docs = await Realization.find(filter)
    .sort({ createdAt: -1, sequence: 1 })
    .limit(CATALOG_LIMIT);
  return { realizations: docs.map(shapePublic) };
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

function publicDomain(domain) {
  if (!domain) return null;
  return {
    id: String(domain._id),
    nameFR: domain.nameFR,
    nameEN: domain.nameEN,
  };
}

/**
 * One published realization for the public detail page.
 * A draft, a hidden profile, and an unknown id share the same not-found result.
 */
async function getPublishedById(rawId) {
  const id = String(rawId || "");
  if (!OBJECT_ID_PATTERN.test(id) || !mongoose.isValidObjectId(id)) {
    throw new RealizationError("NOT_FOUND", 404);
  }
  const doc = await Realization.findOne({ _id: id, status: REALIZATION_STATUS.PUBLISHED });
  if (!doc) throw new RealizationError("NOT_FOUND", 404);
  const profile = await ContributorProfile.findOne({
    userId: doc.ownerId,
    status: PROFILE_STATUS.ACTIVE,
    isVisible: true,
  });
  if (!profile) throw new RealizationError("NOT_FOUND", 404);
  const [realizationDomain, contributorDomain] = await Promise.all([
    doc.domainId ? Domain.findById(doc.domainId).select("nameFR nameEN") : null,
    profile.domainId ? Domain.findById(profile.domainId).select("nameFR nameEN") : null,
  ]);
  return {
    realization: {
      id: String(doc._id),
      description: doc.description || "",
      domainId: doc.domainId ? String(doc.domainId) : null,
      domain: publicDomain(realizationDomain),
      completedOn: doc.completedOn || null,
      mainMaterial: doc.mainMaterial || "",
      images: (doc.images || []).map(publicImage),
    },
    contributor: {
      id: String(profile._id),
      displayName: profile.displayName,
      photoUrl: profile.photoUrl || null,
      city: profile.city || "",
      region: profile.region || "",
      country: profile.country || "",
      domain: publicDomain(contributorDomain),
    },
  };
}

module.exports = {
  DESCRIPTION_MAX,
  MATERIAL_MAX,
  REALIZATION_STATUS,
  RealizationError,
  isReadyToPublish,
  metadataIssue,
  summarizeCommit,
  commitBatch,
  listOwned,
  listPublic,
  listPublished,
  getPublishedById,
};
