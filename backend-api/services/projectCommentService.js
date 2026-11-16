const mongoose = require("mongoose");
const Project = require("../models/Project");
const { PROJECT_STATUS, PROJECT_VISIBILITY, COMMENT_ACCESS } = require("../models/Project");
const ProjectComment = require("../models/ProjectComment");
const {
  COMMENT_AUTHOR_TYPE,
  COMMENT_TARGET,
} = require("../models/ProjectComment");
const User = require("../models/user");
const { ProjectError, isPubliclyReadable } = require("./projectService");

const COMMENT_LIMIT = 2000;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

function isObjectId(value) {
  return typeof value === "string" && OBJECT_ID_PATTERN.test(value);
}

function resolveCommentAccess(project) {
  if (project.commentAccess === COMMENT_ACCESS.EVERYONE) return COMMENT_ACCESS.EVERYONE;
  return COMMENT_ACCESS.MEMBERS;
}

function findNeedInProject(project, needId) {
  if (!isObjectId(needId)) return null;
  for (const stage of project.stages || []) {
    const need = (stage.needs || []).find((item) => String(item._id) === String(needId));
    if (need) return { stage, need };
  }
  return null;
}

async function requirePublishedProject(projectId) {
  if (!isObjectId(projectId) || !mongoose.Types.ObjectId.isValid(projectId)) {
    throw new ProjectError("NOT_FOUND", 404);
  }
  const project = await Project.findById(projectId);
  if (!project || !isPubliclyReadable(project)) {
    throw new ProjectError("NOT_FOUND", 404);
  }
  return project;
}

function commentView(comment, authorLabel) {
  return {
    id: String(comment._id),
    projectId: String(comment.projectId),
    target: comment.target,
    needId: comment.needId ? String(comment.needId) : null,
    stageId: comment.stageId ? String(comment.stageId) : null,
    authorType: comment.authorType,
    authorLabel,
    authorId: comment.authorType === COMMENT_AUTHOR_TYPE.MEMBER && comment.authorId
      ? String(comment.authorId)
      : null,
    body: comment.body,
    createdAt: comment.createdAt,
  };
}

async function authorLabelsFor(comments) {
  const memberIds = [
    ...new Set(
      comments
        .filter((item) => item.authorType === COMMENT_AUTHOR_TYPE.MEMBER && item.authorId)
        .map((item) => String(item.authorId))
    ),
  ];
  if (memberIds.length === 0) return new Map();
  const users = await User.find({ _id: { $in: memberIds } })
    .select("username firstName")
    .lean();
  const map = new Map();
  for (const user of users) {
    const label = (user.firstName && String(user.firstName).trim()) || user.username || "Member";
    map.set(String(user._id), label);
  }
  return map;
}

async function listComments(projectId, options = {}) {
  const project = await requirePublishedProject(projectId);
  const filter = {
    projectId: project._id,
    deletedAt: null,
  };
  if (options.needId) {
    const located = findNeedInProject(project, options.needId);
    if (!located) throw new ProjectError("NEED_NOT_FOUND", 404);
    filter.target = COMMENT_TARGET.NEED;
    filter.needId = located.need._id;
  } else {
    filter.target = COMMENT_TARGET.PROJECT;
    filter.needId = null;
  }

  const comments = await ProjectComment.find(filter).sort({ createdAt: 1 }).limit(200);
  const labels = await authorLabelsFor(comments);
  return {
    commentAccess: resolveCommentAccess(project),
    comments: comments.map((comment) =>
      commentView(
        comment,
        comment.authorType === COMMENT_AUTHOR_TYPE.VISITOR
          ? null
          : labels.get(String(comment.authorId)) || "Member"
      )
    ),
  };
}

function parseCommentBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ProjectError("INVALID_BODY", 400);
  }
  if (typeof body.body !== "string") {
    throw new ProjectError("INVALID_FIELD", 400, ["body"]);
  }
  const trimmed = body.body.trim();
  if (!trimmed) throw new ProjectError("COMMENT_REQUIRED", 400, ["body"]);
  if (trimmed.length > COMMENT_LIMIT) throw new ProjectError("FIELD_TOO_LONG", 400, ["body"]);
  return trimmed;
}

async function createComment(projectId, authUser, body, options = {}) {
  const project = await requirePublishedProject(projectId);
  const access = resolveCommentAccess(project);
  const text = parseCommentBody(body);

  let authorType;
  let authorId = null;
  if (authUser && authUser.id) {
    authorType = COMMENT_AUTHOR_TYPE.MEMBER;
    authorId = authUser.id;
  } else {
    if (access !== COMMENT_ACCESS.EVERYONE) {
      throw new ProjectError("LOGIN_REQUIRED", 401);
    }
    authorType = COMMENT_AUTHOR_TYPE.VISITOR;
  }

  let target = COMMENT_TARGET.PROJECT;
  let stageId = null;
  let needId = null;
  if (options.needId) {
    const located = findNeedInProject(project, options.needId);
    if (!located) throw new ProjectError("NEED_NOT_FOUND", 404);
    target = COMMENT_TARGET.NEED;
    stageId = located.stage._id;
    needId = located.need._id;
  }

  const comment = await ProjectComment.create({
    projectId: project._id,
    target,
    stageId,
    needId,
    authorType,
    authorId,
    body: text,
  });

  let authorLabel = null;
  if (authorType === COMMENT_AUTHOR_TYPE.MEMBER) {
    const user = await User.findById(authorId).select("username firstName").lean();
    authorLabel = (user && user.firstName && String(user.firstName).trim()) || user?.username || "Member";
  }

  return { comment: commentView(comment, authorLabel) };
}

async function deleteComment(projectId, commentId, authUser) {
  if (!authUser || !authUser.id) throw new ProjectError("UNAUTHORIZED", 401);
  if (!isObjectId(commentId)) throw new ProjectError("NOT_FOUND", 404);

  const project = await requirePublishedProject(projectId);
  const comment = await ProjectComment.findOne({
    _id: commentId,
    projectId: project._id,
    deletedAt: null,
  });
  if (!comment) throw new ProjectError("NOT_FOUND", 404);

  const isOwner = String(project.ownerId) === String(authUser.id);
  const isAuthor =
    comment.authorType === COMMENT_AUTHOR_TYPE.MEMBER &&
    comment.authorId &&
    String(comment.authorId) === String(authUser.id);

  if (!isOwner && !isAuthor) {
    throw new ProjectError("FORBIDDEN", 403);
  }

  comment.deletedAt = new Date();
  await comment.save();
  return { ok: true };
}

module.exports = {
  COMMENT_LIMIT,
  resolveCommentAccess,
  listComments,
  createComment,
  deleteComment,
  findNeedInProject,
};
