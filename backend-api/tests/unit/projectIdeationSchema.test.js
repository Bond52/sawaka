const {
  parseCriteria,
  validateGenerationPayload,
  mockGenerateIdeas,
  ideaToProjectDraftPayload,
  IdeationError,
} = require("../../services/projectIdeationSchema");

describe("projectIdeationSchema", () => {
  it("requires at least one of interests, objective, or skills", () => {
    expect(() => parseCriteria({})).toThrow(IdeationError);
  });

  it("rejects unknown categories and currencies", () => {
    expect(() =>
      parseCriteria({ interests: "farming", category: "not-a-domain" })
    ).toThrow(/INVALID_CATEGORY/);
    expect(() =>
      parseCriteria({ interests: "farming", budgetAmount: 100, budgetCurrency: "BTC" })
    ).toThrow(/INVALID_CURRENCY/);
  });

  it("rejects hallucinated contributor and supplier IDs", () => {
    const criteria = parseCriteria({ interests: "jardin", skills: "agriculture", limit: 1 });
    const candidates = {
      contributors: [{ id: "c1", kind: "contributor", label: "Amina", detail: "", location: "", href: "/c/1" }],
      suppliers: [{ id: "s1", kind: "supplier", label: "Agro", detail: "", location: "", href: "/s/1" }],
    };
    const ideas = validateGenerationPayload(
      {
        ideas: [
          {
            title: "Jardin",
            stages: [
              {
                title: "Start",
                needs: [
                  {
                    title: "Help",
                    kind: "skill",
                    matchedContributorIds: ["c1", "fake-user"],
                    matchedSupplierIds: ["ghost", "s1"],
                    missingCapabilities: ["irrigation specialist"],
                  },
                ],
              },
            ],
          },
        ],
      },
      criteria,
      candidates
    );
    const need = ideas[0].stages[0].needs[0];
    expect(need.matchedContributors.map((m) => m.id)).toEqual(["c1"]);
    expect(need.matchedSuppliers.map((m) => m.id)).toEqual(["s1"]);
  });

  it("mock generation keeps stage/need hierarchy and maps to unpublished draft payload", () => {
    const criteria = parseCriteria({
      interests: "couture",
      country: "CM",
      city: "Douala",
      limit: 2,
    });
    const candidates = {
      contributors: [],
      suppliers: [],
    };
    const payload = mockGenerateIdeas(criteria, candidates);
    const ideas = validateGenerationPayload(payload, criteria, candidates);
    expect(ideas).toHaveLength(2);
    expect(ideas[0].stages.length).toBeGreaterThan(0);
    ideas[0].stages.forEach((stage) => {
      expect(stage.title).toBeTruthy();
      stage.needs.forEach((need) => {
        expect(["skill", "service", "resource", "assistance"]).toContain(need.kind);
      });
    });
    const draft = ideaToProjectDraftPayload(ideas[0]);
    expect(draft.publish).toBe(false);
    expect(draft.title).toBe(ideas[0].title);
    expect(draft.stages[0].needs[0].status).toBe("open");
  });
});
