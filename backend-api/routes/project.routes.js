const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { createRateLimiter } = require("../middleware/rateLimit");
const projectController = require("../controllers/project.controller");

const router = express.Router();

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedIp =
    typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "";
  return forwardedIp || req.ip || req.socket?.remoteAddress || "unknown";
}

const projectWriteRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  keyGenerator: (req) => `project-write:${clientIp(req)}:${req.user?.id || "unknown"}`,
  message: "Too many requests. Please try again later.",
});

router.get("/mine", requireAuth, projectController.listOwned);
router.post("/", requireAuth, projectWriteRateLimit, projectController.createDraft);
router.get("/mine/:id", requireAuth, projectController.getOwned);
router.patch("/mine/:id", requireAuth, projectWriteRateLimit, projectController.updateOwned);
router.post("/mine/:id/publish", requireAuth, projectWriteRateLimit, projectController.publishOwned);
router.post("/mine/:id/stages", requireAuth, projectWriteRateLimit, projectController.createStage);
router.patch("/mine/:id/stages/:stageId", requireAuth, projectWriteRateLimit, projectController.updateStage);
router.put("/mine/:id/stages/order", requireAuth, projectWriteRateLimit, projectController.reorderStages);
router.post("/mine/:id/stages/:stageId/needs", requireAuth, projectWriteRateLimit, projectController.createNeed);
router.patch(
  "/mine/:id/stages/:stageId/needs/:needId",
  requireAuth,
  projectWriteRateLimit,
  projectController.updateNeed
);
router.delete(
  "/mine/:id/stages/:stageId/needs/:needId",
  requireAuth,
  projectWriteRateLimit,
  projectController.removeNeed
);

router.get("/", projectController.listPublic);
router.get("/:id", projectController.getPublic);

module.exports = router;
