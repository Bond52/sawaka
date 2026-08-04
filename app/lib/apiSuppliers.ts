import { resolveApiBaseUrl } from "./apiBase";

export const SUPPLIER_JWT_KEY = "supplierJwt";
export const SUPPLIER_MANAGEMENT_JWT_KEY = "supplierManagementJwt";

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

export type RequestManagementLinkResult =
  | { ok: true }
  | { ok: false; status: number; detail: string };

/**
 * Requests a supplier-management magic link (POST /api/suppliers/:id/management-link).
 * Success always looks the same whether or not the email matched.
 */
export async function requestSupplierManagementLink(
  supplierId: string,
  email: string
): Promise<RequestManagementLinkResult> {
  const apiBase = resolveApiBaseUrl();
  const url = `${apiBase}/api/suppliers/${encodeURIComponent(supplierId)}/management-link`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch (err) {
    console.error("[apiSuppliers] requestSupplierManagementLink: network error", {
      err,
      url,
    });
    return { ok: false, status: 0, detail: "network_error" };
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data?.error === "string") detail = data.error;
    } catch {
      /* ignore */
    }
    console.error("[apiSuppliers] requestSupplierManagementLink: API error", {
      status: res.status,
      detail,
      url,
    });
    return { ok: false, status: res.status, detail };
  }

  return { ok: true };
}

export type EstablishManagementSessionResult =
  | { ok: true; token: string; supplierId: string; expiresAt?: string }
  | { ok: false; status: number; detail: string };

/**
 * Exchanges a management magic-link token for a session JWT
 * (POST /api/suppliers/management-session).
 */
export async function establishSupplierManagementSession(
  token: string
): Promise<EstablishManagementSessionResult> {
  const apiBase = resolveApiBaseUrl();
  const url = `${apiBase}/api/suppliers/management-session`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch (err) {
    console.error(
      "[apiSuppliers] establishSupplierManagementSession: network error",
      { err, url }
    );
    return { ok: false, status: 0, detail: "network_error" };
  }

  let data: {
    token?: unknown;
    supplierId?: unknown;
    expiresAt?: unknown;
    error?: unknown;
  } = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON */
  }

  if (!res.ok) {
    const detail =
      (typeof data.error === "string" && data.error) || `HTTP ${res.status}`;
    console.error(
      "[apiSuppliers] establishSupplierManagementSession: API error",
      { status: res.status, detail, url }
    );
    return { ok: false, status: res.status, detail };
  }

  const sessionToken =
    typeof data.token === "string" && data.token.length > 0 ? data.token : null;
  const supplierId =
    typeof data.supplierId === "string" && data.supplierId.length > 0
      ? data.supplierId
      : null;

  if (!sessionToken || !supplierId) {
    return { ok: false, status: res.status, detail: "missing_session" };
  }

  return {
    ok: true,
    token: sessionToken,
    supplierId,
    expiresAt:
      typeof data.expiresAt === "string" ? data.expiresAt : undefined,
  };
}

/** Supplier fields the owner may edit from the management area. */
export type EditableSupplier = {
  id: string;
  name: string;
  categories: string[];
  country: string;
  region?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  accountEmail: string;
  publicEmail?: string;
  phone: string;
  website?: string;
};

export type EditableSupplierPayload = {
  name?: string;
  categories?: string[];
  country?: string;
  region?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  accountEmail?: string;
  publicEmail?: string;
  phone?: string;
  website?: string;
};

export type GetEditableSupplierResult =
  | { ok: true; supplier: EditableSupplier }
  | { ok: false; status: number; detail: string };

export type UpdateEditableSupplierResult =
  | { ok: true; supplier: EditableSupplier }
  | {
      ok: false;
      status: number;
      detail: string;
      fieldErrors?: Record<string, string>;
    };

/** Maps a raw API object to the editable supplier DTO used by the manage form. */
export function mapEditableSupplier(raw: unknown): EditableSupplier | null {
  const source =
    isRecord(raw) && isRecord(raw.supplier) ? raw.supplier : raw;
  if (!isRecord(source)) return null;

  const id = asTrimmedString(source.id) || asTrimmedString(source._id);
  const name = asTrimmedString(source.name);
  if (!id || !name) return null;

  const supplier: EditableSupplier = {
    id,
    name,
    categories: asStringArray(source.categories),
    country: asTrimmedString(source.country) || "",
    accountEmail: asTrimmedString(source.accountEmail) || "",
    phone: asTrimmedString(source.phone) || "",
  };

  const region = asTrimmedString(source.region);
  if (region) supplier.region = region;

  const city = asTrimmedString(source.city);
  if (city) supplier.city = city;

  const address = asTrimmedString(source.address);
  if (address) supplier.address = address;

  const postalCode = asTrimmedString(source.postalCode);
  if (postalCode) supplier.postalCode = postalCode;

  const publicEmail = asTrimmedString(source.publicEmail);
  if (publicEmail) supplier.publicEmail = publicEmail;

  const website = asTrimmedString(source.website);
  if (website) supplier.website = website;

  return supplier;
}

function readErrorDetail(data: unknown, status: number): string {
  if (isRecord(data)) {
    const error = asTrimmedString(data.error);
    if (error) return error;
    const message = asTrimmedString(data.message);
    if (message) return message;
  }
  return `HTTP ${status}`;
}

/** Extracts a `{ field: message }` map from a backend validation payload. */
function readFieldErrors(data: unknown): Record<string, string> | undefined {
  if (!isRecord(data) || !isRecord(data.errors)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data.errors)) {
    if (typeof value === "string" && value.trim()) {
      out[key] = value.trim();
      continue;
    }
    if (Array.isArray(value)) {
      const first = value.find(
        (item) => typeof item === "string" && item.trim()
      );
      if (typeof first === "string") out[key] = first.trim();
      continue;
    }
    if (isRecord(value)) {
      const message = asTrimmedString(value.message);
      if (message) out[key] = message;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Fetches the editable supplier bound to a management session
 * (GET /api/suppliers/management).
 */
export async function getEditableSupplier(
  token: string
): Promise<GetEditableSupplierResult> {
  const sessionToken = token?.trim();
  if (!sessionToken) {
    return { ok: false, status: 401, detail: "missing_token" };
  }

  const apiBase = resolveApiBaseUrl();
  const url = `${apiBase}/api/suppliers/management`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
  } catch (err) {
    console.error("[apiSuppliers] getEditableSupplier: network error", {
      err,
      url,
    });
    return { ok: false, status: 0, detail: "network_error" };
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    const detail = readErrorDetail(data, res.status);
    console.error("[apiSuppliers] getEditableSupplier: API error", {
      status: res.status,
      detail,
      url,
    });
    return { ok: false, status: res.status, detail };
  }

  const supplier = mapEditableSupplier(data);
  if (!supplier) {
    console.error("[apiSuppliers] getEditableSupplier: unexpected payload", {
      url,
    });
    return { ok: false, status: res.status, detail: "invalid_payload" };
  }

  return { ok: true, supplier };
}

/**
 * Updates the editable supplier bound to a management session
 * (PATCH /api/suppliers/management).
 */
export async function updateEditableSupplier(
  token: string,
  payload: EditableSupplierPayload
): Promise<UpdateEditableSupplierResult> {
  const sessionToken = token?.trim();
  if (!sessionToken) {
    return { ok: false, status: 401, detail: "missing_token" };
  }

  const apiBase = resolveApiBaseUrl();
  const url = `${apiBase}/api/suppliers/management`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[apiSuppliers] updateEditableSupplier: network error", {
      err,
      url,
    });
    return { ok: false, status: 0, detail: "network_error" };
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    const detail = readErrorDetail(data, res.status);
    console.error("[apiSuppliers] updateEditableSupplier: API error", {
      status: res.status,
      detail,
      url,
    });
    return {
      ok: false,
      status: res.status,
      detail,
      fieldErrors: readFieldErrors(data),
    };
  }

  const supplier = mapEditableSupplier(data);
  if (!supplier) {
    console.error("[apiSuppliers] updateEditableSupplier: unexpected payload", {
      url,
    });
    return { ok: false, status: res.status, detail: "invalid_payload" };
  }

  return { ok: true, supplier };
}

export function getSupplierManagementToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(SUPPLIER_MANAGEMENT_JWT_KEY);
  } catch {
    return null;
  }
}

export function setSupplierManagementToken(token: string): void {
  localStorage.setItem(SUPPLIER_MANAGEMENT_JWT_KEY, token);
}

export function clearSupplierManagementToken(): void {
  try {
    localStorage.removeItem(SUPPLIER_MANAGEMENT_JWT_KEY);
  } catch {
    /* ignore */
  }
}
