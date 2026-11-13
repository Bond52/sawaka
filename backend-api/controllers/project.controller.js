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

async function createStage(req, res) {
  try {
    const result = await projectService.createStage(req.user.id, req.params.id, req.body);
    return res.status(201).json(result);
  } catch (err) {
    if (err instanceof ProjectError) return sendFunctionalError(res, err);
    logTechnical("project.controller.createStage:", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function updateStage(req, res) {
  try {
    const result = await projectService.updateStage(
      req.user.id,
      req.params.id,
      req.params.stageId,
      req.body
    );
    return res.json(result);
  } catch (err) {
    if (err instanceof ProjectError) return sendFunctionalError(res, err);
    logTechnical("project.controller.updateStage:", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function reorderStages(req, res) {
  try {
    const result = await projectService.reorderStages(req.user.id, req.params.id, req.body);
    return res.json(result);
  } catch (err) {
    if (err instanceof ProjectError) return sendFunctionalError(res, err);
    logTechnical("project.controller.reorderStages:", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function createNeed(req, res) {
  try {
    const result = await projectService.createNeed(
      req.user.id,
      req.params.id,
      req.params.stageId,
      req.body
    );
    return res.status(201).json(result);
  } catch (err) {
    if (err instanceof ProjectError) return sendFunctionalError(res, err);
    logTechnical("project.controller.createNeed:", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function updateNeed(req, res) {
  try {
    const result = await projectService.updateNeed(
      req.user.id,
      req.params.id,
      req.params.stageId,
      req.params.needId,
      req.body
    );
    return res.json(result);
  } catch (err) {
    if (err instanceof ProjectError) return sendFunctionalError(res, err);
    logTechnical("project.controller.updateNeed:", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function removeNeed(req, res) {
  try {
    const result = await projectService.removeNeed(
      req.user.id,
      req.params.id,
      req.params.stageId,
      req.params.needId
    );
    return res.json(result);
  } catch (err) {
    if (err instanceof ProjectError) return sendFunctionalError(res, err);
    logTechnical("project.controller.removeNeed:", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function setCover(req, res) {
  try {
    const result = await projectService.setCover(req.user.id, req.params.id, req.file);
    return res.json(result);
  } catch (err) {
    if (err instanceof ProjectError) return sendFunctionalError(res, err);
    logTechnical("project.controller.setCover:", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function removeCover(req, res) {
  try {
    const result = await projectService.removeCover(req.user.id, req.params.id);
    return res.json(result);
  } catch (err) {
    if (err instanceof ProjectError) return sendFunctionalError(res, err);
    logTechnical("project.controller.removeCover:", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function addProjectImage(req, res) {
  try {
    const result = await projectService.addProjectImage(req.user.id, req.params.id, req.file);
    return res.status(201).json(result);
  } catch (err) {
    if (err instanceof ProjectError) return sendFunctionalError(res, err);
    logTechnical("project.controller.addProjectImage:", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function removeProjectImage(req, res) {
  try {
    const result = await projectService.removeProjectImage(
      req.user.id,
      req.params.id,
      req.params.imageId
    );
    return res.json(result);
  } catch (err) {
    if (err instanceof ProjectError) return sendFunctionalError(res, err);
    logTechnical("project.controller.removeProjectImage:", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function addStageImage(req, res) {
  try {
    const result = await projectService.addStageImage(
      req.user.id,
      req.params.id,
      req.params.stageId,
      req.file
    );
    return res.status(201).json(result);
  } catch (err) {
    if (err instanceof ProjectError) return sendFunctionalError(res, err);
    logTechnical("project.controller.addStageImage:", err);
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function removeStageImage(req, res) {
  try {
    const result = await projectService.removeStageImage(
      req.user.id,
      req.params.id,
      req.params.stageId,
      req.params.imageId
    );
    return res.json(result);
  } catch (err) {
    if (err instanceof ProjectError) return sendFunctionalError(res, err);
    logTechnical("project.controller.removeStageImage:", err);
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
  createStage,
  updateStage,
  reorderStages,
  createNeed,
  updateNeed,
  removeNeed,
  setCover,
  removeCover,
  addProjectImage,
  removeProjectImage,
  addStageImage,
  removeStageImage,
  listPublic,
  getPublic,
};
