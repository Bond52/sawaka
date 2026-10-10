import { readStoredUser } from "./authUser";
import { resolveApiBaseUrl } from "./apiBase";
import type { PhotoIssueCode } from "./imageFilePolicy";

export type ImportValidation =
  | {
      ok: true;
      accepted: { index: number; name: string }[];
      rejected: { index: number; name: string; code: PhotoIssueCode }[];
    }
  | { ok: false; status: number; code: string };

const BATCH = 30;

/**
 * Asks the server to check photos and then discards them.
 * The bytes are not stored and no Realization is created.
 */
export async function validateImportPhotos(files: File[]): Promise<ImportValidation> {
  const accepted: { index: number; name: string }[] = [];
  const rejected: { index: number; name: string; code: PhotoIssueCode }[] = [];

  for (let offset = 0; offset < files.length; offset += BATCH) {
    const slice = files.slice(offset, offset + BATCH);
    const result = await validateBatch(slice, offset);
    if (!result.ok) return result;
    accepted.push(...result.accepted);
    rejected.push(...result.rejected);
  }

  return { ok: true, accepted, rejected };
}

async function validateBatch(files: File[], offset: number): Promise<ImportValidation> {
  const body = new FormData();
  files.forEach((file) => body.append("photos", file));
  const headers: Record<string, string> = {};
  const user = readStoredUser();
  if (user?.token) headers.Authorization = `Bearer ${user.token}`;

  try {
    const res = await fetch(`${resolveApiBaseUrl()}/api/contributors/me/import-photos/validate`, {
      method: "POST",
      credentials: "include",
      headers,
      body,
    });
    const data = await res.json().catch(() => null);
    if (res.status === 401) return { ok: false, status: 401, code: "UNAUTHORIZED" };
    if (!res.ok) {
      const field =
        data &&
        typeof data === "object" &&
        (data as { error?: { fields?: { photos?: string } } }).error?.fields?.photos;
      return { ok: false, status: res.status, code: field || "VALIDATION_ERROR" };
    }
    const accepted = readRows(data, "accepted").map((row) => ({
      index: offset + row.index,
      name: row.name,
    }));
    const rejected = readRows(data, "rejected").map((row) => ({
      index: offset + row.index,
      name: row.name,
      code: row.code as PhotoIssueCode,
    }));
    return { ok: true, accepted, rejected };
  } catch {
    return { ok: false, status: 0, code: "NETWORK" };
  }
}

function readRows(data: unknown, key: "accepted" | "rejected"): { index: number; name: string; code?: string }[] {
  if (!data || typeof data !== "object") return [];
  const rows = (data as Record<string, unknown>)[key];
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const index = (row as { index?: unknown }).index;
    const name = (row as { name?: unknown }).name;
    if (typeof index !== "number" || typeof name !== "string") return [];
    const code = (row as { code?: unknown }).code;
    return [{ index, name, code: typeof code === "string" ? code : undefined }];
  });
}
