/**
 * Project category and country reference data.
 *
 * Categories reuse contributor Domains from the approved taxonomy
 * (contributorTaxonomy.json). Supplier categories and Skills are intentionally
 * not used: suppliers describe products for sale; skills are fine-grained tags
 * under domains. Project category maps to Domain slugs.
 *
 * Countries reuse the register-supported set (Cameroon, Canada) and add
 * Republic of the Congo with unambiguous labels/codes.
 */

const taxonomy = require("../data/contributorTaxonomy.json");

const PROJECT_CATEGORY_OPTIONS = Object.freeze(
  (taxonomy.domains || [])
    .filter((domain) => domain && domain.isActive !== false && typeof domain.slug === "string")
    .map((domain) =>
      Object.freeze({
        value: domain.slug,
        nameEN: domain.nameEN,
        nameFR: domain.nameFR,
      })
    )
);

const PROJECT_CATEGORY_VALUES = Object.freeze(
  PROJECT_CATEGORY_OPTIONS.map((option) => option.value)
);

const PROJECT_CATEGORY_SET = new Set(PROJECT_CATEGORY_VALUES);

/** ISO 3166-1 alpha-2 codes with bilingual labels. */
const PROJECT_COUNTRY_OPTIONS = Object.freeze([
  Object.freeze({
    value: "CM",
    nameEN: "Cameroon",
    nameFR: "Cameroun",
  }),
  Object.freeze({
    value: "CG",
    nameEN: "Republic of the Congo",
    nameFR: "République du Congo",
  }),
  Object.freeze({
    value: "CA",
    nameEN: "Canada",
    nameFR: "Canada",
  }),
]);

const PROJECT_COUNTRY_VALUES = Object.freeze(
  PROJECT_COUNTRY_OPTIONS.map((option) => option.value)
);

const PROJECT_COUNTRY_SET = new Set(PROJECT_COUNTRY_VALUES);

const COUNTRY_ALIASES = Object.freeze({
  cm: "CM",
  cameroon: "CM",
  cameroun: "CM",
  cg: "CG",
  "republic of the congo": "CG",
  "republique du congo": "CG",
  "république du congo": "CG",
  "congo-brazzaville": "CG",
  "congo brazzaville": "CG",
  ca: "CA",
  canada: "CA",
});

function isApprovedProjectCategory(value) {
  return typeof value === "string" && PROJECT_CATEGORY_SET.has(value);
}

function normalizeProjectCountry(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (PROJECT_COUNTRY_SET.has(trimmed)) return trimmed;
  const key = trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const aliased = COUNTRY_ALIASES[trimmed.toLowerCase()] || COUNTRY_ALIASES[key];
  return aliased || null;
}

function isApprovedProjectCountry(value) {
  return normalizeProjectCountry(value) !== null;
}

function categoryLabel(value, locale) {
  const option = PROJECT_CATEGORY_OPTIONS.find((entry) => entry.value === value);
  if (!option) return value || "";
  return locale === "fr" ? option.nameFR : option.nameEN;
}

function countryLabel(value, locale) {
  const code = normalizeProjectCountry(value) || value;
  const option = PROJECT_COUNTRY_OPTIONS.find((entry) => entry.value === code);
  if (!option) return value || "";
  return locale === "fr" ? option.nameFR : option.nameEN;
}

module.exports = {
  PROJECT_CATEGORY_OPTIONS,
  PROJECT_CATEGORY_VALUES,
  PROJECT_COUNTRY_OPTIONS,
  PROJECT_COUNTRY_VALUES,
  isApprovedProjectCategory,
  isApprovedProjectCountry,
  normalizeProjectCountry,
  categoryLabel,
  countryLabel,
};
