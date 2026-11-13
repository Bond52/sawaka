import assert from "node:assert/strict";
import test from "node:test";
import {
  missingPublicationFields,
  parseOwnedProject,
  pendingContentIssue,
  pendingStagesPayload,
  projectDraftPayload,
  projectProgress,
  type PendingStage,
} from "./projects.ts";

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
  assert.deepEqual(parseOwnedProject(draft), {
    ...draft,
    stages: [],
    coverImage: null,
    images: [],
  });
  assert.equal(
    parseOwnedProject({
      ...draft,
      coverImage: { id: "img", url: "https://res.cloudinary.com/demo/a.jpg", publicId: "secret" },
    }),
    null
  );
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

test("publication requires the approved fields and keeps summary optional", () => {
  assert.deepEqual(
    missingPublicationFields({
      title: " ",
      summary: "",
      description: "Un lieu partagé",
      objective: "",
      category: "Agriculture",
      country: "",
      city: "Dakar",
    }),
    ["title", "objective", "country"]
  );
});

test("pending stages keep their needs and omit client identifiers", () => {
  const stages: PendingStage[] = [
    {
      id: "local-1",
      title: " Préparer ",
      description: "Réunir le matériel",
      status: "in_progress",
      blockerExplanation: "",
      needs: [
        {
          id: "local-need",
          title: "Conseil",
          description: "",
          kind: "skill",
          status: "blocked",
          blockerExplanation: " En attente ",
        },
      ],
    },
  ];
  assert.deepEqual(pendingStagesPayload(stages), [
    {
      title: "Préparer",
      description: "Réunir le matériel",
      status: "in_progress",
      blockerExplanation: "",
      needs: [
        {
          title: "Conseil",
          description: "",
          kind: "skill",
          status: "blocked",
          blockerExplanation: "En attente",
        },
      ],
    },
  ]);
  assert.equal(pendingContentIssue([{ ...stages[0], title: " " }]), "STAGE_TITLE_REQUIRED");
  assert.equal(
    pendingContentIssue([
      {
        ...stages[0],
        needs: [{ ...stages[0].needs[0], blockerExplanation: " " }],
      },
    ]),
    "BLOCKER_EXPLANATION_REQUIRED"
  );
});
