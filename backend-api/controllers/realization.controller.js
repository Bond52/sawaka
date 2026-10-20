const realizationService = require("../services/realizationService");
const { RealizationError } = realizationService;

function sendFunctionalError(res, err) {
  const body = { error: { code: err.code } };
  if (err.fields) body.error.fields = err.fields;
  return res.status(err.status || 400).json(body);
}

/** Public catalog. Ignores any caller-supplied status and never reads the owner. */
async function listPublishedRealizations(req, res) {
  try {
    const result = await realizationService.listPublished({
      q: req.query.q,
      domainId: req.query.domainId,
    });
    return res.json(result);
  } catch (err) {
    if (err instanceof RealizationError) return sendFunctionalError(res, err);
    console.error("realization.controller.listPublishedRealizations:", {
      name: err && err.name,
      code: err && err.code,
    });
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function getOwnRealization(req, res) {
  try {
    const result = await realizationService.getOwned(req.user.id, req.params.id);
    return res.json(result);
  } catch (err) {
    if (err instanceof RealizationError) return sendFunctionalError(res, err);
    console.error("realization.controller.getOwnRealization:", {
      name: err && err.name,
      code: err && err.code,
    });
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function updateOwnRealization(req, res) {
  try {
    const result = await realizationService.updateOwned(req.user.id, req.params.id, req.body);
    return res.json(result);
  } catch (err) {
    if (err instanceof RealizationError) return sendFunctionalError(res, err);
    console.error("realization.controller.updateOwnRealization:", {
      name: err && err.name,
      code: err && err.code,
    });
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function publishOwnRealization(req, res) {
  try {
    const result = await realizationService.publishOwned(req.user.id, req.params.id);
    return res.json(result);
  } catch (err) {
    if (err instanceof RealizationError) return sendFunctionalError(res, err);
    console.error("realization.controller.publishOwnRealization:", {
      name: err && err.name,
      code: err && err.code,
    });
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function moveOwnRealizationToDraft(req, res) {
  try {
    const result = await realizationService.moveOwnedToDraft(req.user.id, req.params.id);
    return res.json(result);
  } catch (err) {
    if (err instanceof RealizationError) return sendFunctionalError(res, err);
    console.error("realization.controller.moveOwnRealizationToDraft:", {
      name: err && err.name,
      code: err && err.code,
    });
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

async function deleteOwnRealization(req, res) {
  try {
    const result = await realizationService.deleteOwned(req.user.id, req.params.id);
    return res.json(result);
  } catch (err) {
    if (err instanceof RealizationError) return sendFunctionalError(res, err);
    console.error("realization.controller.deleteOwnRealization:", {
      name: err && err.name,
      code: err && err.code,
    });
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

/** One published realization. Drafts and unknown ids are not found. */
async function getPublishedRealization(req, res) {
  try {
    const result = await realizationService.getPublishedById(req.params.id);
    return res.json(result);
  } catch (err) {
    if (err instanceof RealizationError) return sendFunctionalError(res, err);
    console.error("realization.controller.getPublishedRealization:", {
      name: err && err.name,
      code: err && err.code,
    });
    return res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
}

module.exports = {
  listPublishedRealizations,
  getPublishedRealization,
  getOwnRealization,
  updateOwnRealization,
  publishOwnRealization,
  moveOwnRealizationToDraft,
  deleteOwnRealization,
};
