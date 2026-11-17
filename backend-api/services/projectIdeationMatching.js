const ContributorProfile = require("../models/ContributorProfile");
const { PROFILE_STATUS } = require("../models/ContributorProfile");
const Domain = require("../models/Domain");
const Supplier = require("../models/Supplier");

const CANDIDATE_LIMIT = 24;

function publicContributorFilter() {
  return { status: PROFILE_STATUS.ACTIVE, isVisible: true };
}

function publicSupplierFilter() {
  return { status: "Active", isVisible: true };
}

function locationLabel(country, city) {
  return [city, country].filter(Boolean).join(", ");
}

/**
 * Loads a bounded set of publicly eligible contributors and suppliers for AI context.
 * Deterministic filters only — no invented records.
 */
async function loadEcosystemCandidates(criteria = {}) {
  const country = typeof criteria.country === "string" ? criteria.country.trim() : "";
  const city = typeof criteria.city === "string" ? criteria.city.trim() : "";
  const category = typeof criteria.category === "string" ? criteria.category.trim() : "";

  const contributorQuery = { ...publicContributorFilter() };
  if (country) contributorQuery.country = new RegExp(`^${escapeRegex(country)}$`, "i");
  if (city) contributorQuery.city = new RegExp(escapeRegex(city), "i");

  let domainId = null;
  if (category) {
    const domain = await Domain.findOne({ slug: category, isActive: { $ne: false } }).lean();
    if (domain) {
      domainId = domain._id;
      contributorQuery.domainId = domainId;
    }
  }

  const contributorDocs = await ContributorProfile.find(contributorQuery)
    .populate("domainId", "slug nameEN nameFR")
    .sort({ updatedAt: -1 })
    .limit(CANDIDATE_LIMIT)
    .lean();

  const contributors = contributorDocs.map((doc) => {
    const domain = doc.domainId;
    const skills = (doc.skills || [])
      .map((skill) => skill.customLabel || skill.skillId)
      .filter(Boolean)
      .slice(0, 8);
    return {
      id: String(doc._id),
      kind: "contributor",
      label: doc.displayName,
      detail: [domain?.slug || "", skills.join(", ")].filter(Boolean).join(" · "),
      location: locationLabel(doc.country, doc.city),
      href: `/contributors/${doc._id}`,
      domainSlug: domain?.slug || "",
      country: doc.country || "",
      city: doc.city || "",
    };
  });

  const supplierQuery = { ...publicSupplierFilter() };
  if (country) supplierQuery.country = new RegExp(`^${escapeRegex(country)}$`, "i");
  if (city) supplierQuery.city = new RegExp(escapeRegex(city), "i");
  if (category) supplierQuery.categories = category;

  let supplierDocs = await Supplier.find(supplierQuery)
    .sort({ updatedAt: -1 })
    .limit(CANDIDATE_LIMIT)
    .lean();

  // Broaden when category filter returns nothing so AI still has real options.
  if (supplierDocs.length === 0 && category) {
    const broadened = { ...publicSupplierFilter() };
    if (country) broadened.country = supplierQuery.country;
    if (city) broadened.city = supplierQuery.city;
    supplierDocs = await Supplier.find(broadened)
      .sort({ updatedAt: -1 })
      .limit(CANDIDATE_LIMIT)
      .lean();
  }

  const suppliers = supplierDocs.map((doc) => ({
    id: String(doc._id),
    kind: "supplier",
    label: doc.name || "Supplier",
    detail: (doc.categories || []).slice(0, 5).join(", "),
    location: locationLabel(doc.country, doc.city),
    href: `/fournisseurs/${doc._id}`,
    categories: doc.categories || [],
    country: doc.country || "",
    city: doc.city || "",
  }));

  return { contributors, suppliers };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function candidateMaps(candidates) {
  return {
    contributors: new Map((candidates.contributors || []).map((item) => [item.id, item])),
    suppliers: new Map((candidates.suppliers || []).map((item) => [item.id, item])),
  };
}

/**
 * Keeps only IDs that exist in the authorized candidate set.
 */
function resolveVerifiedMatches(rawIds, map) {
  if (!Array.isArray(rawIds)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of rawIds) {
    const id = typeof raw === "string" ? raw : raw?.id;
    if (!id || seen.has(id)) continue;
    const hit = map.get(String(id));
    if (!hit) continue;
    seen.add(id);
    out.push({
      id: hit.id,
      kind: hit.kind,
      label: hit.label,
      detail: hit.detail,
      location: hit.location,
      href: hit.href,
    });
  }
  return out;
}

module.exports = {
  CANDIDATE_LIMIT,
  loadEcosystemCandidates,
  candidateMaps,
  resolveVerifiedMatches,
  publicContributorFilter,
  publicSupplierFilter,
};
