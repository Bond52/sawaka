import { resolveApiBaseUrl } from "@/app/lib/apiBase";
import { readStoredUser } from "@/app/lib/authUser";

export type MatchedEntity = {
  id: string;
  kind: "contributor" | "supplier";
  label: string;
  detail: string;
  location: string;
  href: string;
};

export type IdeaNeed = {
  id?: string;
  title: string;
  description: string;
  kind: "skill" | "service" | "resource" | "assistance";
  domainOrSkills?: string;
  geographicNote?: string;
  matchedContributors: MatchedEntity[];
  matchedSuppliers: MatchedEntity[];
  missingCapabilities: string[];
};

export type IdeaStage = {
  id?: string;
  title: string;
  description: string;
  position?: number;
  needs: IdeaNeed[];
};

export type GeneratedIdea = {
  id?: string;
  title: string;
  summary: string;
  description: string;
  objective: string;
  category: string;
  country: string;
  city: string;
  relevance: string;
  budgetNotes: string;
  challenges: string[];
  stages: IdeaStage[];
};

export type IdeationCriteria = {
  interests: string;
  objective: string;
  category: string;
  skills: string;
  country: string;
  city: string;
  budgetAmount: string;
  budgetCurrency: string;
  resources: string;
  constraints: string;
  locale?: "fr" | "en";
  limit?: number;
  refineInstruction?: string;
  focusTitle?: string;
};

export const IDEA_PREFILL_KEY = "sawaka-idea-prefill";

function authHeaders(): HeadersInit {
  const user = readStoredUser();
  return user?.token ? { Authorization: `Bearer ${user.token}` } : {};
}

async function readJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export async function generateProjectIdeas(criteria: IdeationCriteria) {
  const body = {
    ...criteria,
    budgetAmount:
      criteria.budgetAmount.trim() === "" ? null : Number(criteria.budgetAmount),
  };
  try {
    const res = await fetch(`${resolveApiBaseUrl()}/api/project-ideas/generate`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
    const data = await readJson(res);
    if (!res.ok) {
      return {
        ok: false as const,
        status: res.status,
        code: data?.error?.code || (res.status === 429 ? "RATE_LIMIT" : "SERVER_ERROR"),
      };
    }
    return {
      ok: true as const,
      ideas: (data.ideas || []) as GeneratedIdea[],
      criteria: data.criteria as IdeationCriteria,
      ecosystem: data.ecosystem as { contributorCount: number; supplierCount: number },
    };
  } catch {
    return { ok: false as const, status: 0, code: "NETWORK" };
  }
}

export async function saveProjectIdea(
  idea: GeneratedIdea,
  criteria: IdeationCriteria,
  locale: "fr" | "en"
) {
  if (!readStoredUser()) return { ok: false as const, status: 401, code: "UNAUTHORIZED" };
  try {
    const res = await fetch(`${resolveApiBaseUrl()}/api/project-ideas/mine`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ idea, criteria, locale }),
    });
    const data = await readJson(res);
    if (!res.ok) {
      return { ok: false as const, status: res.status, code: data?.error?.code || "SERVER_ERROR" };
    }
    return { ok: true as const, idea: data.idea as GeneratedIdea };
  } catch {
    return { ok: false as const, status: 0, code: "NETWORK" };
  }
}

export async function listSavedProjectIdeas() {
  if (!readStoredUser()) return { ok: false as const, status: 401, code: "UNAUTHORIZED" };
  try {
    const res = await fetch(`${resolveApiBaseUrl()}/api/project-ideas/mine`, {
      credentials: "include",
      headers: { ...authHeaders() },
    });
    const data = await readJson(res);
    if (!res.ok) {
      return { ok: false as const, status: res.status, code: data?.error?.code || "SERVER_ERROR" };
    }
    return { ok: true as const, ideas: (data.ideas || []) as GeneratedIdea[] };
  } catch {
    return { ok: false as const, status: 0, code: "NETWORK" };
  }
}

export async function deleteSavedProjectIdea(id: string) {
  if (!readStoredUser()) return { ok: false as const, status: 401, code: "UNAUTHORIZED" };
  try {
    const res = await fetch(`${resolveApiBaseUrl()}/api/project-ideas/mine/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
      headers: { ...authHeaders() },
    });
    if (!res.ok) {
      const data = await readJson(res);
      return { ok: false as const, status: res.status, code: data?.error?.code || "SERVER_ERROR" };
    }
    return { ok: true as const };
  } catch {
    return { ok: false as const, status: 0, code: "NETWORK" };
  }
}

export async function convertIdeaPayloadToProject(idea: GeneratedIdea) {
  if (!readStoredUser()) return { ok: false as const, status: 401, code: "UNAUTHORIZED" };
  try {
    const res = await fetch(`${resolveApiBaseUrl()}/api/project-ideas/convert`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ idea }),
    });
    const data = await readJson(res);
    if (!res.ok) {
      return { ok: false as const, status: res.status, code: data?.error?.code || "SERVER_ERROR" };
    }
    return { ok: true as const, project: data.project };
  } catch {
    return { ok: false as const, status: 0, code: "NETWORK" };
  }
}

export function storeIdeaPrefill(idea: GeneratedIdea) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(IDEA_PREFILL_KEY, JSON.stringify(idea));
}

export function readIdeaPrefill(): GeneratedIdea | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(IDEA_PREFILL_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GeneratedIdea;
  } catch {
    return null;
  }
}

export function clearIdeaPrefill() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(IDEA_PREFILL_KEY);
}

export function ideaToPendingStages(idea: GeneratedIdea) {
  return (idea.stages || []).map((stage, index) => ({
    id: `pending-stage-${index}`,
    title: stage.title,
    description: stage.description || "",
    status: "not_started" as const,
    blockerExplanation: "",
    needs: (stage.needs || []).map((need, needIndex) => ({
      id: `pending-need-${index}-${needIndex}`,
      title: need.title,
      description: need.description || "",
      kind: need.kind,
      status: "open" as const,
      blockerExplanation: "",
    })),
  }));
}
