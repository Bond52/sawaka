const jwt = require("jsonwebtoken");

function readRequestToken(req) {
  const bearer = req.headers.authorization;
  const headerToken =
    bearer && bearer.startsWith("Bearer ") ? bearer.split(" ")[1] : null;
  const cookieToken = req.cookies?.token;
  return headerToken || cookieToken || null;
}

function requireAuth(req, res, next) {
  const token = readRequestToken(req);

  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { id, roles }
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

/**
 * Continues anonymous when no token is present.
 * An invalid token is rejected so it cannot be treated as a new account.
 */
function optionalAuth(req, res, next) {
  const token = readRequestToken(req);
  if (!token) return next();
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (e) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED" } });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !req.user.roles.some(r => roles.includes(r))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

module.exports = { requireAuth, optionalAuth, requireRole, readRequestToken };
