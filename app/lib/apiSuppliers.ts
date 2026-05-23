import { resolveApiBaseUrl } from "./apiBase";

export const SUPPLIER_JWT_KEY = "supplierJwt";

export type ActivateSupplierResult =
  | { ok: true; token: string }
  | { ok: false; status: number; detail: string };

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
