/**
 * In-memory portfolio import workflow.
 *
 * Files, groups, and optional metadata stay in this browser tab.
 * Nothing is uploaded, stored, or published. A refresh clears the module,
 * and another signed-in user cannot read it.
 * `readReviewContract` is the handoff #438 can read. That page is not built here.
 */

export type PhotoRef = { id: string; name: string };

/** Same ceiling as a contributor biography. Empty text is valid. */
export const REALIZATION_DESCRIPTION_MAX = 2000;

export type RealizationDetails = {
  description: string;
  domainId: string | null;
  completedOn: string | null;
};

export type RealizationGroup = RealizationDetails & {
  id: string;
  sequence: number;
  photoIds: string[];
};

export type GroupingState = {
  photos: PhotoRef[];
  groups: RealizationGroup[];
};

export type WorkflowPhotoView = PhotoRef & { previewUrl: string };

export type WorkflowView =
  | { status: "empty" }
  | {
      status: "ready";
      ownerKey: string;
      photos: WorkflowPhotoView[];
      groups: RealizationGroup[];
      reviewPrepared: boolean;
    };

type StoredPhoto = WorkflowPhotoView & { file: File };

type Memory = {
  ownerKey: string;
  photos: StoredPhoto[];
  groups: RealizationGroup[];
  reviewPrepared: boolean;
};

const EMPTY: WorkflowView = { status: "empty" };

let memory: Memory | null = null;
let view: WorkflowView = EMPTY;
const listeners = new Set<() => void>();

export function unassignedPhotoIds(state: GroupingState): string[] {
  const assigned = new Set(state.groups.flatMap((group) => group.photoIds));
  return state.photos.map((photo) => photo.id).filter((id) => !assigned.has(id));
}

export function groupIntoOne(state: GroupingState, selectedIds: string[]): GroupingState {
  const chosen = orderedUnassigned(state, selectedIds);
  if (chosen.length === 0) return state;
  return {
    photos: state.photos,
    groups: [...state.groups, createGroup(state.groups, chosen)],
  };
}

export function groupPerPhoto(state: GroupingState, selectedIds: string[]): GroupingState {
  const chosen = orderedUnassigned(state, selectedIds);
  if (chosen.length === 0) return state;
  let sequence = nextSequence(state.groups);
  const created = chosen.map((id) => ({
    id: newId(),
    sequence: sequence++,
    photoIds: [id],
    ...blankDetails(),
  }));
  return { photos: state.photos, groups: [...state.groups, ...created] };
}

export function removePhotos(state: GroupingState, photoIds: string[]): GroupingState {
  const drop = new Set(photoIds);
  return {
    photos: state.photos.filter((photo) => !drop.has(photo.id)),
    groups: state.groups.map((group) => ({
      ...group,
      photoIds: group.photoIds.filter((id) => !drop.has(id)),
    })),
  };
}

export function removePhotoFromGroup(
  state: GroupingState,
  groupId: string,
  photoId: string
): GroupingState {
  return {
    photos: state.photos,
    groups: state.groups.map((group) =>
      group.id === groupId
        ? { ...group, photoIds: group.photoIds.filter((id) => id !== photoId) }
        : group
    ),
  };
}

export function dissolveGroup(state: GroupingState, groupId: string): GroupingState {
  return {
    photos: state.photos,
    groups: state.groups.filter((group) => group.id !== groupId),
  };
}

export function addPhotosToGroup(
  state: GroupingState,
  groupId: string,
  selectedIds: string[]
): GroupingState {
  const chosen = orderedUnassigned(state, selectedIds);
  if (chosen.length === 0 || !state.groups.some((group) => group.id === groupId)) return state;
  return {
    photos: state.photos,
    groups: state.groups.map((group) =>
      group.id === groupId ? { ...group, photoIds: [...group.photoIds, ...chosen] } : group
    ),
  };
}

export function createEmptyGroup(state: GroupingState): GroupingState {
  return {
    photos: state.photos,
    groups: [...state.groups, createGroup(state.groups, [])],
  };
}

/** A realization is ready to publish when it still contains at least one image. */
export function isRealizationReady(group: { photoIds: string[] }): boolean {
  return group.photoIds.length > 0;
}

export function descriptionIssue(description: string): "DESCRIPTION_TOO_LONG" | null {
  if (description.length > REALIZATION_DESCRIPTION_MAX) return "DESCRIPTION_TOO_LONG";
  return null;
}

export function completionDateIssue(value: string | null): "DATE_INVALID" | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "DATE_INVALID";
  const [year, month, day] = value.split("-").map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "DATE_INVALID";
  }
  return null;
}

export function updateGroupDetails(
  state: GroupingState,
  groupId: string,
  patch: Partial<RealizationDetails>
): GroupingState {
  return {
    photos: state.photos,
    groups: state.groups.map((group) => {
      if (group.id !== groupId) return group;
      return {
        ...group,
        description: patch.description !== undefined ? patch.description : group.description,
        domainId: patch.domainId !== undefined ? patch.domainId : group.domainId,
        completedOn: patch.completedOn !== undefined ? patch.completedOn : group.completedOn,
      };
    }),
  };
}

export function readReviewContract(ownerKey: string):
  | { status: "empty" }
  | {
      status: "ready";
      reviewPrepared: boolean;
      realizations: Array<RealizationGroup & { ready: boolean }>;
    } {
  const snapshot = getWorkflowSnapshot(ownerKey);
  if (snapshot.status !== "ready") return { status: "empty" };
  return {
    status: "ready",
    reviewPrepared: snapshot.reviewPrepared,
    realizations: snapshot.groups.map((group) => ({
      ...group,
      ready: isRealizationReady(group),
    })),
  };
}

export function replacePhotos(state: GroupingState, photos: PhotoRef[]): GroupingState {
  const keep = new Set(photos.map((photo) => photo.id));
  return {
    photos,
    groups: state.groups.map((group) => ({
      ...group,
      photoIds: group.photoIds.filter((id) => keep.has(id)),
    })),
  };
}

export function subscribeWorkflow(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getWorkflowSnapshot(ownerKey: string): WorkflowView {
  if (!memory || !ownerKey || memory.ownerKey !== ownerKey) return EMPTY;
  return view;
}

export function readImportSelection(ownerKey: string): { id: string; name: string; file: File }[] {
  if (!memory || !ownerKey || memory.ownerKey !== ownerKey) return [];
  return memory.photos.map(({ id, name, file }) => ({ id, name, file }));
}

export function handoffImportSelection(
  ownerKey: string,
  incoming: { id: string; name: string; file: File }[]
): void {
  if (!ownerKey || incoming.length === 0) return;
  if (!memory || memory.ownerKey !== ownerKey) {
    release(memory);
    commit({
      ownerKey,
      photos: incoming.map(storePhoto),
      groups: [],
      reviewPrepared: false,
    });
    return;
  }

  const previous = new Map(memory.photos.map((photo) => [photo.id, photo]));
  const nextIds = new Set(incoming.map((photo) => photo.id));
  for (const photo of memory.photos) {
    if (!nextIds.has(photo.id)) URL.revokeObjectURL(photo.previewUrl);
  }
  const photos = incoming.map((photo) => previous.get(photo.id) ?? storePhoto(photo));
  const grouped = replacePhotos(groupingOf(memory), photos);
  commit({ ownerKey, photos, groups: grouped.groups, reviewPrepared: memory.reviewPrepared });
}

export function updateWorkflowGroupDetails(
  ownerKey: string,
  groupId: string,
  patch: Partial<RealizationDetails>
): void {
  update(ownerKey, (state) => updateGroupDetails(state, groupId, patch));
}

export function prepareReviewHandoff(ownerKey: string): void {
  if (!memory || memory.ownerKey !== ownerKey) return;
  commit({ ...memory, reviewPrepared: true });
}

export type PublicationHandoff = {
  publishedCount: number;
  draftCount: number;
  failedCount: number;
  outcome: "success" | "partial" | "failed";
};

let publicationHandoff: { ownerKey: string; result: PublicationHandoff } | null = null;

/** Counts use isRealizationReady. Optional details do not change them. */
export function reviewSummary(state: GroupingState): {
  realizations: number;
  photos: number;
  ready: number;
  incomplete: number;
} {
  const photoIds = new Set(state.groups.flatMap((group) => group.photoIds));
  const ready = state.groups.filter((group) => isRealizationReady(group)).length;
  return {
    realizations: state.groups.length,
    photos: photoIds.size,
    ready,
    incomplete: state.groups.length - ready,
  };
}

export function rememberPublicationHandoff(ownerKey: string, result: PublicationHandoff): void {
  if (!ownerKey) return;
  publicationHandoff = { ownerKey, result };
}

export function readPublicationHandoff(ownerKey: string): PublicationHandoff | null {
  if (!publicationHandoff || publicationHandoff.ownerKey !== ownerKey) return null;
  return publicationHandoff.result;
}

export function closeWorkflow(ownerKey: string): void {
  if (!memory || memory.ownerKey !== ownerKey) return;
  release(memory);
  memory = null;
  view = EMPTY;
  listeners.forEach((listener) => listener());
}

export function groupSelectedIntoOne(ownerKey: string, selectedIds: string[]): void {
  update(ownerKey, (state) => groupIntoOne(state, selectedIds));
}

export function groupSelectedPerPhoto(ownerKey: string, selectedIds: string[]): void {
  update(ownerKey, (state) => groupPerPhoto(state, selectedIds));
}

export function removeWorkflowPhotos(ownerKey: string, photoIds: string[]): void {
  update(ownerKey, (state) => removePhotos(state, photoIds));
}

export function ungroupWorkflowPhoto(ownerKey: string, groupId: string, photoId: string): void {
  update(ownerKey, (state) => removePhotoFromGroup(state, groupId, photoId));
}

export function dissolveWorkflowGroup(ownerKey: string, groupId: string): void {
  update(ownerKey, (state) => dissolveGroup(state, groupId));
}

export function addSelectedToWorkflowGroup(
  ownerKey: string,
  groupId: string,
  selectedIds: string[]
): void {
  update(ownerKey, (state) => addPhotosToGroup(state, groupId, selectedIds));
}

export function createEmptyWorkflowGroup(ownerKey: string): void {
  update(ownerKey, (state) => createEmptyGroup(state));
}

function orderedUnassigned(state: GroupingState, selectedIds: string[]): string[] {
  const wanted = new Set(selectedIds);
  return unassignedPhotoIds(state).filter((id) => wanted.has(id));
}

function nextSequence(groups: RealizationGroup[]): number {
  return groups.reduce((max, group) => Math.max(max, group.sequence), 0) + 1;
}

function blankDetails(): RealizationDetails {
  return { description: "", domainId: null, completedOn: null };
}

function createGroup(groups: RealizationGroup[], photoIds: string[]): RealizationGroup {
  return { id: newId(), sequence: nextSequence(groups), photoIds, ...blankDetails() };
}

function newId(): string {
  return crypto.randomUUID();
}

function groupingOf(current: Memory): GroupingState {
  return {
    photos: current.photos.map(({ id, name }) => ({ id, name })),
    groups: current.groups,
  };
}

function storePhoto(photo: { id: string; name: string; file: File }): StoredPhoto {
  return { id: photo.id, name: photo.name, file: photo.file, previewUrl: URL.createObjectURL(photo.file) };
}

function update(ownerKey: string, recipe: (state: GroupingState) => GroupingState): void {
  if (!memory || memory.ownerKey !== ownerKey) return;
  const next = recipe(groupingOf(memory));
  const keep = new Set(next.photos.map((photo) => photo.id));
  for (const photo of memory.photos) {
    if (!keep.has(photo.id)) URL.revokeObjectURL(photo.previewUrl);
  }
  commit({
    ownerKey,
    photos: memory.photos.filter((photo) => keep.has(photo.id)),
    groups: next.groups,
    reviewPrepared: memory.reviewPrepared,
  });
}

function commit(next: Memory): void {
  memory = next;
  view = {
    status: "ready",
    ownerKey: next.ownerKey,
    photos: next.photos.map(({ id, name, previewUrl }) => ({ id, name, previewUrl })),
    groups: next.groups,
    reviewPrepared: next.reviewPrepared,
  };
  listeners.forEach((listener) => listener());
}

function release(current: Memory | null): void {
  current?.photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
}
