const express = require("express");
const router = express.Router();
const supplierController = require("../controllers/supplier.controller");

router.post("/", supplierController.createSupplier);

router.get("/magic-link/:token", supplierController.activateSupplier);

module.exports = router;
