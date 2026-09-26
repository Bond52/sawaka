const express = require("express");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const { createRateLimiter } = require("../middleware/rateLimit");
const contributorController = require("../controllers/contributor.controller");

const router = express.Router();

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedIp =
    typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "";
  return forwardedIp || req.ip || req.socket?.remoteAddress || "unknown";
}

const verificationResendRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `user-verify-resend:${clientIp(req)}:${req.user?.id || "unknown"}`,
  message: "Too many requests. Please try again later.",
});

const verificationConsumeRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `user-verify-consume:${clientIp(req)}`,
  message: "Too many requests. Please try again later.",
});

router.get("/domains", contributorController.listDomains);
router.get("/domains/:domainId/skills", contributorController.listDomainSkills);
router.post(
  "/email-verification",
  verificationConsumeRateLimit,
  contributorController.verifyAccountEmail
);
router.post(
  "/me/verification-email",
  requireAuth,
  verificationResendRateLimit,
  contributorController.resendVerificationEmail
);
router.get("/me", requireAuth, contributorController.getOwnContributor);
router.post("/", optionalAuth, contributorController.createContributor);
router.get("/:id", contributorController.getPublicContributor);

module.exports = router;
module.exports.verificationResendRateLimit = verificationResendRateLimit;
module.exports.verificationConsumeRateLimit = verificationConsumeRateLimit;
