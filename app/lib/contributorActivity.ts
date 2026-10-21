export const ACTIVITY_LIMIT = 5;

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

export type OwnActivityResult =
  | { ok: true; activities: ContributorActivityItem[] }
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

export function parseOwnActivities(data: unknown): ContributorActivityItem[] | null {
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
  return items.slice(0, ACTIVITY_LIMIT);
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

/** Loads the signed-in contributor's latest activity. The client never sends an owner id. */
export async function loadOwnActivity(): Promise<OwnActivityResult> {
  const { readStoredUser } = await import("./authUser");
  const { resolveApiBaseUrl } = await import("./apiBase");
  const user = readStoredUser();
  if (!user) return { ok: false, status: 401 };
  try {
    const res = await fetch(`${resolveApiBaseUrl()}/api/contributors/me/activity`, {
      method: "GET",
      credentials: "include",
      headers: { Authorization: `Bearer ${user.token}` },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status };
    const activities = parseOwnActivities(data);
    if (!activities) return { ok: false, status: 500 };
    return { ok: true, activities };
  } catch (err) {
    console.error("[contributorActivity] loadOwnActivity: network error", { err });
    return { ok: false, status: 0 };
  }
}
