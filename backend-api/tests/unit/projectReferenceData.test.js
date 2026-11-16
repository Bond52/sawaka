const {
  isApprovedProjectCategory,
  isApprovedProjectCountry,
  normalizeProjectCountry,
  PROJECT_CATEGORY_VALUES,
  PROJECT_COUNTRY_VALUES,
} = require("../../services/projectReferenceData");
const { editableProjectUpdate, ProjectError } = require("../../services/projectService");

describe("project reference data", () => {
  it("reuses domain slugs and rejects supplier category ids", () => {
    expect(PROJECT_CATEGORY_VALUES).toContain("agriculture-livestock-and-agro-processing");
    expect(isApprovedProjectCategory("agriculture-livestock-and-agro-processing")).toBe(true);
    expect(isApprovedProjectCategory("construction_materials")).toBe(false);
    expect(isApprovedProjectCategory("Agriculture")).toBe(false);
  });

  it("normalizes supported countries and keeps Congo labels unambiguous", () => {
    expect(PROJECT_COUNTRY_VALUES).toEqual(expect.arrayContaining(["CM", "CG", "CA"]));
    expect(normalizeProjectCountry("Cameroun")).toBe("CM");
    expect(normalizeProjectCountry("Republic of the Congo")).toBe("CG");
    expect(normalizeProjectCountry("Congo")).toBeNull();
    expect(isApprovedProjectCountry("Democratic Republic of the Congo")).toBe(false);
  });

  it("accepts approved selectors and preserves legacy free-text on update", () => {
    const created = editableProjectUpdate({
      title: "Atelier",
      category: "agriculture-livestock-and-agro-processing",
      country: "Cameroun",
      city: " Douala ",
    });
    expect(created.category).toBe("agriculture-livestock-and-agro-processing");
    expect(created.country).toBe("CM");
    expect(created.city).toBe("Douala");

    const legacy = editableProjectUpdate(
      {
        category: "Agriculture",
        country: "Senegal",
        city: "Dakar",
      },
      { category: "Agriculture", country: "Senegal" }
    );
    expect(legacy.category).toBe("Agriculture");
    expect(legacy.country).toBe("Senegal");

    expect(() =>
      editableProjectUpdate({ category: "Agriculture" }, { category: "Craft" })
    ).toThrow(ProjectError);
    expect(() => editableProjectUpdate({ country: "Senegal" }, {})).toThrow(ProjectError);
  });
});
