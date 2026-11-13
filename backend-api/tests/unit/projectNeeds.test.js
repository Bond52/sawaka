const { ProjectError, finalizeNeed, requireParentStage, needChanges } = require("../../services/projectService");

describe("project needs", () => {
  it("requires a blocker explanation and clears it when the status changes", () => {
    expect(() =>
      finalizeNeed(
        { status: "open", blockerExplanation: "", title: "Grillage", kind: "resource" },
        { status: "blocked", blockerExplanation: "   " }
      )
    ).toThrow(ProjectError);

    const blocked = finalizeNeed(
      { status: "open", blockerExplanation: "", title: "Grillage", kind: "resource", description: "" },
      { status: "blocked", blockerExplanation: "Le grillage manque." }
    );
    expect(blocked).toMatchObject({
      status: "blocked",
      blockerExplanation: "Le grillage manque.",
    });

    expect(finalizeNeed(blocked, { status: "fulfilled" })).toMatchObject({
      status: "fulfilled",
      blockerExplanation: "",
    });
  });

  it("rejects a need when the stage is missing or belongs to another project", () => {
    const stages = [{ _id: "aaaaaaaaaaaaaaaaaaaaaaaa", needs: [] }];
    expect(requireParentStage(stages, "aaaaaaaaaaaaaaaaaaaaaaaa")._id).toBe(
      "aaaaaaaaaaaaaaaaaaaaaaaa"
    );
    expect(() => requireParentStage(stages, "bbbbbbbbbbbbbbbbbbbbbbbb")).toThrow(ProjectError);
    expect(() => requireParentStage(stages, "")).toThrow(ProjectError);
    try {
      requireParentStage(stages, "bbbbbbbbbbbbbbbbbbbbbbbb");
    } catch (err) {
      expect(err.code).toBe("STAGE_NOT_FOUND");
    }
  });

  it("does not accept ownership or a resolved status", () => {
    expect(() => needChanges({ title: "Aide", kind: "assistance", ownerId: "hidden" }, true)).toThrow(
      ProjectError
    );
    expect(() => needChanges({ title: "Aide", kind: "assistance", status: "resolved" }, true)).toThrow(
      ProjectError
    );
  });
});
