/** Mirrors the contributor profile rules enforced by the API. */

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 80;
export const MAX_SELECTED_SKILLS = 20;
export const MAX_CUSTOM_SKILLS = 5;
export const CUSTOM_SKILL_MAX = 30;
export const BIOGRAPHY_MAX = 2000;
export const LOCATION_MAX = 120;

const MARKUP_PATTERN = /<\/?[a-z][^>]*>/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ContributorFieldErrors = Record<string, string>;

export function normalizeAccountEmail(value: string): string {
  return value.trim().toLowerCase();
}

export type ContributorFormInput = {
  username: string;
  email: string;
  confirmEmail: string;
  password: string;
  displayName: string;
  domainId: string;
  skillIds: string[];
  customSkills: string[];
  country: string;
  region: string;
  city: string;
  biography: string;
};

export function validateContributorForm(
  input: ContributorFormInput,
  options: { includeAccount: boolean }
): ContributorFieldErrors {
  const fields: ContributorFieldErrors = {};

  if (options.includeAccount) {
    if (!input.username.trim()) fields.username = "USERNAME_REQUIRED";
    const email = input.email.trim();
    if (!email) fields.email = "EMAIL_REQUIRED";
    else if (!EMAIL_PATTERN.test(email)) fields.email = "EMAIL_INVALID";
    const confirmEmail = normalizeAccountEmail(input.confirmEmail);
    if (!confirmEmail || normalizeAccountEmail(email) !== confirmEmail) {
      fields.confirmEmail = "EMAIL_MISMATCH";
    }
    if (!input.password) fields.password = "PASSWORD_REQUIRED";
  }

  const displayName = input.displayName.trim();
  if (!displayName) fields.displayName = "DISPLAY_NAME_REQUIRED";
  else if (
    displayName.length < DISPLAY_NAME_MIN ||
    displayName.length > DISPLAY_NAME_MAX
  ) {
    fields.displayName = "DISPLAY_NAME_LENGTH";
  }

  if (!input.domainId.trim()) fields.domainId = "DOMAIN_REQUIRED";

  const customSkills: string[] = [];
  const seen = new Set<string>();
  for (const raw of input.customSkills) {
    const label = raw.trim();
    if (!label) {
      fields.customSkills = "CUSTOM_SKILL_INVALID";
      break;
    }
    if (label.length > CUSTOM_SKILL_MAX) {
      fields.customSkills = "CUSTOM_SKILL_LENGTH";
      break;
    }
    const key = label.toLocaleLowerCase();
    if (seen.has(key)) {
      fields.customSkills = "CUSTOM_SKILL_DUPLICATE";
      break;
    }
    seen.add(key);
    customSkills.push(label);
  }
  if (!fields.customSkills && customSkills.length > MAX_CUSTOM_SKILLS) {
    fields.customSkills = "CUSTOM_SKILL_LIMIT";
  }

  if (!fields.customSkills) {
    const total = input.skillIds.length + customSkills.length;
    if (total < 1) fields.skillIds = "SKILL_REQUIRED";
    else if (total > MAX_SELECTED_SKILLS) fields.skillIds = "SKILL_LIMIT";
  }

  const country = input.country.trim();
  if (!country) fields.country = "COUNTRY_REQUIRED";
  else if (country.length > LOCATION_MAX) fields.country = "COUNTRY_LENGTH";

  if (input.region.trim().length > LOCATION_MAX) {
    fields.region = "REGION_LENGTH";
  }
  if (input.city.trim().length > LOCATION_MAX) {
    fields.city = "CITY_LENGTH";
  }

  const biography = input.biography.trim();
  if (MARKUP_PATTERN.test(biography)) fields.biography = "BIOGRAPHY_MARKUP";
  else if (biography.length > BIOGRAPHY_MAX) {
    fields.biography = "BIOGRAPHY_LENGTH";
  }

  return fields;
}

const FOCUS_ORDER = [
  "username",
  "email",
  "confirmEmail",
  "password",
  "displayName",
  "domainId",
  "skillIds",
  "customSkills",
  "country",
  "region",
  "city",
  "biography",
] as const;

export function firstInvalidField(
  fields: ContributorFieldErrors
): string | null {
  return FOCUS_ORDER.find((key) => fields[key]) ?? null;
}

export function fieldElementId(field: string): string {
  switch (field) {
    case "username":
      return "contributor-username";
    case "email":
      return "contributor-email";
    case "confirmEmail":
      return "contributor-confirm-email";
    case "password":
      return "contributor-password";
    case "displayName":
      return "contributor-display-name";
    case "domainId":
      return "contributor-domain";
    case "skillIds":
      return "contributor-skills";
    case "customSkills":
      return "contributor-custom-skill";
    case "country":
      return "contributor-country";
    case "region":
      return "contributor-region";
    case "city":
      return "contributor-city";
    case "biography":
      return "contributor-biography";
    default:
      return "contributor-form-error";
  }
}
