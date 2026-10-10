/**
 * In-memory handoff from photo selection (#436) to grouping (#437).
 *
 * Files stay in this browser tab. Nothing is uploaded, stored, or published.
 * A refresh clears the module, and another signed-in user cannot read it.
 * The snapshot is the contract the future metadata step can read.
 * That step is not implemented here.
 */

export type PhotoRef = { id: string; name: string };

export type RealizationGroup = {
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
    };

type StoredPhoto = WorkflowPhotoView & { file: File };

type Memory = {
  ownerKey: string;
  photos: StoredPhoto[];
  groups: RealizationGroup[];
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
  commit({ ownerKey, photos, groups: grouped.groups });
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

function createGroup(groups: RealizationGroup[], photoIds: string[]): RealizationGroup {
  return { id: newId(), sequence: nextSequence(groups), photoIds };
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
  });
}

function commit(next: Memory): void {
  memory = next;
  view = {
    status: "ready",
    ownerKey: next.ownerKey,
    photos: next.photos.map(({ id, name, previewUrl }) => ({ id, name, previewUrl })),
    groups: next.groups,
  };
  listeners.forEach((listener) => listener());
}

function release(current: Memory | null): void {
  current?.photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
}
