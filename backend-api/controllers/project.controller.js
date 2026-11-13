const projectService = require("../services/projectService");
const { ProjectError } = projectService;

function sendFunctionalError(res, err) {
  const body = { error: { code: err.code } };
  if (err.fields) body.error.fields = err.fields;
  return res.status(err.status || 400).json(body);
}

function logTechnical(scope, err) {
  console.error(scope, {
    name: err && err.name,
    code: err && err.code,
  });
}

async function createDraft(req, res) {
  try {
    const result = await projectService.createDraft(req.user.id, req.body);
    return res.status(201).json(result);
  } catch (err) {
    if (err instanceof ProjectError) return sendFunctionalError(res, err);
    logTechnical("project.controller.createDraft:", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function listOwned(req, res) {
  try {
    const result = await projectService.listOwned(req.user.id);
    return res.json(result);
  } catch (err) {
    if (err instanceof ProjectError) return sendFunctionalError(res, err);
    logTechnical("project.controller.listOwned:", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function getOwned(req, res) {
  try {
    const result = await projectService.getOwned(req.user.id, req.params.id);
    return res.json(result);
  } catch (err) {
    if (err instanceof ProjectError) return sendFunctionalError(res, err);
    logTechnical("project.controller.getOwned:", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function updateOwned(req, res) {
  try {
    const result = await projectService.updateOwned(req.user.id, req.params.id, req.body);
    return res.json(result);
  } catch (err) {
    if (err instanceof ProjectError) return sendFunctionalError(res, err);
    logTechnical("project.controller.updateOwned:", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function publishOwned(req, res) {
  try {
    const result = await projectService.publishOwned(req.user.id, req.params.id, req.body);
    return res.json(result);
  } catch (err) {
    if (err instanceof ProjectError) return sendFunctionalError(res, err);
    logTechnical("project.controller.publishOwned:", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function listPublic(req, res) {
  try {
    const result = await projectService.listPublic();
    return res.json(result);
  } catch (err) {
    if (err instanceof ProjectError) return sendFunctionalError(res, err);
    logTechnical("project.controller.listPublic:", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function getPublic(req, res) {
  try {
    const result = await projectService.getPublic(req.params.id);
    return res.json(result);
  } catch (err) {
    if (err instanceof ProjectError) return sendFunctionalError(res, err);
    logTechnical("project.controller.getPublic:", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

module.exports = {
  createDraft,
  listOwned,
  getOwned,
  updateOwned,
  publishOwned,
  listPublic,
  getPublic,
};
