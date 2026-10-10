import { readStoredUser } from "./authUser";
import { resolveApiBaseUrl } from "./apiBase";
import {
  closeWorkflow,
  getWorkflowSnapshot,
  readImportSelection,
  rememberPublicationHandoff,
  type PublicationHandoff,
} from "./portfolioWorkflow";

export type PublicationItem = {
  clientId: string | null;
  status: string;
  code?: string;
};

export type PublicationCommit =
  | (PublicationHandoff & { ok: true; items: PublicationItem[] })
  | (Partial<PublicationHandoff> & { ok: false; status: number; items?: PublicationItem[] });

export async function commitWorkflowRealizations(
  ownerKey: string,
  intent: "publish-ready" | "save-drafts"
): Promise<PublicationCommit> {
  const user = readStoredUser();
  const snapshot = getWorkflowSnapshot(ownerKey);
  if (!user || snapshot.status !== "ready") return { ok: false, status: 401 };

  const files = new Map(readImportSelection(ownerKey).map((photo) => [photo.id, photo.file]));
  const form = new FormData();
  form.append(
    "manifest",
    JSON.stringify({
      intent,
      groups: snapshot.groups.map((group) => ({
        clientId: group.id,
        sequence: group.sequence,
        description: group.description,
        domainId: group.domainId,
        completedOn: group.completedOn,
        photoIds: group.photoIds,
      })),
    })
  );
  const appended = new Set<string>();
  for (const group of snapshot.groups) {
    for (const photoId of group.photoIds) {
      if (appended.has(photoId)) continue;
      const file = files.get(photoId);
      if (!file) continue;
      form.append("photos", file, photoId);
      appended.add(photoId);
    }
  }

  const headers: Record<string, string> = {};
  if (user.token) headers.Authorization = `Bearer ${user.token}`;

  try {
    const res = await fetch(`${resolveApiBaseUrl()}/api/contributors/me/realizations`, {
      method: "POST",
      headers,
      body: form,
    });
    const data = (await res.json().catch(() => null)) as
      | (PublicationHandoff & { items?: PublicationItem[] })
      | null;
    if (
      !data ||
      typeof data.publishedCount !== "number" ||
      typeof data.draftCount !== "number" ||
      typeof data.failedCount !== "number"
    ) {
      return { ok: false, status: res.status };
    }
    const handoff: PublicationHandoff = {
      publishedCount: data.publishedCount,
      draftCount: data.draftCount,
      failedCount: data.failedCount,
      outcome: data.outcome,
    };
    rememberPublicationHandoff(ownerKey, handoff);
    if (handoff.outcome === "success") closeWorkflow(ownerKey);
    const items = Array.isArray(data.items) ? data.items : [];
    if (handoff.outcome === "failed") {
      return { ok: false, status: res.status, ...handoff, items };
    }
    return { ok: true, ...handoff, items };
  } catch {
    return { ok: false, status: 0 };
  }
}
