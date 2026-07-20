/**
 * Normalization helpers for public supplier contact actions.
 * Never accept or emit accountEmail — only public fields.
 */

const EMAIL_RE = /.+@.+\..+/;

export type NormalizedEmail = {
  display: string;
  href: string;
};

export type NormalizedPhone = {
  display: string;
  href: string;
};

export type NormalizedWebsite = {
  display: string;
  href: string;
};

export type NormalizedSupplierContact = {
  email: NormalizedEmail | null;
  phone: NormalizedPhone | null;
  website: NormalizedWebsite | null;
};

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizePublicEmail(value: unknown): NormalizedEmail | null {
  const display = asTrimmedString(value);
  if (!display || !EMAIL_RE.test(display)) return null;
  return {
    display,
    href: `mailto:${display}`,
  };
}

export function normalizePublicPhone(value: unknown): NormalizedPhone | null {
  const display = asTrimmedString(value);
  if (!display || display.length < 6) return null;

  const telDigits = display.replace(/[^\d+]/g, "");
  if (telDigits.replace(/\D/g, "").length < 6) return null;

  return {
    display,
    href: `tel:${telDigits}`,
  };
}

export function normalizePublicWebsite(
  value: unknown
): NormalizedWebsite | null {
  const raw = asTrimmedString(value);
  if (!raw) return null;

  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProto);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return {
      display: raw.replace(/^https?:\/\//i, ""),
      href: url.toString(),
    };
  } catch {
    return null;
  }
}

/**
 * Builds safe contact actions from public supplier fields only.
 * Intentionally ignores any accountEmail-like private field.
 */
export function normalizeSupplierContact(input: {
  publicEmail?: unknown;
  phone?: unknown;
  website?: unknown;
  /** @deprecated private — accepted only to assert it is never used */
  accountEmail?: unknown;
}): NormalizedSupplierContact {
  void input.accountEmail;
  return {
    email: normalizePublicEmail(input.publicEmail),
    phone: normalizePublicPhone(input.phone),
    website: normalizePublicWebsite(input.website),
  };
}

export function hasSupplierContactActions(
  contact: NormalizedSupplierContact
): boolean {
  return Boolean(contact.email || contact.phone || contact.website);
}
