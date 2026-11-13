export type ProjectStatus = "draft" | "published";
export type ProjectVisibility = "private" | "public";
export type StageStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled";

export type NeedKind = "skill" | "service" | "resource" | "assistance";
export type NeedStatus = "open" | "blocked" | "fulfilled" | "cancelled";

export type ProjectImage = {
  id: string;
  url: string;
};

export type ProjectNeed = {
  id: string;
  title: string;
  description: string;
  kind: NeedKind;
  status: NeedStatus;
  blockerExplanation: string;
};

export type ProjectStage = {
  id: string;
  title: string;
  description: string;
  position: number;
  status: StageStatus;
  blockerExplanation: string;
  needs: ProjectNeed[];
  images: ProjectImage[];
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
  coverImage: ProjectImage | null;
  images: ProjectImage[];
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

export const PUBLICATION_FIELDS = [
  "title",
  "description",
  "objective",
  "category",
  "country",
  "city",
] as const;

export type PendingStage = {
  id: string;
  title: string;
  description: string;
  status: StageStatus;
  blockerExplanation: string;
  needs: ProjectNeed[];
};

export function missingPublicationFields(input: ProjectDraftInput): Array<(typeof PUBLICATION_FIELDS)[number]> {
  return PUBLICATION_FIELDS.filter((field) => input[field].trim().length === 0);
}

export function pendingStagesPayload(stages: PendingStage[]) {
  return stages.map((stage) => ({
    title: stage.title.trim(),
    description: stage.description.trim(),
    status: stage.status,
    blockerExplanation: stage.blockerExplanation.trim(),
    needs: stage.needs.map((need) => ({
      title: need.title.trim(),
      description: need.description.trim(),
      kind: need.kind,
      status: need.status,
      blockerExplanation: need.status === "blocked" ? need.blockerExplanation.trim() : "",
    })),
  }));
}

export function pendingContentIssue(stages: PendingStage[]): string | null {
  for (const stage of stages) {
    if (stage.title.trim().length === 0) return "STAGE_TITLE_REQUIRED";
    if (
      stage.title.trim().length > 120 ||
      stage.description.trim().length > 2000 ||
      stage.blockerExplanation.trim().length > 1000
    ) {
      return "FIELD_TOO_LONG";
    }
    for (const need of stage.needs) {
      if (need.title.trim().length === 0) return "NEED_TITLE_REQUIRED";
      if (!need.kind) return "NEED_KIND_REQUIRED";
      if (need.status === "blocked" && need.blockerExplanation.trim().length === 0) {
        return "BLOCKER_EXPLANATION_REQUIRED";
      }
      if (
        need.title.trim().length > 120 ||
        need.description.trim().length > 2000 ||
        need.blockerExplanation.trim().length > 1000
      ) {
        return "FIELD_TOO_LONG";
      }
    }
  }
  return null;
}

export function createPendingId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pending-${Date.now()}`;
}

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

const NEED_KINDS: NeedKind[] = ["skill", "service", "resource", "assistance"];
const NEED_STATUSES: NeedStatus[] = ["open", "blocked", "fulfilled", "cancelled"];

function parseImage(value: unknown): ProjectImage | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.url !== "string") return null;
  if (!value.url.startsWith("https://") || "publicId" in value) return null;
  return { id: value.id, url: value.url };
}

function parseImages(value: unknown): ProjectImage[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const images = value.map(parseImage);
  if (images.some((image) => image === null)) return null;
  return images as ProjectImage[];
}

function parseNeed(value: unknown): ProjectNeed | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  if (typeof value.title !== "string" || typeof value.description !== "string") return null;
  if (typeof value.blockerExplanation !== "string") return null;
  if (!NEED_KINDS.includes(value.kind as NeedKind)) return null;
  if (!NEED_STATUSES.includes(value.status as NeedStatus)) return null;
  return {
    id: value.id,
    title: value.title,
    description: value.description,
    kind: value.kind as NeedKind,
    status: value.status as NeedStatus,
    blockerExplanation: value.blockerExplanation,
  };
}

function parseStage(value: unknown): ProjectStage | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  if (typeof value.title !== "string" || typeof value.description !== "string") return null;
  if (typeof value.blockerExplanation !== "string" || typeof value.position !== "number") return null;
  if (!STAGE_STATUSES.includes(value.status as StageStatus)) return null;
  if (value.needs !== undefined && !Array.isArray(value.needs)) return null;
  const needs = Array.isArray(value.needs) ? value.needs.map(parseNeed) : [];
  if (needs.some((need) => need === null)) return null;
  const images = parseImages(value.images);
  if (!images) return null;
  return {
    id: value.id,
    title: value.title,
    description: value.description,
    position: value.position,
    status: value.status as StageStatus,
    blockerExplanation: value.blockerExplanation,
    needs: needs as ProjectNeed[],
    images,
  };
}

export function projectProgress(stages: Array<{ status: string }>): {
  available: boolean;
  percent: number | null;
} {
  const eligible = stages.filter((stage) => stage.status !== "cancelled");
  if (eligible.length === 0) return { available: false, percent: null };
  const completed = eligible.filter((stage) => stage.status === "completed").length;
  return {
    available: true,
    percent: Math.round((completed / eligible.length) * 100),
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
  const coverImage = value.coverImage == null ? null : parseImage(value.coverImage);
  if (value.coverImage != null && !coverImage) return null;
  const images = parseImages(value.images);
  if (!images) return null;
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
    coverImage,
    images,
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
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
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
  return createOwnedProject(input);
}

export async function createOwnedProject(
  input: ProjectDraftInput,
  options?: { publish?: boolean; stages?: PendingStage[] }
): Promise<ProjectResult> {
  const body: Record<string, unknown> = { ...projectDraftPayload(input) };
  if (options?.publish) body.publish = true;
  if (options?.stages && options.stages.length > 0) {
    body.stages = pendingStagesPayload(options.stages);
  }
  const result = await sendProject("/api/projects", "POST", body, true);
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

export async function removeProjectStage(projectId: string, stageId: string): Promise<ProjectResult> {
  const result = await sendProject(
    `/api/projects/mine/${encodeURIComponent(projectId)}/stages/${encodeURIComponent(stageId)}`,
    "DELETE"
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

export type NeedInput = {
  title: string;
  description: string;
  kind: NeedKind;
  status: NeedStatus;
  blockerExplanation: string;
};

export async function createProjectNeed(
  projectId: string,
  stageId: string,
  input: NeedInput
): Promise<ProjectResult> {
  const result = await sendProject(
    `/api/projects/mine/${encodeURIComponent(projectId)}/stages/${encodeURIComponent(stageId)}/needs`,
    "POST",
    input,
    true
  );
  if ("ok" in result) return result;
  const project = isRecord(result.data) ? parseOwnedProject(result.data.project) : null;
  if (!project) return { ok: false, status: result.status, code: "INVALID_RESPONSE" };
  return { ok: true, project };
}

export async function updateProjectNeed(
  projectId: string,
  stageId: string,
  needId: string,
  input: NeedInput
): Promise<ProjectResult> {
  const result = await sendProject(
    `/api/projects/mine/${encodeURIComponent(projectId)}/stages/${encodeURIComponent(stageId)}/needs/${encodeURIComponent(needId)}`,
    "PATCH",
    input,
    true
  );
  if ("ok" in result) return result;
  const project = isRecord(result.data) ? parseOwnedProject(result.data.project) : null;
  if (!project) return { ok: false, status: result.status, code: "INVALID_RESPONSE" };
  return { ok: true, project };
}

export async function removeProjectNeed(
  projectId: string,
  stageId: string,
  needId: string
): Promise<ProjectResult> {
  const result = await sendProject(
    `/api/projects/mine/${encodeURIComponent(projectId)}/stages/${encodeURIComponent(stageId)}/needs/${encodeURIComponent(needId)}`,
    "DELETE"
  );
  if ("ok" in result) return result;
  const project = isRecord(result.data) ? parseOwnedProject(result.data.project) : null;
  if (!project) return { ok: false, status: result.status, code: "INVALID_RESPONSE" };
  return { ok: true, project };
}

async function sendProjectFile(
  path: string,
  method: "POST" | "DELETE",
  file?: File
): Promise<ProjectResult> {
  const { readStoredUser } = await import("./authUser");
  const { resolveApiBaseUrl } = await import("./apiBase");
  const user = readStoredUser();
  if (!user) return { ok: false, status: 401, code: "UNAUTHORIZED" };
  const body = new FormData();
  if (file) body.append("image", file);
  try {
    const res = await fetch(`${resolveApiBaseUrl()}${path}`, {
      method,
      credentials: "include",
      headers: authHeaders(user.token),
      body: file ? body : undefined,
    });
    const data = await readJson(res);
    if (!res.ok) return failure(res.status, data);
    const project = isRecord(data) ? parseOwnedProject(data.project) : null;
    if (!project) return { ok: false, status: res.status, code: "INVALID_RESPONSE" };
    return { ok: true, project };
  } catch (err) {
    console.error("[projects] image request failed", {
      method,
      path,
      name: err instanceof Error ? err.name : "Error",
    });
    return { ok: false, status: 0, code: "NETWORK" };
  }
}

export function uploadProjectCover(projectId: string, file: File): Promise<ProjectResult> {
  return sendProjectFile(`/api/projects/mine/${encodeURIComponent(projectId)}/cover`, "POST", file);
}

export function removeProjectCover(projectId: string): Promise<ProjectResult> {
  return sendProjectFile(`/api/projects/mine/${encodeURIComponent(projectId)}/cover`, "DELETE");
}

export function addOwnedProjectImage(projectId: string, file: File): Promise<ProjectResult> {
  return sendProjectFile(`/api/projects/mine/${encodeURIComponent(projectId)}/images`, "POST", file);
}

export function removeOwnedProjectImage(projectId: string, imageId: string): Promise<ProjectResult> {
  return sendProjectFile(
    `/api/projects/mine/${encodeURIComponent(projectId)}/images/${encodeURIComponent(imageId)}`,
    "DELETE"
  );
}

export function uploadStageImage(projectId: string, stageId: string, file: File): Promise<ProjectResult> {
  return sendProjectFile(
    `/api/projects/mine/${encodeURIComponent(projectId)}/stages/${encodeURIComponent(stageId)}/images`,
    "POST",
    file
  );
}

export function removeStageImage(
  projectId: string,
  stageId: string,
  imageId: string
): Promise<ProjectResult> {
  return sendProjectFile(
    `/api/projects/mine/${encodeURIComponent(projectId)}/stages/${encodeURIComponent(stageId)}/images/${encodeURIComponent(imageId)}`,
    "DELETE"
  );
}

export const SAVED_PROJECT_STORAGE_KEY = "sawaka-project-saved";
export const PROJECT_UPLOAD_ERROR_KEY = "sawaka-project-upload-error";
