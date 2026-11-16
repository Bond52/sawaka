export type ProjectStatus = "draft" | "published";
export type ProjectVisibility = "private" | "public";
export type CommentAccess = "members" | "everyone";
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
  commentAccess: CommentAccess;
  coverImage: ProjectImage | null;
  images: ProjectImage[];
  stages: ProjectStage[];
};

export type PublicProject = {
  id: string;
  title: string;
  summary: string;
  description: string;
  objective: string;
  category: string;
  country: string;
  city: string;
  status: "published";
  publishedAt: string | null;
  commentAccess: CommentAccess;
  coverImage: ProjectImage | null;
  images: ProjectImage[];
  stages: ProjectStage[];
};

export type PublicProjectResult =
  | { ok: true; project: PublicProject; viewerCanModerate: boolean }
  | ProjectFailure;

export type PublicDirectoryQuery = {
  q?: string;
  category?: string;
  country?: string;
  city?: string;
  stageStatus?: StageStatus | "";
  needKind?: NeedKind | "";
  needStatus?: NeedStatus | "";
  page?: number;
  limit?: number;
};

export type PublicProjectListResult =
  | {
      ok: true;
      projects: PublicProject[];
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    }
  | ProjectFailure;

export type ProjectComment = {
  id: string;
  projectId: string;
  target: "project" | "need";
  needId: string | null;
  stageId: string | null;
  authorType: "member" | "visitor";
  authorLabel: string | null;
  authorId: string | null;
  body: string;
  createdAt: string;
};

export type ProjectDraftInput = {
  title: string;
  summary: string;
  description: string;
  objective: string;
  category: string;
  country: string;
  city: string;
  commentAccess: CommentAccess;
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

const EDITABLE_FIELDS = Object.keys(PROJECT_FIELD_LIMITS) as Array<
  Exclude<keyof ProjectDraftInput, "commentAccess">
>;

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

function parseProjectCore(value: Record<string, unknown>): {
  id: string;
  title: string;
  summary: string;
  description: string;
  objective: string;
  category: string;
  country: string;
  city: string;
  coverImage: ProjectImage | null;
  images: ProjectImage[];
  stages: ProjectStage[];
} | null {
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
    coverImage,
    images,
    stages: stages as ProjectStage[],
  };
}

function parseCommentAccess(value: unknown): CommentAccess {
  return value === "everyone" ? "everyone" : "members";
}

export function parseOwnedProject(value: unknown): OwnedProject | null {
  if (!isRecord(value)) return null;
  const core = parseProjectCore(value);
  if (!core) return null;
  if (value.status !== "draft" && value.status !== "published") return null;
  if (value.visibility !== "private" && value.visibility !== "public") return null;
  return {
    ...core,
    status: value.status,
    visibility: value.visibility,
    commentAccess: parseCommentAccess(value.commentAccess),
  };
}

export function parsePublicProject(value: unknown): PublicProject | null {
  if (!isRecord(value)) return null;
  const core = parseProjectCore(value);
  if (!core) return null;
  if (value.status !== "published") return null;
  if ("visibility" in value || "ownerId" in value) return null;
  let publishedAt: string | null = null;
  if (value.publishedAt === null || value.publishedAt === undefined) {
    publishedAt = null;
  } else if (typeof value.publishedAt === "string") {
    publishedAt = value.publishedAt;
  } else {
    return null;
  }
  return {
    ...core,
    status: "published",
    publishedAt,
    commentAccess: parseCommentAccess(value.commentAccess),
  };
}

export function projectDraftPayload(input: ProjectDraftInput): ProjectDraftInput {
  const payload = {} as ProjectDraftInput;
  for (const field of EDITABLE_FIELDS) {
    payload[field] = input[field] ?? "";
  }
  payload.commentAccess = input.commentAccess === "everyone" ? "everyone" : "members";
  return payload;
}

function parseComment(value: unknown): ProjectComment | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  if (typeof value.projectId !== "string" || typeof value.body !== "string") return null;
  if (value.target !== "project" && value.target !== "need") return null;
  if (value.authorType !== "member" && value.authorType !== "visitor") return null;
  if (typeof value.createdAt !== "string") return null;
  return {
    id: value.id,
    projectId: value.projectId,
    target: value.target,
    needId: typeof value.needId === "string" ? value.needId : null,
    stageId: typeof value.stageId === "string" ? value.stageId : null,
    authorType: value.authorType,
    authorLabel: typeof value.authorLabel === "string" ? value.authorLabel : null,
    authorId: typeof value.authorId === "string" ? value.authorId : null,
    body: value.body,
    createdAt: value.createdAt,
  };
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

async function readPublicJson(path: string): Promise<{ status: number; data: unknown } | ProjectFailure> {
  const { resolveApiBaseUrl } = await import("./apiBase");
  try {
    const res = await fetch(`${resolveApiBaseUrl()}${path}`, {
      method: "GET",
      credentials: "include",
    });
    const data = await readJson(res);
    if (!res.ok) return failure(res.status, data);
    return { status: res.status, data };
  } catch (err) {
    console.error("[projects] public request failed", {
      path,
      name: err instanceof Error ? err.name : "Error",
    });
    return { ok: false, status: 0, code: "NETWORK" };
  }
}

export function buildPublicDirectoryQuery(params: PublicDirectoryQuery): string {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.category?.trim()) search.set("category", params.category.trim());
  if (params.country?.trim()) search.set("country", params.country.trim());
  if (params.city?.trim()) search.set("city", params.city.trim());
  if (params.stageStatus) search.set("stageStatus", params.stageStatus);
  if (params.needKind) search.set("needKind", params.needKind);
  if (params.needStatus) search.set("needStatus", params.needStatus);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function listPublicProjects(
  params: PublicDirectoryQuery = {}
): Promise<PublicProjectListResult> {
  const result = await readPublicJson(`/api/projects${buildPublicDirectoryQuery(params)}`);
  if ("ok" in result) return result;
  const projects = isRecord(result.data) && Array.isArray(result.data.projects)
    ? result.data.projects.map(parsePublicProject)
    : null;
  if (!projects || projects.some((project) => project === null)) {
    return { ok: false, status: result.status, code: "INVALID_RESPONSE" };
  }
  const page = isRecord(result.data) && typeof result.data.page === "number" ? result.data.page : 1;
  const limit = isRecord(result.data) && typeof result.data.limit === "number" ? result.data.limit : 24;
  const total = isRecord(result.data) && typeof result.data.total === "number" ? result.data.total : projects.length;
  const totalPages =
    isRecord(result.data) && typeof result.data.totalPages === "number"
      ? result.data.totalPages
      : Math.max(1, Math.ceil(total / limit));
  return { ok: true, projects, page, limit, total, totalPages };
}

export async function getPublicProject(id: string): Promise<PublicProjectResult> {
  const { resolveApiBaseUrl } = await import("./apiBase");
  const { readStoredUser } = await import("./authUser");
  const user = readStoredUser();
  try {
    const res = await fetch(`${resolveApiBaseUrl()}/api/projects/${encodeURIComponent(id)}`, {
      method: "GET",
      credentials: "include",
      headers: user ? { Authorization: `Bearer ${user.token}` } : undefined,
    });
    const data = await readJson(res);
    if (!res.ok) return failure(res.status, data);
    const project = isRecord(data) ? parsePublicProject(data.project) : null;
    if (!project) return { ok: false, status: res.status, code: "INVALID_RESPONSE" };
    return {
      ok: true,
      project,
      viewerCanModerate: Boolean(isRecord(data) && data.viewerCanModerate === true),
    };
  } catch (err) {
    console.error("[projects] public detail failed", {
      name: err instanceof Error ? err.name : "Error",
    });
    return { ok: false, status: 0, code: "NETWORK" };
  }
}

export type CommentListResult =
  | { ok: true; comments: ProjectComment[]; commentAccess: CommentAccess }
  | ProjectFailure;

export type CommentResult = { ok: true; comment: ProjectComment } | ProjectFailure;

async function sendPublicComment(
  path: string,
  method: "GET" | "POST" | "DELETE",
  body?: { body: string }
): Promise<{ status: number; data: unknown } | ProjectFailure> {
  const { resolveApiBaseUrl } = await import("./apiBase");
  const { readStoredUser } = await import("./authUser");
  const user = readStoredUser();
  try {
    const res = await fetch(`${resolveApiBaseUrl()}${path}`, {
      method,
      credentials: "include",
      headers: {
        ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await readJson(res);
    if (!res.ok) {
      if (res.status === 429) return { ok: false, status: 429, code: "RATE_LIMITED" };
      return failure(res.status, data);
    }
    return { status: res.status, data };
  } catch (err) {
    console.error("[projects] comment request failed", {
      path,
      name: err instanceof Error ? err.name : "Error",
    });
    return { ok: false, status: 0, code: "NETWORK" };
  }
}

export async function listProjectComments(projectId: string): Promise<CommentListResult> {
  const result = await sendPublicComment(
    `/api/projects/${encodeURIComponent(projectId)}/comments`,
    "GET"
  );
  if ("ok" in result) return result;
  const comments =
    isRecord(result.data) && Array.isArray(result.data.comments)
      ? result.data.comments.map(parseComment)
      : null;
  if (!comments || comments.some((comment) => comment === null)) {
    return { ok: false, status: result.status, code: "INVALID_RESPONSE" };
  }
  return {
    ok: true,
    comments: comments as ProjectComment[],
    commentAccess: parseCommentAccess(isRecord(result.data) ? result.data.commentAccess : null),
  };
}

export async function listNeedComments(projectId: string, needId: string): Promise<CommentListResult> {
  const result = await sendPublicComment(
    `/api/projects/${encodeURIComponent(projectId)}/needs/${encodeURIComponent(needId)}/comments`,
    "GET"
  );
  if ("ok" in result) return result;
  const comments =
    isRecord(result.data) && Array.isArray(result.data.comments)
      ? result.data.comments.map(parseComment)
      : null;
  if (!comments || comments.some((comment) => comment === null)) {
    return { ok: false, status: result.status, code: "INVALID_RESPONSE" };
  }
  return {
    ok: true,
    comments: comments as ProjectComment[],
    commentAccess: parseCommentAccess(isRecord(result.data) ? result.data.commentAccess : null),
  };
}

export async function createProjectComment(projectId: string, body: string): Promise<CommentResult> {
  const result = await sendPublicComment(
    `/api/projects/${encodeURIComponent(projectId)}/comments`,
    "POST",
    { body }
  );
  if ("ok" in result) return result;
  const comment = isRecord(result.data) ? parseComment(result.data.comment) : null;
  if (!comment) return { ok: false, status: result.status, code: "INVALID_RESPONSE" };
  return { ok: true, comment };
}

export async function createNeedComment(
  projectId: string,
  needId: string,
  body: string
): Promise<CommentResult> {
  const result = await sendPublicComment(
    `/api/projects/${encodeURIComponent(projectId)}/needs/${encodeURIComponent(needId)}/comments`,
    "POST",
    { body }
  );
  if ("ok" in result) return result;
  const comment = isRecord(result.data) ? parseComment(result.data.comment) : null;
  if (!comment) return { ok: false, status: result.status, code: "INVALID_RESPONSE" };
  return { ok: true, comment };
}

export async function deleteProjectComment(
  projectId: string,
  commentId: string
): Promise<{ ok: true } | ProjectFailure> {
  const result = await sendPublicComment(
    `/api/projects/${encodeURIComponent(projectId)}/comments/${encodeURIComponent(commentId)}`,
    "DELETE"
  );
  if ("ok" in result) return result;
  return { ok: true };
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
