/**
 * Simple in-memory sliding-window rate limiter.
 * Suitable for single-instance deployments; no external dependency required.
 */

/**
 * @param {object} options
 * @param {number} [options.windowMs=900000] Window length in milliseconds
 * @param {number} [options.max=10] Max requests per key per window
 * @param {(req: import("express").Request) => string} [options.keyGenerator]
 * @param {string} [options.message="Too many requests. Please try again later."]
 * @returns {import("express").RequestHandler}
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const max = options.max ?? 10;
  const message =
    options.message || "Too many requests. Please try again later.";
  const keyGenerator =
    options.keyGenerator ||
    ((req) => {
      const forwarded = req.headers["x-forwarded-for"];
      const forwardedIp =
        typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "";
      return forwardedIp || req.ip || req.socket?.remoteAddress || "unknown";
    });

  /** @type {Map<string, number[]>} */
  const hits = new Map();

  function prune(timestamps, now) {
    return timestamps.filter((ts) => now - ts < windowMs);
  }

  function middleware(req, res, next) {
    const key = keyGenerator(req);
    const now = Date.now();
    const previous = hits.get(key) || [];
    const recent = prune(previous, now);

    if (recent.length >= max) {
      hits.set(key, recent);
      const retryAfterSec = Math.ceil((windowMs - (now - recent[0])) / 1000);
      res.setHeader("Retry-After", String(Math.max(retryAfterSec, 1)));
      return res.status(429).json({ error: message });
    }

    recent.push(now);
    hits.set(key, recent);
    return next();
  }

  /** Test helper: clear all counters. */
  middleware.reset = () => {
    hits.clear();
  };

  return middleware;
}

module.exports = { createRateLimiter };
