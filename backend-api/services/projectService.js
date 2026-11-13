const mongoose = require("mongoose");
const Project = require("../models/Project");
const {
  PROJECT_STATUS,
  PROJECT_VISIBILITY,
  STAGE_STATUS,
  NEED_KIND,
  NEED_STATUS,
} = require("../models/Project");
const { recordUserAuditEvent, USER_AUDIT_ACTIONS } = require("./AuditService");
const { profilePhotoIssue } = require("./profilePhoto");
const { uploadProjectImage, destroyStoredImage } = require("./imageStorage");

const MAX_PROJECT_IMAGES = 8;
const MAX_STAGE_IMAGES = 6;

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

const FIELD_LIMITS = Object.freeze({
  title: 120,
  summary: 280,
  description: 4000,
  objective: 2000,
  category: 80,
  country: 80,
  city: 80,
});

const EDITABLE_FIELDS = Object.freeze(Object.keys(FIELD_LIMITS));
const EDITABLE_FIELD_SET = new Set(EDITABLE_FIELDS);

const STAGE_FIELDS = Object.freeze(["title", "description", "status", "blockerExplanation"]);
const NEED_FIELDS = Object.freeze(["title", "description", "kind", "status", "blockerExplanation"]);
const NEED_FIELD_SET = new Set(NEED_FIELDS);
const NEED_LIMITS = Object.freeze({
  title: 120,
  description: 2000,
  blockerExplanation: 1000,
});
const STAGE_FIELD_SET = new Set(STAGE_FIELDS);
const STAGE_LIMITS = Object.freeze({
  title: 120,
  description: 2000,
  blockerExplanation: 1000,
});

function imageView(image) {
  if (!image || !image.url) return null;
  return { id: String(image._id), url: image.url };
}

function needView(need) {
  return {
    id: String(need._id),
    title: need.title || "",
    description: need.description || "",
    kind: need.kind,
    status: need.status,
    blockerExplanation: need.blockerExplanation || "",
  };
}

function stageView(stage) {
  return {
    id: String(stage._id),
    title: stage.title || "",
    description: stage.description || "",
    position: stage.position,
    status: stage.status,
    blockerExplanation: stage.blockerExplanation || "",
    needs: [...(stage.needs || [])].map(needView),
    images: [...(stage.images || [])].map(imageView).filter(Boolean),
  };
}

function sortedStages(project) {
  return [...(project.stages || [])].sort((a, b) => a.position - b.position);
}

function projectProgress(stages) {
  const eligible = (stages || []).filter((stage) => stage.status !== STAGE_STATUS.CANCELLED);
  if (eligible.length === 0) {
    return { available: false, percent: null };
  }
  const completed = eligible.filter((stage) => stage.status === STAGE_STATUS.COMPLETED).length;
  return {
    available: true,
    percent: Math.round((completed / eligible.length) * 100),
  };
}

const PUBLICATION_FIELDS = Object.freeze([
  "title",
  "description",
  "objective",
  "category",
  "country",
  "city",
]);

class ProjectError extends Error {
  constructor(code, status, fields) {
    super(code);
    this.name = "ProjectError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

function isObjectId(value) {
  return typeof value === "string" && OBJECT_ID_PATTERN.test(value);
}

/**
 * Drafts may be incomplete. Only allowlisted strings are accepted.
 * ownerId, lifecycle, and visibility are never taken from the client.
 */
function editableProjectUpdate(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ProjectError("INVALID_BODY", 400);
  }

  const rejected = Object.keys(body).filter((key) => !EDITABLE_FIELD_SET.has(key));
  if (rejected.length > 0) {
    throw new ProjectError("FIELD_NOT_ALLOWED", 400, rejected);
  }

  const updates = {};
  for (const field of EDITABLE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    const value = body[field];
    if (typeof value !== "string") {
      throw new ProjectError("INVALID_FIELD", 400, [field]);
    }
    const trimmed = value.trim();
    if (trimmed.length > FIELD_LIMITS[field]) {
      throw new ProjectError("FIELD_TOO_LONG", 400, [field]);
    }
    updates[field] = trimmed;
  }
  return updates;
}

function missingPublicationFields(project) {
  return PUBLICATION_FIELDS.filter((field) => {
    const value = project[field];
    return typeof value !== "string" || value.trim().length === 0;
  });
}

function isPubliclyReadable(project) {
  return (
    project &&
    project.status === PROJECT_STATUS.PUBLISHED &&
    project.visibility === PROJECT_VISIBILITY.PUBLIC
  );
}

function ownerProjectView(project) {
  return {
    id: String(project._id),
    title: project.title || "",
    summary: project.summary || "",
    description: project.description || "",
    objective: project.objective || "",
    category: project.category || "",
    country: project.country || "",
    city: project.city || "",
    status: project.status,
    visibility: project.visibility,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    coverImage: imageView(project.coverImage),
    images: [...(project.images || [])].map(imageView).filter(Boolean),
    stages: sortedStages(project).map(stageView),
    progress: projectProgress(sortedStages(project)),
  };
}

/** Public readers never receive owner identifiers or draft records. */
function publicProjectView(project) {
  return {
    id: String(project._id),
    title: project.title || "",
    summary: project.summary || "",
    description: project.description || "",
    objective: project.objective || "",
    category: project.category || "",
    country: project.country || "",
    city: project.city || "",
    status: project.status,
    publishedAt: project.publishedAt || null,
    coverImage: imageView(project.coverImage),
    images: [...(project.images || [])].map(imageView).filter(Boolean),
    stages: sortedStages(project).map(stageView),
    progress: projectProgress(sortedStages(project)),
  };
}

async function findProject(id) {
  if (!isObjectId(id) || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ProjectError("NOT_FOUND", 404);
  }
  const project = await Project.findById(id);
  if (!project) throw new ProjectError("NOT_FOUND", 404);
  return project;
}

async function findOwnedProject(ownerId, id) {
  const project = await findProject(id);
  if (String(project.ownerId) !== String(ownerId)) {
    throw new ProjectError("FORBIDDEN", 403);
  }
  return project;
}

async function createDraft(ownerId, body) {
  const updates = editableProjectUpdate(body || {});
  const project = await Project.create({
    ownerId,
    ...updates,
    status: PROJECT_STATUS.DRAFT,
    visibility: PROJECT_VISIBILITY.PRIVATE,
    publishedAt: null,
  });
  await recordUserAuditEvent({
    action: USER_AUDIT_ACTIONS.PROJECT_DRAFT_SAVED,
    userId: ownerId,
    metadata: { projectId: String(project._id) },
  });
  return { project: ownerProjectView(project) };
}

async function listOwned(ownerId) {
  const projects = await Project.find({ ownerId }).sort({ updatedAt: -1 }).limit(100);
  return { projects: projects.map(ownerProjectView) };
}

async function getOwned(ownerId, id) {
  const project = await findOwnedProject(ownerId, id);
  return { project: ownerProjectView(project) };
}

async function updateOwned(ownerId, id, body) {
  const updates = editableProjectUpdate(body);
  const project = await findOwnedProject(ownerId, id);
  const changed = [];
  for (const [field, value] of Object.entries(updates)) {
    if (project[field] !== value) changed.push(field);
    project[field] = value;
  }
  await project.save();
  await recordUserAuditEvent({
    action: USER_AUDIT_ACTIONS.PROJECT_UPDATED,
    userId: ownerId,
    metadata: { projectId: String(project._id), fields: changed },
  });
  return { project: ownerProjectView(project) };
}

async function publishOwned(ownerId, id, body) {
  const updates = body && Object.keys(body).length > 0 ? editableProjectUpdate(body) : {};
  const project = await findOwnedProject(ownerId, id);
  if (project.status === PROJECT_STATUS.PUBLISHED) {
    throw new ProjectError("ALREADY_PUBLISHED", 409);
  }

  for (const [field, value] of Object.entries(updates)) {
    project[field] = value;
  }

  const missing = missingPublicationFields(project);
  if (missing.length > 0) {
    await project.save();
    throw new ProjectError("PUBLICATION_INCOMPLETE", 422, missing);
  }

  project.status = PROJECT_STATUS.PUBLISHED;
  project.visibility = PROJECT_VISIBILITY.PUBLIC;
  project.publishedAt = new Date();
  await project.save();
  await recordUserAuditEvent({
    action: USER_AUDIT_ACTIONS.PROJECT_PUBLISHED,
    userId: ownerId,
    metadata: { projectId: String(project._id) },
  });
  return { project: ownerProjectView(project) };
}

async function listPublic() {
  const projects = await Project.find({
    status: PROJECT_STATUS.PUBLISHED,
    visibility: PROJECT_VISIBILITY.PUBLIC,
  })
    .sort({ publishedAt: -1, updatedAt: -1 })
    .limit(100);
  return { projects: projects.map(publicProjectView) };
}

async function getPublic(id) {
  const project = await findProject(id);
  if (!isPubliclyReadable(project)) {
    throw new ProjectError("NOT_FOUND", 404);
  }
  return { project: publicProjectView(project) };
}

function stageChanges(body, requireTitle) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ProjectError("INVALID_BODY", 400);
  }
  const rejected = Object.keys(body).filter((key) => !STAGE_FIELD_SET.has(key));
  if (rejected.length > 0) {
    throw new ProjectError("FIELD_NOT_ALLOWED", 400, rejected);
  }

  const updates = {};
  for (const field of STAGE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    const value = body[field];
    if (typeof value !== "string") {
      throw new ProjectError("INVALID_FIELD", 400, [field]);
    }
    const trimmed = value.trim();
    if (field === "status") {
      if (!Object.values(STAGE_STATUS).includes(trimmed)) {
        throw new ProjectError("INVALID_STAGE_STATUS", 400, ["status"]);
      }
      updates.status = trimmed;
      continue;
    }
    if (trimmed.length > STAGE_LIMITS[field]) {
      throw new ProjectError("FIELD_TOO_LONG", 400, [field]);
    }
    updates[field] = trimmed;
  }
  if (requireTitle && !updates.title) {
    throw new ProjectError("STAGE_TITLE_REQUIRED", 400, ["title"]);
  }
  return updates;
}

async function recordStageChange(ownerId, projectId, operation, stageId) {
  await recordUserAuditEvent({
    action: USER_AUDIT_ACTIONS.PROJECT_STAGES_CHANGED,
    userId: ownerId,
    metadata: {
      projectId: String(projectId),
      operation,
      ...(stageId ? { stageId: String(stageId) } : {}),
    },
  });
}

async function createStage(ownerId, projectId, body) {
  const updates = stageChanges(body, true);
  const project = await findOwnedProject(ownerId, projectId);
  project.stages.push({
    title: updates.title,
    description: updates.description || "",
    position: project.stages.length,
    status: updates.status || STAGE_STATUS.NOT_STARTED,
    blockerExplanation: updates.blockerExplanation || "",
  });
  await project.save();
  const created = project.stages[project.stages.length - 1];
  await recordStageChange(ownerId, project._id, "created", created._id);
  return { project: ownerProjectView(project) };
}

async function updateStage(ownerId, projectId, stageId, body) {
  const updates = stageChanges(body, false);
  const project = await findOwnedProject(ownerId, projectId);
  const stage = project.stages.id(stageId);
  if (!stage) throw new ProjectError("STAGE_NOT_FOUND", 404);
  if (Object.prototype.hasOwnProperty.call(updates, "title") && updates.title.length === 0) {
    throw new ProjectError("STAGE_TITLE_REQUIRED", 400, ["title"]);
  }
  Object.assign(stage, updates);
  await project.save();
  await recordStageChange(ownerId, project._id, "updated", stage._id);
  return { project: ownerProjectView(project) };
}

async function reorderStages(ownerId, projectId, body) {
  if (!body || !Array.isArray(body.orderedIds)) {
    throw new ProjectError("INVALID_BODY", 400);
  }
  const project = await findOwnedProject(ownerId, projectId);
  const current = sortedStages(project).map((stage) => String(stage._id));
  const orderedIds = body.orderedIds.map((id) => String(id));
  const sameSet =
    orderedIds.length === current.length &&
    new Set(orderedIds).size === orderedIds.length &&
    orderedIds.every((id) => current.includes(id));
  if (!sameSet) throw new ProjectError("INVALID_STAGE_ORDER", 400);

  orderedIds.forEach((id, index) => {
    project.stages.id(id).position = index;
  });
  await project.save();
  await recordStageChange(ownerId, project._id, "reordered");
  return { project: ownerProjectView(project) };
}

function needChanges(body, requireIdentity) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ProjectError("INVALID_BODY", 400);
  }
  const rejected = Object.keys(body).filter((key) => !NEED_FIELD_SET.has(key));
  if (rejected.length > 0) {
    throw new ProjectError("FIELD_NOT_ALLOWED", 400, rejected);
  }

  const updates = {};
  for (const field of NEED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    const value = body[field];
    if (typeof value !== "string") {
      throw new ProjectError("INVALID_FIELD", 400, [field]);
    }
    const trimmed = value.trim();
    if (field === "status") {
      if (!Object.values(NEED_STATUS).includes(trimmed)) {
        throw new ProjectError("INVALID_NEED_STATUS", 400, ["status"]);
      }
      updates.status = trimmed;
      continue;
    }
    if (field === "kind") {
      if (!Object.values(NEED_KIND).includes(trimmed)) {
        throw new ProjectError("INVALID_NEED_KIND", 400, ["kind"]);
      }
      updates.kind = trimmed;
      continue;
    }
    if (trimmed.length > NEED_LIMITS[field]) {
      throw new ProjectError("FIELD_TOO_LONG", 400, [field]);
    }
    updates[field] = trimmed;
  }
  if (requireIdentity) {
    if (!updates.title) throw new ProjectError("NEED_TITLE_REQUIRED", 400, ["title"]);
    if (!updates.kind) throw new ProjectError("NEED_KIND_REQUIRED", 400, ["kind"]);
  }
  return updates;
}

function finalizeNeed(current, updates) {
  const status = updates.status || current.status || NEED_STATUS.OPEN;
  const explanation = Object.prototype.hasOwnProperty.call(updates, "blockerExplanation")
    ? updates.blockerExplanation
    : current.blockerExplanation || "";
  if (status === NEED_STATUS.BLOCKED && String(explanation).trim().length === 0) {
    throw new ProjectError("BLOCKER_EXPLANATION_REQUIRED", 400, ["blockerExplanation"]);
  }
  return {
    title: updates.title !== undefined ? updates.title : current.title || "",
    description: updates.description !== undefined ? updates.description : current.description || "",
    kind: updates.kind || current.kind,
    status,
    blockerExplanation: status === NEED_STATUS.BLOCKED ? String(explanation).trim() : "",
  };
}

function requireParentStage(stages, stageId) {
  if (typeof stageId !== "string" || !OBJECT_ID_PATTERN.test(stageId)) {
    throw new ProjectError("STAGE_NOT_FOUND", 404);
  }
  const stage = [...(stages || [])].find((item) => String(item._id || item.id) === stageId);
  if (!stage) throw new ProjectError("STAGE_NOT_FOUND", 404);
  return stage;
}

async function recordNeedChange(ownerId, projectId, stageId, needId, operation) {
  await recordUserAuditEvent({
    action: USER_AUDIT_ACTIONS.PROJECT_NEEDS_CHANGED,
    userId: ownerId,
    metadata: {
      projectId: String(projectId),
      stageId: String(stageId),
      needId: String(needId),
      operation,
    },
  });
}

async function createNeed(ownerId, projectId, stageId, body) {
  const updates = needChanges(body, true);
  const project = await findOwnedProject(ownerId, projectId);
  const stage = requireParentStage(project.stages, stageId);
  const next = finalizeNeed(
    { title: "", description: "", kind: updates.kind, status: NEED_STATUS.OPEN, blockerExplanation: "" },
    updates
  );
  stage.needs.push(next);
  await project.save();
  const created = stage.needs[stage.needs.length - 1];
  await recordNeedChange(ownerId, project._id, stage._id, created._id, "created");
  return { project: ownerProjectView(project) };
}

async function updateNeed(ownerId, projectId, stageId, needId, body) {
  const updates = needChanges(body, false);
  const project = await findOwnedProject(ownerId, projectId);
  const stage = requireParentStage(project.stages, stageId);
  const need = [...(stage.needs || [])].find((item) => String(item._id) === String(needId));
  if (!need) throw new ProjectError("NEED_NOT_FOUND", 404);
  if (Object.prototype.hasOwnProperty.call(updates, "title") && updates.title.length === 0) {
    throw new ProjectError("NEED_TITLE_REQUIRED", 400, ["title"]);
  }
  Object.assign(need, finalizeNeed(need, updates));
  await project.save();
  await recordNeedChange(ownerId, project._id, stage._id, need._id, "updated");
  return { project: ownerProjectView(project) };
}

async function removeNeed(ownerId, projectId, stageId, needId) {
  const project = await findOwnedProject(ownerId, projectId);
  const stage = requireParentStage(project.stages, stageId);
  const need = [...(stage.needs || [])].find((item) => String(item._id) === String(needId));
  if (!need) throw new ProjectError("NEED_NOT_FOUND", 404);
  stage.needs.pull(need._id);
  await project.save();
  await recordNeedChange(ownerId, project._id, stage._id, need._id, "removed");
  return { project: ownerProjectView(project) };
}

function assertImageFile(file) {
  const issue = profilePhotoIssue(file);
  if (issue === "PHOTO_REQUIRED") throw new ProjectError("IMAGE_REQUIRED", 400);
  if (issue) throw new ProjectError(issue, 400);
}

async function storeProjectImage(file) {
  assertImageFile(file);
  try {
    return await uploadProjectImage(file.buffer);
  } catch (err) {
    console.error("projectService.uploadProjectImage:", {
      name: err && err.name,
      code: err && err.code,
    });
    throw new ProjectError("UPLOAD_FAILED", 502);
  }
}

async function discardStoredImage(publicId) {
  if (!publicId) return;
  try {
    await destroyStoredImage(publicId);
  } catch (err) {
    console.error("projectService.destroyStoredImage:", {
      name: err && err.name,
      code: err && err.code,
    });
  }
}

async function recordMediaChange(ownerId, projectId, operation, extra) {
  await recordUserAuditEvent({
    action: USER_AUDIT_ACTIONS.PROJECT_MEDIA_CHANGED,
    userId: ownerId,
    metadata: {
      projectId: String(projectId),
      operation,
      ...(extra || {}),
    },
  });
}

async function setCover(ownerId, projectId, file) {
  const project = await findOwnedProject(ownerId, projectId);
  const uploaded = await storeProjectImage(file);
  const previousPublicId = project.coverImage && project.coverImage.publicId;
  project.coverImage = { url: uploaded.url, publicId: uploaded.publicId };
  try {
    await project.save();
  } catch (err) {
    await discardStoredImage(uploaded.publicId);
    throw err;
  }
  if (previousPublicId && previousPublicId !== uploaded.publicId) {
    await discardStoredImage(previousPublicId);
  }
  await recordMediaChange(ownerId, project._id, "cover_set");
  return { project: ownerProjectView(project) };
}

async function removeCover(ownerId, projectId) {
  const project = await findOwnedProject(ownerId, projectId);
  const previousPublicId = project.coverImage && project.coverImage.publicId;
  project.coverImage = null;
  await project.save();
  await discardStoredImage(previousPublicId);
  await recordMediaChange(ownerId, project._id, "cover_removed");
  return { project: ownerProjectView(project) };
}

async function addProjectImage(ownerId, projectId, file) {
  const project = await findOwnedProject(ownerId, projectId);
  if ((project.images || []).length >= MAX_PROJECT_IMAGES) {
    throw new ProjectError("IMAGE_LIMIT", 400);
  }
  const uploaded = await storeProjectImage(file);
  project.images.push({ url: uploaded.url, publicId: uploaded.publicId });
  try {
    await project.save();
  } catch (err) {
    await discardStoredImage(uploaded.publicId);
    throw err;
  }
  const created = project.images[project.images.length - 1];
  await recordMediaChange(ownerId, project._id, "image_added", { imageId: String(created._id) });
  return { project: ownerProjectView(project) };
}

async function removeProjectImage(ownerId, projectId, imageId) {
  const project = await findOwnedProject(ownerId, projectId);
  const image = [...(project.images || [])].find((item) => String(item._id) === String(imageId));
  if (!image) throw new ProjectError("IMAGE_NOT_FOUND", 404);
  const publicId = image.publicId;
  project.images.pull(image._id);
  await project.save();
  await discardStoredImage(publicId);
  await recordMediaChange(ownerId, project._id, "image_removed", { imageId: String(imageId) });
  return { project: ownerProjectView(project) };
}

async function addStageImage(ownerId, projectId, stageId, file) {
  const project = await findOwnedProject(ownerId, projectId);
  const stage = requireParentStage(project.stages, stageId);
  if ((stage.images || []).length >= MAX_STAGE_IMAGES) {
    throw new ProjectError("IMAGE_LIMIT", 400);
  }
  const uploaded = await storeProjectImage(file);
  stage.images.push({ url: uploaded.url, publicId: uploaded.publicId });
  try {
    await project.save();
  } catch (err) {
    await discardStoredImage(uploaded.publicId);
    throw err;
  }
  const created = stage.images[stage.images.length - 1];
  await recordMediaChange(ownerId, project._id, "stage_image_added", {
    stageId: String(stage._id),
    imageId: String(created._id),
  });
  return { project: ownerProjectView(project) };
}

async function removeStageImage(ownerId, projectId, stageId, imageId) {
  const project = await findOwnedProject(ownerId, projectId);
  const stage = requireParentStage(project.stages, stageId);
  const image = [...(stage.images || [])].find((item) => String(item._id) === String(imageId));
  if (!image) throw new ProjectError("IMAGE_NOT_FOUND", 404);
  const publicId = image.publicId;
  stage.images.pull(image._id);
  await project.save();
  await discardStoredImage(publicId);
  await recordMediaChange(ownerId, project._id, "stage_image_removed", {
    stageId: String(stage._id),
    imageId: String(imageId),
  });
  return { project: ownerProjectView(project) };
}

module.exports = {
  ProjectError,
  FIELD_LIMITS,
  EDITABLE_FIELDS,
  PUBLICATION_FIELDS,
  editableProjectUpdate,
  missingPublicationFields,
  isPubliclyReadable,
  ownerProjectView,
  publicProjectView,
  stageView,
  projectProgress,
  createDraft,
  listOwned,
  getOwned,
  updateOwned,
  publishOwned,
  createStage,
  updateStage,
  reorderStages,
  needChanges,
  finalizeNeed,
  requireParentStage,
  createNeed,
  updateNeed,
  removeNeed,
  imageView,
  MAX_PROJECT_IMAGES,
  MAX_STAGE_IMAGES,
  setCover,
  removeCover,
  addProjectImage,
  removeProjectImage,
  addStageImage,
  removeStageImage,
  listPublic,
  getPublic,
};
