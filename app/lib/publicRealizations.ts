/**
 * Public realization shown on a contributor profile.
 * One item keeps every photo from that realization. The first URL is only
 * the list preview; it is not a stored cover image.
 */
export type PublicRealization = {
  id: string;
  sequence: number;
  title: string;
  description: string;
  domainId: string | null;
  completedOn: string | null;
  imageUrls: string[];
};

export type PublicRealizationsResult =
  | { ok: true; items: PublicRealization[] }
  | { ok: false; status: number };

const COMPLETED_ON = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function formatCompletedOn(value: string, locale: string): string {
  const match = COMPLETED_ON.exec(value);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "";
  }
  return date.toLocaleDateString(locale === "fr" ? "fr" : "en", {
    month: "short",
    year: "numeric",
  });
}

function readCompletedOn(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !formatCompletedOn(value, "en")) return undefined;
  return value;
}

/**
 * Reads GET /api/contributors/:id/realizations.
 * Draft rows are dropped if they appear. Product payloads are rejected.
 * A null result means the payload is not the public contract.
 */
export function parsePublicRealizations(data: unknown): PublicRealization[] | null {
  if (!isRecord(data) || !Array.isArray(data.realizations)) return null;
  const items: PublicRealization[] = [];
  for (const row of data.realizations) {
    if (!isRecord(row)) return null;
    if (typeof row.status === "string" && row.status !== "published") continue;
    if (typeof row.id !== "string" || row.id.trim() === "") return null;
    if (typeof row.sequence !== "number" || !Number.isFinite(row.sequence)) return null;
    if (typeof row.description !== "string") return null;
    let title = "";
    if (row.title === undefined || row.title === null) title = "";
    else if (typeof row.title === "string") title = row.title;
    else return null;
    let domainId: string | null;
    if (typeof row.domainId === "string" && row.domainId.trim() !== "") domainId = row.domainId;
    else if (row.domainId === null || row.domainId === undefined) domainId = null;
    else return null;
    const completedOn = readCompletedOn(row.completedOn);
    if (completedOn === undefined) return null;
    if (!Array.isArray(row.images)) return null;
    const imageUrls: string[] = [];
    for (const image of row.images) {
      if (!isRecord(image) || typeof image.url !== "string" || image.url.trim() === "") {
        return null;
      }
      imageUrls.push(image.url);
    }
    items.push({
      id: row.id,
      sequence: row.sequence,
      title,
      description: row.description,
      domainId,
      completedOn,
      imageUrls,
    });
  }
  return items;
}

/** Public list URL. Returns null for a blank id or the owner segment "me". */
export function publicRealizationsUrl(apiBase: string, profileId: string): string | null {
  const id = profileId.trim();
  if (!id || id === "me") return null;
  return `${apiBase.replace(/\/+$/, "")}/api/contributors/${encodeURIComponent(id)}/realizations`;
}

/**
 * Loads published realizations for a public contributor profile.
 * This never calls the owner endpoint and never sends an access token.
 */
export async function loadPublicRealizations(
  profileId: string
): Promise<PublicRealizationsResult> {
  const { resolveApiBaseUrl } = await import("./apiBase");
  const url = publicRealizationsUrl(resolveApiBaseUrl(), profileId);
  if (!url) return { ok: false, status: 0 };
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status };
    const items = parsePublicRealizations(data);
    if (!items) return { ok: false, status: res.status || 500 };
    return { ok: true, items };
  } catch (err) {
    console.error("[publicRealizations] loadPublicRealizations: network error", { err });
    return { ok: false, status: 0 };
  }
}
