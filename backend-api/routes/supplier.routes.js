const express = require("express");
const router = express.Router();
const supplierController = require("../controllers/supplier.controller");
const { createRateLimiter } = require("../middleware/rateLimit");

const managementLinkRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    const forwarded = req.headers["x-forwarded-for"];
    const forwardedIp =
      typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "";
    const ip = forwardedIp || req.ip || req.socket?.remoteAddress || "unknown";
    const supplierId =
      typeof req.params?.id === "string" ? req.params.id : "unknown";
    return `mgmt-link:${ip}:${supplierId}`;
  },
  message: "Too many requests. Please try again later.",
});

router.get("/", supplierController.getPublicDirectory);

router.post("/", supplierController.createSupplier);

router.get("/magic-link/:token", supplierController.activateSupplier);

router.post(
  "/:id/management-link",
  managementLinkRateLimit,
  supplierController.requestManagementAccess
);

router.get("/:id", supplierController.getPublicProfile);

module.exports = router;
module.exports.managementLinkRateLimit = managementLinkRateLimit;
