export const ACTIVITY_LIMIT = 10;
export const ACTIVITY_MAX_LIMIT = 50;

export const ACTIVITY_TYPES = [
  "profile.updated",
  "realization.created",
  "realization.published",
  "realization.moved_to_draft",
  "realization.edited",
  "realization.deleted",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export type ContributorActivityItem = {
  id: string;
  type: ActivityType;
  entityType: "contributor_profile" | "realization";
  title: string | null;
  createdAt: string;
};

export type OwnActivityPage = {
  activities: ContributorActivityItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type OwnActivityResult =
  | ({ ok: true } & OwnActivityPage)
  | { ok: false; status: number };

const TYPE_SET = new Set<string>(ACTIVITY_TYPES);
const ENTITY_SET = new Set(["contributor_profile", "realization"]);

const MESSAGE_KEYS: Record<ActivityType, { titled: string; untitled: string | null }> = {
  "profile.updated": {
    titled: "dashboard.activity.profileUpdated",
    untitled: null,
  },
  "realization.created": {
    titled: "dashboard.activity.realizationCreated",
    untitled: "dashboard.activity.realizationCreatedUntitled",
  },
  "realization.published": {
    titled: "dashboard.activity.realizationPublished",
    untitled: "dashboard.activity.realizationPublishedUntitled",
  },
  "realization.moved_to_draft": {
    titled: "dashboard.activity.realizationDrafted",
    untitled: "dashboard.activity.realizationDraftedUntitled",
  },
  "realization.edited": {
    titled: "dashboard.activity.realizationEdited",
    untitled: "dashboard.activity.realizationEditedUntitled",
  },
  "realization.deleted": {
    titled: "dashboard.activity.realizationDeleted",
    untitled: "dashboard.activity.realizationDeletedUntitled",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readCount(value: unknown, fallback: number): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return null;
  return value;
}

export function parseOwnActivityPage(data: unknown, itemLimit = ACTIVITY_LIMIT): OwnActivityPage | null {
  if (!isRecord(data) || !Array.isArray(data.activities)) return null;
  const items: ContributorActivityItem[] = [];
  for (const row of data.activities) {
    if (!isRecord(row)) return null;
    if (typeof row.id !== "string" || row.id.trim() === "") return null;
    if (typeof row.type !== "string" || !TYPE_SET.has(row.type)) return null;
    if (typeof row.entityType !== "string" || !ENTITY_SET.has(row.entityType)) return null;
    if (typeof row.createdAt !== "string" || Number.isNaN(new Date(row.createdAt).getTime())) return null;
    let title: string | null = null;
    if (typeof row.title === "string") title = row.title.trim() || null;
    else if (row.title !== null && row.title !== undefined) return null;
    items.push({
      id: row.id,
      type: row.type as ActivityType,
      entityType: row.entityType as ContributorActivityItem["entityType"],
      title,
      createdAt: row.createdAt,
    });
  }
  const page = readCount(data.page, 1);
  const limit = readCount(data.limit, itemLimit);
  const total = readCount(data.total, items.length);
  if (page === null || page < 1 || limit === null || limit < 1 || limit > ACTIVITY_MAX_LIMIT || total === null) {
    return null;
  }
  const totalPages = readCount(data.totalPages, total === 0 ? 0 : Math.ceil(total / limit));
  if (totalPages === null) return null;
  return {
    activities: items.slice(0, itemLimit),
    page,
    limit,
    total,
    totalPages,
  };
}

export function parseOwnActivities(data: unknown, itemLimit = ACTIVITY_LIMIT): ContributorActivityItem[] | null {
  const page = parseOwnActivityPage(data, itemLimit);
  return page ? page.activities : null;
}

export function activityMessage(
  type: ActivityType,
  title: string | null
): { key: string; title?: string } {
  const entry = MESSAGE_KEYS[type];
  const snapshot = title?.trim() ?? "";
  if (type === "profile.updated" || !entry.untitled) {
    return { key: entry.titled };
  }
  if (!snapshot) return { key: entry.untitled };
  return { key: entry.titled, title: snapshot };
}

/**
 * Recent events use Intl.RelativeTimeFormat. Older events use a localized calendar date.
 * No date library is added for this.
 */
export function formatActivityTime(iso: string, locale: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const language = locale === "fr" ? "fr" : "en";
  const deltaMs = then - now;
  const absMs = Math.abs(deltaMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const rtf = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
  if (absMs < hour) {
    const minutes = Math.round(deltaMs / minute);
    return rtf.format(minutes === 0 ? (deltaMs < 0 ? -1 : 0) : minutes, "minute");
  }
  if (absMs < day) {
    return rtf.format(Math.round(deltaMs / hour), "hour");
  }
  if (absMs < 7 * day) {
    return rtf.format(Math.round(deltaMs / day), "day");
  }
  return new Date(iso).toLocaleDateString(language, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Loads one page of the signed-in contributor's activity. The client never sends an owner id. */
export async function loadOwnActivity(options?: {
  page?: number | string;
  limit?: number;
}): Promise<OwnActivityResult> {
  const { readStoredUser } = await import("./authUser");
  const { resolveApiBaseUrl } = await import("./apiBase");
  const user = readStoredUser();
  if (!user) return { ok: false, status: 401 };
  const page = options?.page ?? 1;
  const limit = options?.limit ?? ACTIVITY_LIMIT;
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  try {
    const res = await fetch(`${resolveApiBaseUrl()}/api/contributors/me/activity?${params}`, {
      method: "GET",
      credentials: "include",
      headers: { Authorization: `Bearer ${user.token}` },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status };
    const parsed = parseOwnActivityPage(data, typeof limit === "number" ? limit : ACTIVITY_LIMIT);
    if (!parsed) return { ok: false, status: 500 };
    return { ok: true, ...parsed };
  } catch (err) {
    console.error("[contributorActivity] loadOwnActivity: network error", { err });
    return { ok: false, status: 0 };
  }
}
