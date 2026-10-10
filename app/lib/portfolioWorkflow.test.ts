import assert from "node:assert/strict";
import test from "node:test";
import {
  addPhotosToGroup,
  completionDateIssue,
  createEmptyGroup,
  descriptionIssue,
  dissolveGroup,
  getWorkflowSnapshot,
  groupIntoOne,
  groupPerPhoto,
  groupSelectedIntoOne,
  handoffImportSelection,
  isRealizationReady,
  prepareReviewHandoff,
  readImportSelection,
  readReviewContract,
  removePhotoFromGroup,
  removePhotos,
  replacePhotos,
  unassignedPhotoIds,
  updateGroupDetails,
  type GroupingState,
} from "./portfolioWorkflow.ts";

const photos = [
  { id: "a", name: "a.jpg" },
  { id: "b", name: "b.jpg" },
  { id: "c", name: "c.jpg" },
  { id: "d", name: "d.jpg" },
];

function state(): GroupingState {
  return { photos, groups: [] };
}

test("several photos become one realization", () => {
  const next = groupIntoOne(state(), ["d", "a", "b"]);
  assert.equal(next.groups.length, 1);
  assert.deepEqual(next.groups[0].photoIds, ["a", "b", "d"]);
  assert.deepEqual(unassignedPhotoIds(next), ["c"]);
});

test("one realization per photo creates one group each", () => {
  const next = groupPerPhoto(state(), ["b", "d"]);
  assert.equal(next.groups.length, 2);
  assert.deepEqual(
    next.groups.map((group) => group.photoIds),
    [["b"], ["d"]]
  );
  assert.deepEqual(unassignedPhotoIds(next), ["a", "c"]);
});

test("a single photo can still be its own realization", () => {
  const next = groupIntoOne(state(), ["c"]);
  assert.equal(next.groups.length, 1);
  assert.deepEqual(next.groups[0].photoIds, ["c"]);
});

test("removing a photo from a group returns it to the unassigned list", () => {
  const grouped = groupIntoOne(state(), ["a", "b", "c"]);
  const next = removePhotoFromGroup(grouped, grouped.groups[0].id, "b");
  assert.deepEqual(next.groups[0].photoIds, ["a", "c"]);
  assert.deepEqual(unassignedPhotoIds(next), ["b", "d"]);
});

test("dissolving a group keeps every photo", () => {
  const grouped = groupIntoOne(state(), ["a", "b"]);
  const next = dissolveGroup(grouped, grouped.groups[0].id);
  assert.equal(next.groups.length, 0);
  assert.deepEqual(
    next.photos.map((photo) => photo.id),
    ["a", "b", "c", "d"]
  );
  assert.equal(unassignedPhotoIds(next).length, 4);
});

test("removing an ungrouped photo drops it from the workflow", () => {
  const next = removePhotos(state(), ["b"]);
  assert.deepEqual(
    next.photos.map((photo) => photo.id),
    ["a", "c", "d"]
  );
});

test("an unassigned photo can be added to an existing group", () => {
  const grouped = groupIntoOne(state(), ["a"]);
  const next = addPhotosToGroup(grouped, grouped.groups[0].id, ["c", "b"]);
  assert.deepEqual(next.groups[0].photoIds, ["a", "b", "c"]);
  assert.deepEqual(unassignedPhotoIds(next), ["d"]);
});

test("replacing the import selection keeps groups for photos that remain", () => {
  const grouped = groupPerPhoto(state(), ["a", "b", "c"]);
  const next = replacePhotos(grouped, [photos[0], photos[2], { id: "e", name: "e.jpg" }]);
  assert.deepEqual(
    next.groups.map((group) => group.photoIds),
    [["a"], [], ["c"]]
  );
  assert.deepEqual(unassignedPhotoIds(next), ["e"]);
});

test("group numbers stay stable when an earlier group is dissolved", () => {
  const first = groupIntoOne(state(), ["a"]);
  const second = groupIntoOne(first, ["b"]);
  const next = dissolveGroup(second, second.groups[0].id);
  assert.equal(next.groups.length, 1);
  assert.equal(next.groups[0].sequence, 2);
});

test("another signed-in user cannot read the in-memory workflow", () => {
  const urlApi = URL as URL & {
    createObjectURL: (blob: Blob) => string;
    revokeObjectURL: (url: string) => void;
  };
  urlApi.createObjectURL = () => "blob:http://localhost/photo";
  urlApi.revokeObjectURL = () => {};
  const file = new File([new Uint8Array([1, 2, 3])], "a.jpg", { type: "image/jpeg" });
  handoffImportSelection("amina", [{ id: "a", name: "a.jpg", file }]);
  const own = getWorkflowSnapshot("amina");
  assert.equal(own.status, "ready");
  if (own.status === "ready") {
    assert.equal(own.photos.length, 1);
    assert.equal(own.photos[0].previewUrl.startsWith("blob:"), true);
  }
  assert.equal(getWorkflowSnapshot("other").status, "empty");
  assert.equal(readImportSelection("other").length, 0);
});

test("a grouped realization is ready even when optional details are empty", () => {
  const next = groupIntoOne(state(), ["a", "b"]);
  assert.equal(isRealizationReady(next.groups[0]), true);
  assert.equal(next.groups[0].description, "");
  assert.equal(next.groups[0].domainId, null);
  assert.equal(next.groups[0].completedOn, null);
  assert.equal(descriptionIssue(""), null);
  assert.equal(completionDateIssue(null), null);
});

test("a realization without an image is incomplete", () => {
  const next = createEmptyGroup(state());
  assert.equal(isRealizationReady(next.groups[0]), false);
});

test("editing one realization keeps the details of the others", () => {
  const grouped = groupPerPhoto(state(), ["a", "b"]);
  const first = updateGroupDetails(grouped, grouped.groups[0].id, {
    description: "Chair",
    domainId: "wood",
    completedOn: "2024-05-01",
  });
  const second = updateGroupDetails(first, first.groups[1].id, { description: "Gate" });
  assert.equal(second.groups[0].description, "Chair");
  assert.equal(second.groups[0].domainId, "wood");
  assert.equal(second.groups[0].completedOn, "2024-05-01");
  assert.equal(second.groups[1].description, "Gate");
  assert.deepEqual(second.groups[0].photoIds, ["a"]);
  assert.equal(descriptionIssue("x".repeat(2001)), "DESCRIPTION_TOO_LONG");
  assert.equal(completionDateIssue("2024-02-31"), "DATE_INVALID");
});

test("the review contract reports readiness without publishing", () => {
  const urlApi = URL as URL & {
    createObjectURL: (blob: Blob) => string;
    revokeObjectURL: (url: string) => void;
  };
  urlApi.createObjectURL = () => "blob:http://localhost/photo";
  urlApi.revokeObjectURL = () => {};
  const file = new File([new Uint8Array([1, 2, 3])], "a.jpg", { type: "image/jpeg" });
  handoffImportSelection("review-owner", [{ id: "a", name: "a.jpg", file }]);
  groupSelectedIntoOne("review-owner", ["a"]);
  const before = readReviewContract("review-owner");
  assert.equal(before.status, "ready");
  if (before.status === "ready") {
    assert.equal(before.reviewPrepared, false);
    assert.equal(before.realizations.length, 1);
    assert.equal(before.realizations[0].ready, true);
    assert.deepEqual(before.realizations[0].photoIds, ["a"]);
  }
  prepareReviewHandoff("review-owner");
  const after = readReviewContract("review-owner");
  assert.equal(after.status, "ready");
  if (after.status === "ready") assert.equal(after.reviewPrepared, true);
  assert.equal(readReviewContract("someone-else").status, "empty");
});

test("an empty group can be created without assigning photos", () => {
  const next = createEmptyGroup(state());
  assert.equal(next.groups.length, 1);
  assert.deepEqual(next.groups[0].photoIds, []);
  assert.equal(unassignedPhotoIds(next).length, 4);
});
