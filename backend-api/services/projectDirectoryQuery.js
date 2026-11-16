const {
  STAGE_STATUS,
  NEED_KIND,
  NEED_STATUS,
} = require("../models/Project");
const {
  isApprovedProjectCategory,
  normalizeProjectCountry,
} = require("./projectReferenceData");

const ACCENT_MAP = Object.freeze({
  a: "aàáâãäåāăą",
  e: "eèéêëēėę",
  i: "iìíîïīį",
  o: "oòóôõöōőø",
  u: "uùúûüūůű",
  c: "cçćč",
  n: "nñń",
  y: "yýÿ",
  s: "sśšş",
  z: "zźżž",
});

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function foldAccents(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function accentInsensitivePattern(value) {
  const folded = foldAccents(value).trim();
  if (!folded) return null;
  let pattern = "";
  for (const char of folded) {
    const group = ACCENT_MAP[char];
    if (group) {
      pattern += `[${group}${group.toUpperCase()}]`;
    } else {
      pattern += escapeRegex(char);
    }
  }
  return pattern;
}

function textRegex(value) {
  const pattern = accentInsensitivePattern(value);
  if (!pattern) return null;
  return new RegExp(pattern, "i");
}

/**
 * Builds a Mongo filter for published public projects from query params.
 * Allowed: q, category, country, city, stageStatus, needKind, needStatus, page, limit
 */
function parsePublicDirectoryQuery(query) {
  if (query == null) return { filter: {}, page: 1, limit: 24 };
  if (typeof query !== "object" || Array.isArray(query)) {
    const err = new Error("INVALID_QUERY");
    err.code = "INVALID_QUERY";
    err.status = 400;
    throw err;
  }

  const allowed = new Set([
    "q",
    "category",
    "country",
    "city",
    "stageStatus",
    "needKind",
    "needStatus",
    "page",
    "limit",
  ]);
  for (const key of Object.keys(query)) {
    if (!allowed.has(key)) {
      const err = new Error("INVALID_QUERY");
      err.code = "INVALID_QUERY";
      err.status = 400;
      err.fields = [key];
      throw err;
    }
  }

  const filter = {};
  const and = [];

  if (query.q != null && String(query.q).trim()) {
    const regex = textRegex(String(query.q));
    if (regex) {
      and.push({
        $or: [
          { title: regex },
          { summary: regex },
          { description: regex },
          { objective: regex },
          { category: regex },
          { "stages.title": regex },
          { "stages.needs.title": regex },
        ],
      });
    }
  }

  if (query.category != null && String(query.category).trim()) {
    const category = String(query.category).trim();
    if (!isApprovedProjectCategory(category)) {
      const err = new Error("INVALID_CATEGORY");
      err.code = "INVALID_CATEGORY";
      err.status = 400;
      err.fields = ["category"];
      throw err;
    }
    filter.category = category;
  }

  if (query.country != null && String(query.country).trim()) {
    const country = normalizeProjectCountry(String(query.country));
    if (!country) {
      const err = new Error("INVALID_COUNTRY");
      err.code = "INVALID_COUNTRY";
      err.status = 400;
      err.fields = ["country"];
      throw err;
    }
    filter.country = country;
  }

  if (query.city != null && String(query.city).trim()) {
    const regex = textRegex(String(query.city));
    if (regex) filter.city = regex;
  }

  if (query.stageStatus != null && String(query.stageStatus).trim()) {
    const stageStatus = String(query.stageStatus).trim();
    if (!Object.values(STAGE_STATUS).includes(stageStatus)) {
      const err = new Error("INVALID_STAGE_STATUS");
      err.code = "INVALID_STAGE_STATUS";
      err.status = 400;
      err.fields = ["stageStatus"];
      throw err;
    }
    and.push({ "stages.status": stageStatus });
  }

  const needClauses = {};
  if (query.needKind != null && String(query.needKind).trim()) {
    const needKind = String(query.needKind).trim();
    if (!Object.values(NEED_KIND).includes(needKind)) {
      const err = new Error("INVALID_NEED_KIND");
      err.code = "INVALID_NEED_KIND";
      err.status = 400;
      err.fields = ["needKind"];
      throw err;
    }
    needClauses.kind = needKind;
  }
  if (query.needStatus != null && String(query.needStatus).trim()) {
    const needStatus = String(query.needStatus).trim();
    if (!Object.values(NEED_STATUS).includes(needStatus)) {
      const err = new Error("INVALID_NEED_STATUS");
      err.code = "INVALID_NEED_STATUS";
      err.status = 400;
      err.fields = ["needStatus"];
      throw err;
    }
    needClauses.status = needStatus;
  }
  if (Object.keys(needClauses).length > 0) {
    and.push({
      stages: {
        $elemMatch: {
          needs: { $elemMatch: needClauses },
        },
      },
    });
  }

  if (and.length > 0) filter.$and = and;

  let page = 1;
  let limit = 24;
  if (query.page != null && String(query.page).trim() !== "") {
    page = Number(query.page);
    if (!Number.isInteger(page) || page < 1) {
      const err = new Error("INVALID_QUERY");
      err.code = "INVALID_QUERY";
      err.status = 400;
      err.fields = ["page"];
      throw err;
    }
  }
  if (query.limit != null && String(query.limit).trim() !== "") {
    limit = Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      const err = new Error("INVALID_QUERY");
      err.code = "INVALID_QUERY";
      err.status = 400;
      err.fields = ["limit"];
      throw err;
    }
  }

  return { filter, page, limit };
}

module.exports = {
  parsePublicDirectoryQuery,
  textRegex,
  foldAccents,
  accentInsensitivePattern,
};
