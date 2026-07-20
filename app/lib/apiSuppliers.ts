import { resolveApiBaseUrl } from "./apiBase";

export const SUPPLIER_JWT_KEY = "supplierJwt";

export type PublicSupplier = {
  id: string;
  name: string;
  categories: string[];
  country: string;
  city: string;
  phone: string;
  region?: string;
  address?: string;
  postalCode?: string;
  publicEmail?: string;
  website?: string;
  /** Optional materials/resources when present in API payloads. */
  resources?: string[];
};

export type ListPublicSuppliersParams = {
  search?: string;
  category?: string;
};

export type ActivateSupplierResult =
  | { ok: true; token: string }
  | { ok: false; status: number; detail: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Maps a raw API object to a public supplier DTO; drops private fields. */
export function mapPublicSupplier(raw: unknown): PublicSupplier | null {
  if (!isRecord(raw)) return null;

  const id =
    asTrimmedString(raw.id) ||
    (isRecord(raw._id) ? undefined : asTrimmedString(raw._id));
  const name = asTrimmedString(raw.name);
  if (!id || !name) return null;

  const phone = asTrimmedString(raw.phone) || "";
  const country = asTrimmedString(raw.country) || "";
  const city = asTrimmedString(raw.city) || "";
  const categories = asStringArray(raw.categories);
  const resources = asStringArray(raw.resources);

  const supplier: PublicSupplier = {
    id,
    name,
    categories,
    country,
    city,
    phone,
  };

  const region = asTrimmedString(raw.region);
  if (region) supplier.region = region;

  const address = asTrimmedString(raw.address);
  if (address) supplier.address = address;

  const postalCode = asTrimmedString(raw.postalCode);
  if (postalCode) supplier.postalCode = postalCode;

  const publicEmail = asTrimmedString(raw.publicEmail);
  if (publicEmail) supplier.publicEmail = publicEmail;

  const website = asTrimmedString(raw.website);
  if (website) supplier.website = website;

  if (resources.length > 0) supplier.resources = resources;

  return supplier;
}

/**
 * Lists public suppliers from GET /api/suppliers.
 */
export async function listPublicSuppliers(
  params: ListPublicSuppliersParams = {}
): Promise<PublicSupplier[]> {
  const apiBase = resolveApiBaseUrl();
  const qs = new URLSearchParams();

  const search = params.search?.trim();
  if (search) qs.set("search", search);

  const category = params.category?.trim();
  if (category) qs.set("category", category);

  const query = qs.toString();
  const url = `${apiBase}/api/suppliers${query ? `?${query}` : ""}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
  } catch (err) {
    console.error("[apiSuppliers] listPublicSuppliers: network error", {
      err,
      url,
    });
    throw new Error("network_error");
  }

  if (!res.ok) {
    console.error("[apiSuppliers] listPublicSuppliers: API error", {
      status: res.status,
      url,
    });
    throw new Error("api_error");
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch (err) {
    console.error("[apiSuppliers] listPublicSuppliers: invalid JSON", {
      err,
      url,
    });
    throw new Error("api_error");
  }

  if (!Array.isArray(data)) {
    console.error("[apiSuppliers] listPublicSuppliers: unexpected payload", {
      url,
    });
    throw new Error("api_error");
  }

  return data
    .map(mapPublicSupplier)
    .filter((item): item is PublicSupplier => item !== null);
}

/**
 * Fetches a public supplier profile from GET /api/suppliers/:id.
 */
export async function getPublicSupplier(
  id: string
): Promise<PublicSupplier | null> {
  const trimmedId = id?.trim();
  if (!trimmedId) return null;

  const apiBase = resolveApiBaseUrl();
  const url = `${apiBase}/api/suppliers/${encodeURIComponent(trimmedId)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
  } catch (err) {
    console.error("[apiSuppliers] getPublicSupplier: network error", {
      err,
      url,
    });
    throw new Error("network_error");
  }

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    console.error("[apiSuppliers] getPublicSupplier: API error", {
      status: res.status,
      url,
    });
    throw new Error("api_error");
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch (err) {
    console.error("[apiSuppliers] getPublicSupplier: invalid JSON", {
      err,
      url,
    });
    throw new Error("api_error");
  }

  const mapped = mapPublicSupplier(data);
  if (!mapped) {
    throw new Error("api_error");
  }
  return mapped;
}

/**
 * Activates a supplier account via magic-link token (GET /api/suppliers/magic-link/:token).
 */
export async function activateSupplierWithMagicLink(
  token: string
): Promise<ActivateSupplierResult> {
  const apiBase = resolveApiBaseUrl();
  const url = `${apiBase}/api/suppliers/magic-link/${encodeURIComponent(token)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      credentials: "include",
    });
  } catch (err) {
    console.error("[apiSuppliers] activateSupplierWithMagicLink: network error", {
      err,
      url,
    });
    return { ok: false, status: 0, detail: "network_error" };
  }

  let data: { token?: unknown; error?: unknown; message?: unknown } = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    const detail =
      (typeof data.error === "string" && data.error) ||
      (typeof data.message === "string" && data.message) ||
      `HTTP ${res.status}`;
    console.error("[apiSuppliers] activateSupplierWithMagicLink: API error", {
      status: res.status,
      detail,
      url,
    });
    return { ok: false, status: res.status, detail };
  }

  const jwt =
    typeof data.token === "string" && data.token.length > 0 ? data.token : null;

  if (!jwt) {
    console.error(
      "[apiSuppliers] activateSupplierWithMagicLink: missing token in response",
      { status: res.status, url }
    );
    return { ok: false, status: res.status, detail: "missing_jwt" };
  }

  return { ok: true, token: jwt };
}
