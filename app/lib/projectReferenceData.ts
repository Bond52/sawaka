/**
 * Project category and country reference data.
 *
 * Categories reuse contributor Domains from the approved taxonomy JSON.
 * Supplier categories and Skills are intentionally not merged: they represent
 * different concepts (product supply vs fine-grained contributor tags).
 *
 * Countries reuse Cameroon and Canada (register) and include Republic of the
 * Congo with unambiguous ISO codes.
 */

import taxonomy from "@/backend-api/data/contributorTaxonomy.json";

type TaxonomyDomain = {
  slug: string;
  nameEN: string;
  nameFR: string;
  isActive?: boolean;
};

export type ProjectCategoryOption = {
  value: string;
  nameEN: string;
  nameFR: string;
};

export type ProjectCountryOption = {
  value: string;
  nameEN: string;
  nameFR: string;
};

const domains = (taxonomy as { domains: TaxonomyDomain[] }).domains || [];

export const PROJECT_CATEGORY_OPTIONS: ReadonlyArray<ProjectCategoryOption> = domains
  .filter((domain) => domain && domain.isActive !== false && typeof domain.slug === "string")
  .map((domain) => ({
    value: domain.slug,
    nameEN: domain.nameEN,
    nameFR: domain.nameFR,
  }));

const PROJECT_CATEGORY_SET = new Set(PROJECT_CATEGORY_OPTIONS.map((option) => option.value));

export const PROJECT_COUNTRY_OPTIONS: ReadonlyArray<ProjectCountryOption> = [
  { value: "CM", nameEN: "Cameroon", nameFR: "Cameroun" },
  { value: "CG", nameEN: "Republic of the Congo", nameFR: "République du Congo" },
  { value: "CA", nameEN: "Canada", nameFR: "Canada" },
];

const PROJECT_COUNTRY_SET = new Set(PROJECT_COUNTRY_OPTIONS.map((option) => option.value));

const COUNTRY_ALIASES: Record<string, string> = {
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
};

export function isApprovedProjectCategory(value: string): boolean {
  return PROJECT_CATEGORY_SET.has(value);
}

export function normalizeProjectCountry(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (PROJECT_COUNTRY_SET.has(trimmed)) return trimmed;
  const key = trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return COUNTRY_ALIASES[trimmed.toLowerCase()] || COUNTRY_ALIASES[key] || null;
}

export function isApprovedProjectCountry(value: string): boolean {
  return normalizeProjectCountry(value) !== null;
}

export function projectCategoryLabel(value: string, locale: string): string {
  const option = PROJECT_CATEGORY_OPTIONS.find((entry) => entry.value === value);
  if (!option) return value || "";
  return locale === "fr" ? option.nameFR : option.nameEN;
}

export function projectCountryLabel(value: string, locale: string): string {
  const code = normalizeProjectCountry(value) || value;
  const option = PROJECT_COUNTRY_OPTIONS.find((entry) => entry.value === code);
  if (!option) return value || "";
  return locale === "fr" ? option.nameFR : option.nameEN;
}

/** Select value for an existing project country (legacy free-text → code). */
export function countrySelectValue(stored: string): string {
  return normalizeProjectCountry(stored) || stored;
}
