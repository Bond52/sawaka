/**
 * Shared optional-field helpers for public supplier UI.
 * Never invent values and never fall back to private fields.
 */

export function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Returns a trimmed string, or undefined when missing/blank. */
export function optionalText(value: unknown): string | undefined {
  if (!hasText(value)) return undefined;
  return value.trim();
}

/** Filters to non-empty trimmed strings; empty/invalid arrays become []. */
export function optionalStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export type SupplierLocationInput = {
  city?: unknown;
  region?: unknown;
  country?: unknown;
  address?: unknown;
  postalCode?: unknown;
};

/**
 * Builds location display lines without empty segments or dangling separators.
 * Order: "city, country" (when either exists), then region, address, postalCode.
 */
export function formatSupplierLocationLines(
  input: SupplierLocationInput
): string[] {
  const city = optionalText(input.city);
  const region = optionalText(input.region);
  const country = optionalText(input.country);
  const address = optionalText(input.address);
  const postalCode = optionalText(input.postalCode);

  const lines: string[] = [];
  const cityCountry = [city, country].filter(Boolean).join(", ");
  if (cityCountry) lines.push(cityCountry);
  if (region) lines.push(region);
  if (address) lines.push(address);
  if (postalCode) lines.push(postalCode);
  return lines;
}

/** Single-line "city, country" for cards; omits blank parts and dangling commas. */
export function formatSupplierCityCountry(
  city: unknown,
  country: unknown
): string | undefined {
  const parts = [optionalText(city), optionalText(country)].filter(
    (part): part is string => Boolean(part)
  );
  if (parts.length === 0) return undefined;
  return parts.join(", ");
}

/** Max category badges shown on Supplier Directory cards. */
export const SUPPLIER_CARD_MAX_VISIBLE_CATEGORIES = 3;

/**
 * Limits category badges for compact card layout without altering stored data.
 * Returns the first `maxVisible` categories and how many remain hidden.
 */
export function splitVisibleCategories(
  categories: readonly string[],
  maxVisible: number = SUPPLIER_CARD_MAX_VISIBLE_CATEGORIES
): { visible: string[]; hiddenCount: number } {
  const limit = Number.isFinite(maxVisible) && maxVisible > 0 ? maxVisible : 0;
  if (categories.length <= limit) {
    return { visible: [...categories], hiddenCount: 0 };
  }
  return {
    visible: categories.slice(0, limit),
    hiddenCount: categories.length - limit,
  };
}
