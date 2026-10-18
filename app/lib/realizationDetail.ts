export type TaxonomyName = { id: string; nameFR: string; nameEN: string };

const COMPLETED_ON = /^(\d{4})-(\d{2})-(\d{2})$/;

function isCompletedOn(value: string): boolean {
  const match = COMPLETED_ON.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export type RealizationContributor = {
  id: string;
  displayName: string;
  photoUrl: string | null;
  city: string;
  region: string;
  country: string;
  domain: TaxonomyName | null;
};

/** One published realization and the public contributor card. */
export type RealizationDetail = {
  id: string;
  title: string;
  description: string;
  domainId: string | null;
  domain: TaxonomyName | null;
  completedOn: string | null;
  mainMaterial: string;
  imageUrls: string[];
  contributor: RealizationContributor;
};

export type RealizationDetailResult =
  | { ok: true; detail: RealizationDetail }
  | { ok: false; status: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readTaxonomy(value: unknown): TaxonomyName | null | undefined {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) return undefined;
  if (typeof value.id !== "string" || value.id.trim() === "") return undefined;
  if (typeof value.nameFR !== "string" || typeof value.nameEN !== "string") return undefined;
  return { id: value.id, nameFR: value.nameFR, nameEN: value.nameEN };
}

function readText(value: unknown): string | undefined {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return undefined;
  return value;
}

/**
 * Reads GET /api/realizations/:id.
 * A null result means the payload is not the public detail contract.
 */
export function parseRealizationDetail(data: unknown): RealizationDetail | null {
  if (!isRecord(data) || !isRecord(data.realization) || !isRecord(data.contributor)) return null;
  const row = data.realization;
  const person = data.contributor;
  if (typeof row.id !== "string" || row.id.trim() === "") return null;
  if (typeof row.description !== "string") return null;
  const title = readText(row.title);
  if (title === undefined) return null;
  let domainId: string | null;
  if (typeof row.domainId === "string" && row.domainId.trim() !== "") domainId = row.domainId;
  else if (row.domainId === null || row.domainId === undefined) domainId = null;
  else return null;
  const domain = readTaxonomy(row.domain);
  if (domain === undefined) return null;
  const completedOn = readText(row.completedOn);
  if (completedOn === undefined) return null;
  if (completedOn !== "" && !isCompletedOn(completedOn)) return null;
  const mainMaterial = readText(row.mainMaterial);
  if (mainMaterial === undefined) return null;
  if (!Array.isArray(row.images)) return null;
  const imageUrls: string[] = [];
  for (const image of row.images) {
    if (!isRecord(image) || typeof image.url !== "string" || image.url.trim() === "") return null;
    imageUrls.push(image.url);
  }
  if (typeof person.id !== "string" || person.id.trim() === "") return null;
  if (typeof person.displayName !== "string" || person.displayName.trim() === "") return null;
  const photoUrl = readText(person.photoUrl);
  const city = readText(person.city);
  const region = readText(person.region);
  const country = readText(person.country);
  const contributorDomain = readTaxonomy(person.domain);
  if (
    photoUrl === undefined ||
    city === undefined ||
    region === undefined ||
    country === undefined ||
    contributorDomain === undefined
  ) {
    return null;
  }
  return {
    id: row.id,
    title,
    description: row.description,
    domainId,
    domain,
    completedOn: completedOn || null,
    mainMaterial,
    imageUrls,
    contributor: {
      id: person.id,
      displayName: person.displayName,
      photoUrl: photoUrl || null,
      city,
      region,
      country,
      domain: contributorDomain,
    },
  };
}

export function realizationDetailUrl(apiBase: string, id: string): string {
  return `${apiBase.replace(/\/+$/, "")}/api/realizations/${encodeURIComponent(id)}`;
}

/** Public detail. No access token and no owner endpoint. */
export async function loadRealizationDetail(id: string): Promise<RealizationDetailResult> {
  const trimmed = id.trim();
  if (!trimmed) return { ok: false, status: 404 };
  const { resolveApiBaseUrl } = await import("./apiBase");
  try {
    const res = await fetch(realizationDetailUrl(resolveApiBaseUrl(), trimmed), {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
    });
    const data = await res.json().catch(() => null);
    if (res.status === 404) return { ok: false, status: 404 };
    if (!res.ok) return { ok: false, status: res.status };
    const detail = parseRealizationDetail(data);
    if (!detail) return { ok: false, status: res.status || 500 };
    return { ok: true, detail };
  } catch (err) {
    console.error("[realizationDetail] loadRealizationDetail: network error", { err });
    return { ok: false, status: 0 };
  }
}

export function formatCompletedMonth(value: string, locale: string): string {
  if (!isCompletedOn(value)) return "";
  const match = COMPLETED_ON.exec(value);
  if (!match) return "";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString(locale === "fr" ? "fr" : "en", {
    month: "long",
    year: "numeric",
  });
}
