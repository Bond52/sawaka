const taxonomy = require("../../data/contributorTaxonomy.json");
const inventory = require("../fixtures/approvedContributorTaxonomyInventory.json");

describe("contributorTaxonomy.json (approved Excel inventory)", () => {
  it("matches the approved Excel domain and skill counts", () => {
    expect(taxonomy.domains).toHaveLength(inventory.domainCount);
    const skillCount = taxonomy.domains.reduce(
      (sum, domain) => sum + domain.skills.length,
      0
    );
    expect(skillCount).toBe(inventory.skillCount);
    expect(inventory.skillCount).toBe(133);
    expect(inventory.domainCount).toBe(14);
  });

  it("has unique domain and skill slugs", () => {
    const domainSlugs = taxonomy.domains.map((domain) => domain.slug);
    const skillSlugs = taxonomy.domains.flatMap((domain) =>
      domain.skills.map((skill) => skill.slug)
    );
    expect(new Set(domainSlugs).size).toBe(domainSlugs.length);
    expect(new Set(skillSlugs).size).toBe(skillSlugs.length);
  });

  it("preserves Domain FR and Skill FR/EN labels from the approved workbook", () => {
    const byDomain = new Map();
    for (const domain of taxonomy.domains) {
      byDomain.set(
        domain.nameFR,
        domain.skills.map((skill) => [skill.nameFR, skill.nameEN])
      );
    }

    const excelByDomain = new Map();
    for (const row of inventory.rows) {
      if (!excelByDomain.has(row.domainFR)) {
        excelByDomain.set(row.domainFR, []);
      }
      excelByDomain.get(row.domainFR).push([row.nameFR, row.nameEN]);
    }

    expect([...byDomain.keys()].sort()).toEqual([...excelByDomain.keys()].sort());

    for (const [domainFR, excelSkills] of excelByDomain) {
      expect(byDomain.get(domainFR)).toEqual(excelSkills);
    }
  });

  it("keeps Domain EN labels for API localization without inventing Skill translations", () => {
    for (const domain of taxonomy.domains) {
      expect(domain.nameEN).toBeTruthy();
      expect(domain.nameFR).toBeTruthy();
      expect(domain.isActive).toBe(true);
      for (const skill of domain.skills) {
        expect(skill.nameFR).toBeTruthy();
        expect(skill.nameEN).toBeTruthy();
        expect(skill.isActive).toBe(true);
      }
    }
  });

  it("documents the Excel workbook as the taxonomy source", () => {
    expect(taxonomy.source).toContain("Sawaka_Simplified_Domain_Skills.xlsx");
    expect(taxonomy.source).toMatch(/Domaines - Tags par defaut/i);
  });
});
