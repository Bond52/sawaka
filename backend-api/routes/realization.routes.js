const express = require("express");
const realizationController = require("../controllers/realization.controller");

const router = express.Router();

// Published realizations for anonymous and authenticated visitors.
// Owner drafts stay on GET /api/contributors/me/realizations.
router.get("/", realizationController.listPublishedRealizations);
router.get("/:id", realizationController.getPublishedRealization);

module.exports = router;
