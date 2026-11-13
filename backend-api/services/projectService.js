const mongoose = require("mongoose");
const Project = require("../models/Project");
const { PROJECT_STATUS, PROJECT_VISIBILITY } = require("../models/Project");
const { recordUserAuditEvent, USER_AUDIT_ACTIONS } = require("./AuditService");

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
  createDraft,
  listOwned,
  getOwned,
  updateOwned,
  publishOwned,
  listPublic,
  getPublic,
};
