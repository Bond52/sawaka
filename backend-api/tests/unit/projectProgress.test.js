const { projectProgress } = require("../../services/projectService");

describe("project progress", () => {
  it("gives every eligible stage the same weight and ignores cancelled stages", () => {
    expect(
      projectProgress([
        { status: "completed" },
        { status: "not_started" },
        { status: "cancelled" },
        { status: "blocked" },
      ])
    ).toEqual({ available: true, percent: 33 });
  });

  it("is unavailable when every stage is cancelled or missing", () => {
    expect(projectProgress([])).toEqual({ available: false, percent: null });
    expect(projectProgress([{ status: "cancelled" }, { status: "cancelled" }])).toEqual({
      available: false,
      percent: null,
    });
  });

  it("counts only completed stages in the numerator", () => {
    expect(
      projectProgress([
        { status: "completed" },
        { status: "in_progress" },
        { status: "completed" },
        { status: "blocked" },
      ])
    ).toEqual({ available: true, percent: 50 });
  });
});
