export type RealizationStatus = "draft" | "published";

export type PortfolioRealization = {
  id: string;
  sequence: number;
  status: RealizationStatus;
  title: string;
  description: string;
  domainId: string | null;
  completedOn: string | null;
  mainMaterial: string;
  imageCount: number;
  imageUrl: string | null;
};

export type OwnerMutationResult =
  | { ok: true; item: PortfolioRealization }
  | { ok: true; deleted: true }
  | { ok: false; status: number; code: string };

export type OwnerPortfolioResult =
  | { ok: true; items: PortfolioRealization[] }
  | { ok: false; status: number };

export type PortfolioQuery = {
  query: string;
  status: "" | RealizationStatus;
  domainId: string;
};

const STATUSES = new Set<RealizationStatus>(["draft", "published"]);
const COMPLETED_ON = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

/**
 * Reads the owner list returned by GET /api/contributors/me/realizations.
 * Returns null when the payload does not match that contract.
 * Product and Article payloads are rejected.
 */
export function parseOwnedRealizations(data: unknown): PortfolioRealization[] | null {
  if (!isRecord(data) || !Array.isArray(data.realizations)) return null;
  const items: PortfolioRealization[] = [];
  for (const row of data.realizations) {
    if (!isRecord(row)) return null;
    const id = row.id;
    const sequence = row.sequence;
    const description = row.description;
    const status = row.status;
    if (typeof id !== "string" || id.trim() === "") return null;
    if (typeof sequence !== "number" || !Number.isFinite(sequence)) return null;
    if (typeof description !== "string") return null;
    let title = "";
    if (row.title === undefined || row.title === null) title = "";
    else if (typeof row.title === "string") title = row.title;
    else return null;
    let mainMaterial = "";
    if (row.mainMaterial === undefined || row.mainMaterial === null) mainMaterial = "";
    else if (typeof row.mainMaterial === "string") mainMaterial = row.mainMaterial;
    else return null;
    let domainId: string | null;
    if (typeof row.domainId === "string") domainId = row.domainId;
    else if (row.domainId === null) domainId = null;
    else return null;
    let completedOn: string | null;
    if (row.completedOn === null) completedOn = null;
    else if (typeof row.completedOn === "string" && COMPLETED_ON.test(row.completedOn)) {
      completedOn = row.completedOn;
    } else return null;
    if (typeof status !== "string" || !STATUSES.has(status as RealizationStatus)) return null;
    if (!Array.isArray(row.images)) return null;
    const urls: string[] = [];
    for (const image of row.images) {
      if (!isRecord(image) || typeof image.url !== "string" || image.url.trim() === "") return null;
      urls.push(image.url);
    }
    items.push({
      id,
      sequence,
      status: status as RealizationStatus,
      title,
      description,
      mainMaterial,
      domainId,
      completedOn,
      imageCount: urls.length,
      imageUrl: urls[0] ?? null,
    });
  }
  return items;
}

/**
 * Loads the signed-in contributor's drafts and published realizations.
 * Ownership comes from the session token. The client never sends an owner id.
 */
export async function loadOwnerPortfolio(): Promise<OwnerPortfolioResult> {
  const { readStoredUser } = await import("./authUser");
  const { resolveApiBaseUrl } = await import("./apiBase");
  const user = readStoredUser();
  if (!user) return { ok: false, status: 401 };
  try {
    const res = await fetch(`${resolveApiBaseUrl()}/api/contributors/me/realizations`, {
      method: "GET",
      credentials: "include",
      headers: { Authorization: `Bearer ${user.token}` },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status };
    const items = parseOwnedRealizations(data);
    if (!items) return { ok: false, status: res.status || 500 };
    return { ok: true, items };
  } catch (err) {
    console.error("[portfolioRealizations] loadOwnerPortfolio: network error", { err });
    return { ok: false, status: 0 };
  }
}

/** Counts owner realizations whose persisted status is published. */
export function countPublishedRealizations(
  items: Array<{ status?: string | null }>
): number {
  return items.reduce(
    (count, item) => count + (item.status === "published" ? 1 : 0),
    0
  );
}

export function filterPortfolioRealizations(
  items: PortfolioRealization[],
  criteria: PortfolioQuery,
  categoryLabel: (item: PortfolioRealization) => string
): PortfolioRealization[] {
  const query = criteria.query.trim().toLocaleLowerCase();
  return items.filter((item) => {
    if (criteria.status && item.status !== criteria.status) return false;
    if (criteria.domainId && item.domainId !== criteria.domainId) return false;
    if (!query) return true;
    return `${item.title || ""} ${item.description} ${categoryLabel(item)}`.toLocaleLowerCase().includes(query);
  });
}

function readErrorCode(data: unknown): string {
  if (!isRecord(data) || !isRecord(data.error) || typeof data.error.code !== "string") {
    return "SERVER_ERROR";
  }
  return data.error.code;
}

async function mutateOwnedRealization(
  id: string,
  method: "POST" | "DELETE",
  suffix: string
): Promise<OwnerMutationResult> {
  const { readStoredUser } = await import("./authUser");
  const { resolveApiBaseUrl } = await import("./apiBase");
  const user = readStoredUser();
  if (!user) return { ok: false, status: 401, code: "UNAUTHORIZED" };
  try {
    const res = await fetch(
      `${resolveApiBaseUrl()}/api/contributors/me/realizations/${encodeURIComponent(id)}${suffix}`,
      {
        method,
        credentials: "include",
        headers: { Authorization: `Bearer ${user.token}` },
      }
    );
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status, code: readErrorCode(data) };
    if (method === "DELETE") return { ok: true, deleted: true };
    const items = parseOwnedRealizations(
      isRecord(data) ? { realizations: [data.realization] } : null
    );
    if (!items || items.length !== 1) return { ok: false, status: 500, code: "INVALID_RESPONSE" };
    return { ok: true, item: items[0] };
  } catch (err) {
    console.error("[portfolioRealizations] mutateOwnedRealization: network error", { err });
    return { ok: false, status: 0, code: "NETWORK" };
  }
}

/** Publishes one owned draft. The server checks readiness and ownership. */
export function publishOwnedRealization(id: string): Promise<OwnerMutationResult> {
  return mutateOwnedRealization(id, "POST", "/publish");
}

/** Returns one owned published realization to draft without deleting its photos. */
export function moveOwnedRealizationToDraft(id: string): Promise<OwnerMutationResult> {
  return mutateOwnedRealization(id, "POST", "/draft");
}

/** Permanently deletes one owned realization after the caller has confirmed. */
export function deleteOwnedRealization(id: string): Promise<OwnerMutationResult> {
  return mutateOwnedRealization(id, "DELETE", "");
}
