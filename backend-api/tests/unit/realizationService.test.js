const {
  isReadyToPublish,
  metadataIssue,
  summarizeCommit,
} = require("../../services/realizationService");

describe("realization readiness", () => {
  it("is ready only when at least one image is present", () => {
    expect(isReadyToPublish([])).toBe(false);
    expect(isReadyToPublish(null)).toBe(false);
    expect(isReadyToPublish([{ url: "https://res.cloudinary.com/demo/a.jpg" }])).toBe(true);
  });

  it("treats description, category, and date as optional", () => {
    expect(
      metadataIssue({ description: "", completedOn: null })
    ).toBeNull();
    expect(metadataIssue({ description: "x".repeat(2001), completedOn: null })).toBe(
      "DESCRIPTION_TOO_LONG"
    );
    expect(metadataIssue({ description: "", completedOn: "2024-02-31" })).toBe("DATE_INVALID");
  });

  it("does not call a partial batch a full success", () => {
    expect(
      summarizeCommit([
        { status: "published" },
        { status: "draft" },
        { status: "failed" },
      ]).outcome
    ).toBe("partial");
    expect(summarizeCommit([{ status: "failed" }]).outcome).toBe("failed");
    expect(
      summarizeCommit([{ status: "published" }, { status: "draft" }])
    ).toEqual({
      outcome: "success",
      publishedCount: 1,
      draftCount: 1,
      failedCount: 0,
      items: [{ status: "published" }, { status: "draft" }],
    });
  });
});
