const express = require("express");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const { createRateLimiter } = require("../middleware/rateLimit");
const controller = require("../controllers/projectIdeation.controller");

const router = express.Router();

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedIp =
    typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "";
  return forwardedIp || req.ip || req.socket?.remoteAddress || "unknown";
}

const anonMax = Number(process.env.IDEA_GEN_ANON_MAX || 5);
const authMax = Number(process.env.IDEA_GEN_AUTH_MAX || 20);

const anonGenerateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: Number.isFinite(anonMax) && anonMax > 0 ? anonMax : 5,
  keyGenerator: (req) => `idea-gen-anon:${clientIp(req)}`,
  message: "Too many idea generation requests. Please try again later.",
});

const authGenerateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: Number.isFinite(authMax) && authMax > 0 ? authMax : 20,
  keyGenerator: (req) => `idea-gen-auth:${req.user?.id || clientIp(req)}`,
  message: "Too many idea generation requests. Please try again later.",
});

function generateRateLimit(req, res, next) {
  if (req.user?.id) return authGenerateLimit(req, res, next);
  return anonGenerateLimit(req, res, next);
}

router.post("/generate", optionalAuth, generateRateLimit, controller.generate);
router.post("/convert", requireAuth, controller.convertPayload);
router.get("/mine", requireAuth, controller.listMine);
router.post("/mine", requireAuth, controller.save);
router.get("/mine/:id", requireAuth, controller.getMine);
router.patch("/mine/:id", requireAuth, controller.updateMine);
router.delete("/mine/:id", requireAuth, controller.removeMine);
router.post("/mine/:id/convert", requireAuth, controller.convertMine);

module.exports = router;
module.exports.anonGenerateLimit = anonGenerateLimit;
module.exports.authGenerateLimit = authGenerateLimit;
