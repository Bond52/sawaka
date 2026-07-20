const express = require("express");
const router = express.Router();
const supplierController = require("../controllers/supplier.controller");

router.get("/", supplierController.getPublicDirectory);

router.post("/", supplierController.createSupplier);

router.get("/magic-link/:token", supplierController.activateSupplier);

router.get("/:id", supplierController.getPublicProfile);

module.exports = router;
