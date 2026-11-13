import assert from "node:assert/strict";
import test from "node:test";
import { parseOwnedProject, projectDraftPayload, projectProgress } from "./projects.ts";

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

test("parseOwnedProject keeps a need on its stage and rejects a resolved status", () => {
  const stage = {
    id: "stage-1",
    title: "Préparer",
    description: "",
    position: 0,
    status: "not_started",
    blockerExplanation: "",
    needs: [
      {
        id: "need-1",
        title: "Grillage",
        description: "",
        kind: "resource",
        status: "open",
        blockerExplanation: "",
      },
    ],
  };
  const parsed = parseOwnedProject({ ...draft, stages: [stage] });
  assert.equal(parsed?.stages[0].needs[0].kind, "resource");
  assert.equal(
    parseOwnedProject({
      ...draft,
      stages: [{ ...stage, needs: [{ ...stage.needs[0], status: "resolved" }] }],
    }),
    null
  );
});

test("projectProgress ignores cancelled stages and is unavailable without eligible stages", () => {
  assert.deepEqual(
    projectProgress([
      { status: "completed" },
      { status: "in_progress" },
      { status: "cancelled" },
    ]),
    { available: true, percent: 50 }
  );
  assert.deepEqual(projectProgress([{ status: "cancelled" }]), {
    available: false,
    percent: null,
  });
});
