import assert from "node:assert/strict";
import test from "node:test";
import { parseOwnedProject, projectDraftPayload } from "./projects.ts";

const draft = {
  id: "507f1f77bcf86cd799439011",
  title: "Poulailler",
  summary: "",
  description: "",
  objective: "Nourrir le quartier",
  category: "",
  country: "Cameroun",
  city: "Douala",
  status: "draft",
  visibility: "private",
};

test("parseOwnedProject keeps an incomplete private draft", () => {
  assert.deepEqual(parseOwnedProject(draft), { ...draft, stages: [] });
});

test("parseOwnedProject rejects public payloads that include an owner id", () => {
  assert.equal(parseOwnedProject({ ...draft, ownerId: "secret-owner" }), null);
  assert.equal(parseOwnedProject({ ...draft, status: "archived" }), null);
});

test("projectDraftPayload sends only the editable fields", () => {
  const payload = projectDraftPayload({
    ...draft,
    title: "Atelier",
  });
  assert.deepEqual(Object.keys(payload).sort(), [
    "category",
    "city",
    "country",
    "description",
    "objective",
    "summary",
    "title",
  ]);
  assert.equal(payload.title, "Atelier");
  assert.equal("status" in payload, false);
  assert.equal("ownerId" in payload, false);
});
