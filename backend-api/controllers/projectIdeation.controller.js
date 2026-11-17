const ideationService = require("../services/projectIdeationService");
const { IdeationError } = require("../services/projectIdeationSchema");

function sendError(res, err) {
  if (err instanceof IdeationError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        fields: err.fields,
        details: err.details,
      },
    });
  }
  if (err?.name === "ProjectError") {
    return res.status(err.status || 400).json({
      error: { code: err.code, fields: err.fields },
    });
  }
  console.error("projectIdeation:", err);
  return res.status(500).json({ error: { code: "SERVER_ERROR" } });
}

async function generate(req, res) {
  try {
    const result = await ideationService.generateIdeas(req.body);
    return res.status(200).json(result);
  } catch (err) {
    return sendError(res, err);
  }
}

async function listMine(req, res) {
  try {
    const result = await ideationService.listIdeas(req.user.id);
    return res.status(200).json(result);
  } catch (err) {
    return sendError(res, err);
  }
}

async function save(req, res) {
  try {
    const result = await ideationService.saveIdea(req.user.id, req.body);
    return res.status(201).json(result);
  } catch (err) {
    return sendError(res, err);
  }
}

async function getMine(req, res) {
  try {
    const result = await ideationService.getIdea(req.user.id, req.params.id);
    return res.status(200).json(result);
  } catch (err) {
    return sendError(res, err);
  }
}

async function updateMine(req, res) {
  try {
    const result = await ideationService.updateIdea(req.user.id, req.params.id, req.body);
    return res.status(200).json(result);
  } catch (err) {
    return sendError(res, err);
  }
}

async function removeMine(req, res) {
  try {
    const result = await ideationService.deleteIdea(req.user.id, req.params.id);
    return res.status(200).json(result);
  } catch (err) {
    return sendError(res, err);
  }
}

async function convertMine(req, res) {
  try {
    const result = await ideationService.convertIdeaToProject(req.user.id, req.params.id);
    return res.status(201).json(result);
  } catch (err) {
    return sendError(res, err);
  }
}

async function convertPayload(req, res) {
  try {
    const result = await ideationService.convertPayloadToProject(req.user.id, req.body);
    return res.status(201).json(result);
  } catch (err) {
    return sendError(res, err);
  }
}

module.exports = {
  generate,
  listMine,
  save,
  getMine,
  updateMine,
  removeMine,
  convertMine,
  convertPayload,
};
