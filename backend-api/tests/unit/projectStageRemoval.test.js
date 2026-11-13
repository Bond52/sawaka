const { ProjectError, assertStageRemovable } = require("../../services/projectService");

describe("stage removal", () => {
  it("rejects a stage that still contains a need", () => {
    expect(() => assertStageRemovable({ needs: [{ title: "Grillage" }] })).toThrow(ProjectError);
    try {
      assertStageRemovable({ needs: [{ title: "Grillage" }] });
    } catch (err) {
      expect(err.code).toBe("STAGE_HAS_NEEDS");
      expect(err.status).toBe(409);
    }
    expect(() => assertStageRemovable({ needs: [] })).not.toThrow();
  });
});
