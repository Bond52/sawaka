import type { PublicRealizationsResult } from "./publicRealizations";

export type PublishedRealizationsQuery = {
  q?: string;
  domainId?: string;
};

/**
 * Public catalog URL. Search and category are query params.
 * This never points at the owner endpoint.
 */
export function publishedRealizationsUrl(
  apiBase: string,
  query: PublishedRealizationsQuery = {}
): string {
  const base = `${apiBase.replace(/\/+$/, "")}/api/realizations`;
  const params = new URLSearchParams();
  const q = query.q?.trim() ?? "";
  const domainId = query.domainId?.trim() ?? "";
  if (q) params.set("q", q);
  if (domainId) params.set("domainId", domainId);
  const serialized = params.toString();
  return serialized ? `${base}?${serialized}` : base;
}

/**
 * Loads published realizations across contributors.
 * Credentials and access tokens are omitted so a signed-in owner
 * still receives the public catalog, not their drafts.
 */
export async function loadPublishedRealizations(
  query: PublishedRealizationsQuery = {},
  signal?: AbortSignal
): Promise<PublicRealizationsResult> {
  const { resolveApiBaseUrl } = await import("./apiBase");
  const { parsePublicRealizations } = await import("./publicRealizations");
  const url = publishedRealizationsUrl(resolveApiBaseUrl(), query);
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status };
    const items = parsePublicRealizations(data);
    if (!items) return { ok: false, status: res.status || 500 };
    return { ok: true, items };
  } catch (err) {
    if (signal?.aborted) return { ok: false, status: 0 };
    console.error("[publishedRealizations] loadPublishedRealizations: network error", {
      err,
    });
    return { ok: false, status: 0 };
  }
}
