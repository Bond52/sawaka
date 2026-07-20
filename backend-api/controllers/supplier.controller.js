const jwt = require("jsonwebtoken");
const SupplierService = require("../services/SupplierService");

const SAFE_SERVER_ERROR = { error: "Erreur serveur" };

/**
 * Logs technical retrieval errors for operators without leaking details to clients.
 */
function logSupplierRetrievalError(operation, err, meta = {}) {
  console.error(`supplier.controller.${operation}:`, {
    operation,
    name: err && err.name,
    message: err && err.message,
    code: err && err.code,
    ...meta,
  });
}

function isSupplierNotFoundError(err) {
  return (
    Boolean(err) &&
    (err.code === "SUPPLIER_NOT_FOUND" ||
      err.message === SupplierService.SUPPLIER_NOT_FOUND)
  );
}

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
      const body = { error: msg };
      if (err.errors && typeof err.errors === "object") {
        body.errors = err.errors;
      }
      return res.status(400).json(body);
    }

    logSupplierRetrievalError("createSupplier", err);
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

    logSupplierRetrievalError("activateSupplier", err);
    return res.status(500).json({ error: "Erreur serveur", details: msg });
  }
}

async function getPublicDirectory(req, res) {
  try {
    const filters = SupplierService.parsePublicDirectoryQuery(req.query);
    const suppliers = await SupplierService.getPublicDirectory(filters);
    return res.status(200).json(suppliers);
  } catch (err) {
    const msg = err.message || "Erreur serveur";

    const isBadRequest =
      /must be a string|Invalid category|search is too long/i.test(msg);

    if (isBadRequest) {
      return res.status(400).json({ error: msg });
    }

    logSupplierRetrievalError("getPublicDirectory", err, {
      hasSearch: Boolean(req.query && req.query.search),
      hasCategory: Boolean(req.query && req.query.category),
    });
    return res.status(500).json(SAFE_SERVER_ERROR);
  }
}

async function getPublicProfile(req, res) {
  try {
    const supplier = await SupplierService.getPublicProfile(req.params.id);
    return res.status(200).json(supplier);
  } catch (err) {
    if (isSupplierNotFoundError(err)) {
      return res.status(404).json({ error: SupplierService.SUPPLIER_NOT_FOUND });
    }

    logSupplierRetrievalError("getPublicProfile", err, {
      idPresent: Boolean(req.params && req.params.id),
    });
    return res.status(500).json(SAFE_SERVER_ERROR);
  }
}

module.exports = {
  createSupplier,
  activateSupplier,
  getPublicDirectory,
  getPublicProfile,
};
