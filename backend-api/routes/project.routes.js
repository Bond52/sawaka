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

router.get("/", projectController.listPublic);
router.get("/:id", projectController.getPublic);

module.exports = router;
