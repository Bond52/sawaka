const {
  parsePublicDirectoryQuery,
  textRegex,
  foldAccents,
} = require("../../services/projectDirectoryQuery");

describe("projectDirectoryQuery", () => {
  it("folds accents for case-insensitive matching", () => {
    expect(foldAccents("Café")).toBe("cafe");
    expect(textRegex("Douala").test("douala")).toBe(true);
    expect(textRegex("cafe").test("Café")).toBe(true);
  });

  it("builds keyword, category, country and city filters", () => {
    const { filter, page, limit } = parsePublicDirectoryQuery({
      q: "jardin",
      category: "agriculture-livestock-and-agro-processing",
      country: "Cameroon",
      city: "Douala",
      page: "2",
      limit: "10",
    });
    expect(page).toBe(2);
    expect(limit).toBe(10);
    expect(filter.category).toBe("agriculture-livestock-and-agro-processing");
    expect(filter.country).toBe("CM");
    expect(filter.city).toBeInstanceOf(RegExp);
    expect(filter.$and).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          $or: expect.any(Array),
        }),
      ])
    );
  });

  it("combines need kind and status into an elemMatch", () => {
    const { filter } = parsePublicDirectoryQuery({
      needKind: "skill",
      needStatus: "open",
      stageStatus: "in_progress",
    });
    expect(filter.$and).toEqual(
      expect.arrayContaining([
        { "stages.status": "in_progress" },
        {
          stages: {
            $elemMatch: {
              needs: { $elemMatch: { kind: "skill", status: "open" } },
            },
          },
        },
      ])
    );
  });

  it("rejects unknown query keys and invalid values", () => {
    expect(() => parsePublicDirectoryQuery({ draft: "1" })).toThrow();
    expect(() => parsePublicDirectoryQuery({ category: "Unknown" })).toThrow();
    expect(() => parsePublicDirectoryQuery({ country: "XX" })).toThrow();
    expect(() => parsePublicDirectoryQuery({ needKind: "money" })).toThrow();
    expect(() => parsePublicDirectoryQuery({ page: "0" })).toThrow();
  });
});
