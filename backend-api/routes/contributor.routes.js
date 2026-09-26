const express = require("express");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const contributorController = require("../controllers/contributor.controller");

const router = express.Router();

router.get("/domains", contributorController.listDomains);
router.get("/domains/:domainId/skills", contributorController.listDomainSkills);
router.get("/me", requireAuth, contributorController.getOwnContributor);
router.post("/", optionalAuth, contributorController.createContributor);
router.get("/:id", contributorController.getPublicContributor);

module.exports = router;
