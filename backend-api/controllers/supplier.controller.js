const jwt = require("jsonwebtoken");
const SupplierService = require("../services/SupplierService");

async function createSupplier(req, res) {
  try {
    const supplier = await SupplierService.createSupplier(req.body);
    return res.status(201).json(supplier);
  } catch (err) {
    const msg = err.message || "Erreur serveur";

    if (err && err.code === 11000) {
      return res.status(409).json({ error: "Conflit : ressource déjà existante" });
    }

    const isBadRequest =
      /required|Invalid supplier|Invalid email|validation|at least 6 characters/i.test(
        msg
      ) || err.name === "ValidationError";

    if (isBadRequest) {
      return res.status(400).json({ error: msg });
    }

    console.error("supplier.controller.createSupplier:", err);
    return res.status(500).json({ error: "Erreur serveur", details: msg });
  }
}

async function activateSupplier(req, res) {
  try {
    const { token } = req.params;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Token required" });
    }

    const supplier = await SupplierService.activateSupplier(token);

    const jwtToken = jwt.sign(
      { supplierId: supplier._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      token: jwtToken,
      supplier,
    });
  } catch (err) {
    const msg = err.message || "Erreur serveur";

    const isTokenClientError =
      /Token required|Invalid magic link|already used|expired|Token cannot be consumed/i.test(
        msg
      );
    if (isTokenClientError) {
      return res.status(400).json({ error: msg });
    }

    if (/Supplier could not be activated|no longer invited/i.test(msg)) {
      return res.status(409).json({ error: msg });
    }

    console.error("supplier.controller.activateSupplier:", err);
    return res.status(500).json({ error: "Erreur serveur", details: msg });
  }
}

module.exports = {
  createSupplier,
  activateSupplier,
};
