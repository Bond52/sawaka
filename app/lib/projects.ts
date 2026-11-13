export type ProjectStatus = "draft" | "published";
export type ProjectVisibility = "private" | "public";
export type StageStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled";

export type ProjectStage = {
  id: string;
  title: string;
  description: string;
  position: number;
  status: StageStatus;
  blockerExplanation: string;
};

export type OwnedProject = {
  id: string;
  title: string;
  summary: string;
  description: string;
  objective: string;
  category: string;
  country: string;
  city: string;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  stages: ProjectStage[];
};

export type ProjectDraftInput = {
  title: string;
  summary: string;
  description: string;
  objective: string;
  category: string;
  country: string;
  city: string;
};

export const PROJECT_FIELD_LIMITS = {
  title: 120,
  summary: 280,
  description: 4000,
  objective: 2000,
  category: 80,
  country: 80,
  city: 80,
} as const;

const EDITABLE_FIELDS = Object.keys(PROJECT_FIELD_LIMITS) as Array<keyof ProjectDraftInput>;

export type ProjectFailure = {
  ok: false;
  status: number;
  code: string;
  fields?: string[];
};

export type ProjectResult =
  | { ok: true; project: OwnedProject }
  | ProjectFailure;

export type ProjectListResult =
  | { ok: true; projects: OwnedProject[] }
  | ProjectFailure;

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const STAGE_STATUSES: StageStatus[] = [
  "not_started",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
];

function parseStage(value: unknown): ProjectStage | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  if (typeof value.title !== "string" || typeof value.description !== "string") return null;
  if (typeof value.blockerExplanation !== "string" || typeof value.position !== "number") return null;
  if (!STAGE_STATUSES.includes(value.status as StageStatus)) return null;
  return {
    id: value.id,
    title: value.title,
    description: value.description,
    position: value.position,
    status: value.status as StageStatus,
    blockerExplanation: value.blockerExplanation,
  };
}

export function parseOwnedProject(value: unknown): OwnedProject | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || value.id.length === 0) return null;
  const text = (key: string) => (typeof value[key] === "string" ? value[key] : null);
  const title = text("title");
  const summary = text("summary");
  const description = text("description");
  const objective = text("objective");
  const category = text("category");
  const country = text("country");
  const city = text("city");
  if (
    title === null ||
    summary === null ||
    description === null ||
    objective === null ||
    category === null ||
    country === null ||
    city === null
  ) {
    return null;
  }
  if (value.status !== "draft" && value.status !== "published") return null;
  if (value.visibility !== "private" && value.visibility !== "public") return null;
  if ("ownerId" in value) return null;
  const stages = Array.isArray(value.stages) ? value.stages.map(parseStage) : [];
  if (!Array.isArray(value.stages) && value.stages !== undefined) return null;
  if (stages.some((stage) => stage === null)) return null;
  return {
    id: value.id,
    title,
    summary,
    description,
    objective,
    category,
    country,
    city,
    status: value.status,
    visibility: value.visibility,
    stages: stages as ProjectStage[],
  };
}

export function projectDraftPayload(input: ProjectDraftInput): ProjectDraftInput {
  const payload = {} as ProjectDraftInput;
  for (const field of EDITABLE_FIELDS) {
    payload[field] = input[field] ?? "";
  }
  return payload;
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function failure(status: number, data: unknown): ProjectFailure {
  const code =
    isRecord(data) && isRecord(data.error) && typeof data.error.code === "string"
      ? data.error.code
      : "SERVER_ERROR";
  const fields =
    isRecord(data) &&
    isRecord(data.error) &&
    Array.isArray(data.error.fields) &&
    data.error.fields.every((field) => typeof field === "string")
      ? data.error.fields
      : undefined;
  return { ok: false, status, code, fields };
}

async function sendProject(
  path: string,
  method: "GET" | "POST" | "PATCH" | "PUT",
  body?: ProjectDraftInput | Record<string, unknown>,
  rawBody = false
): Promise<{ status: number; data: unknown } | ProjectFailure> {
  const { readStoredUser } = await import("./authUser");
  const { resolveApiBaseUrl } = await import("./apiBase");
  const user = readStoredUser();
  if (!user) return { ok: false, status: 401, code: "UNAUTHORIZED" };
  try {
    const res = await fetch(`${resolveApiBaseUrl()}${path}`, {
      method,
      credentials: "include",
      headers: {
        ...authHeaders(user.token),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body
        ? JSON.stringify(rawBody ? body : projectDraftPayload(body as ProjectDraftInput))
        : undefined,
    });
    const data = await readJson(res);
    if (!res.ok) return failure(res.status, data);
    return { status: res.status, data };
  } catch (err) {
    console.error("[projects] request failed", { method, path, name: err instanceof Error ? err.name : "Error" });
    return { ok: false, status: 0, code: "NETWORK" };
  }
}

export async function listOwnedProjects(): Promise<ProjectListResult> {
  const result = await sendProject("/api/projects/mine", "GET");
  if ("ok" in result) return result;
  const projects = isRecord(result.data) && Array.isArray(result.data.projects)
    ? result.data.projects.map(parseOwnedProject)
    : null;
  if (!projects || projects.some((project) => project === null)) {
    return { ok: false, status: result.status, code: "INVALID_RESPONSE" };
  }
  return { ok: true, projects };
}

export async function getOwnedProject(id: string): Promise<ProjectResult> {
  const result = await sendProject(`/api/projects/mine/${encodeURIComponent(id)}`, "GET");
  if ("ok" in result) return result;
  const project = isRecord(result.data) ? parseOwnedProject(result.data.project) : null;
  if (!project) return { ok: false, status: result.status, code: "INVALID_RESPONSE" };
  return { ok: true, project };
}

export async function createProjectDraft(input: ProjectDraftInput): Promise<ProjectResult> {
  const result = await sendProject("/api/projects", "POST", input);
  if ("ok" in result) return result;
  const project = isRecord(result.data) ? parseOwnedProject(result.data.project) : null;
  if (!project) return { ok: false, status: result.status, code: "INVALID_RESPONSE" };
  return { ok: true, project };
}

export async function updateProjectDraft(
  id: string,
  input: ProjectDraftInput
): Promise<ProjectResult> {
  const result = await sendProject(`/api/projects/mine/${encodeURIComponent(id)}`, "PATCH", input);
  if ("ok" in result) return result;
  const project = isRecord(result.data) ? parseOwnedProject(result.data.project) : null;
  if (!project) return { ok: false, status: result.status, code: "INVALID_RESPONSE" };
  return { ok: true, project };
}

export async function publishOwnedProject(
  id: string,
  input: ProjectDraftInput
): Promise<ProjectResult> {
  const result = await sendProject(
    `/api/projects/mine/${encodeURIComponent(id)}/publish`,
    "POST",
    input
  );
  if ("ok" in result) return result;
  const project = isRecord(result.data) ? parseOwnedProject(result.data.project) : null;
  if (!project) return { ok: false, status: result.status, code: "INVALID_RESPONSE" };
  return { ok: true, project };
}

export async function createProjectStage(
  projectId: string,
  input: { title: string; description: string; status: StageStatus; blockerExplanation: string }
): Promise<ProjectResult> {
  const result = await sendProject(
    `/api/projects/mine/${encodeURIComponent(projectId)}/stages`,
    "POST",
    input,
    true
  );
  if ("ok" in result) return result;
  const project = isRecord(result.data) ? parseOwnedProject(result.data.project) : null;
  if (!project) return { ok: false, status: result.status, code: "INVALID_RESPONSE" };
  return { ok: true, project };
}

export async function updateProjectStage(
  projectId: string,
  stageId: string,
  input: { title: string; description: string; status: StageStatus; blockerExplanation: string }
): Promise<ProjectResult> {
  const result = await sendProject(
    `/api/projects/mine/${encodeURIComponent(projectId)}/stages/${encodeURIComponent(stageId)}`,
    "PATCH",
    input,
    true
  );
  if ("ok" in result) return result;
  const project = isRecord(result.data) ? parseOwnedProject(result.data.project) : null;
  if (!project) return { ok: false, status: result.status, code: "INVALID_RESPONSE" };
  return { ok: true, project };
}

export async function reorderProjectStages(
  projectId: string,
  orderedIds: string[]
): Promise<ProjectResult> {
  const result = await sendProject(
    `/api/projects/mine/${encodeURIComponent(projectId)}/stages/order`,
    "PUT",
    { orderedIds },
    true
  );
  if ("ok" in result) return result;
  const project = isRecord(result.data) ? parseOwnedProject(result.data.project) : null;
  if (!project) return { ok: false, status: result.status, code: "INVALID_RESPONSE" };
  return { ok: true, project };
}

export const SAVED_PROJECT_STORAGE_KEY = "sawaka-project-saved";
