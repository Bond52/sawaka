const request = require("supertest");
const app = require("../../index");
const Domain = require("../../models/Domain");
const Skill = require("../../models/Skill");
const { ensureContributorTaxonomy } = require("../../services/contributorTaxonomySeed");
const taxonomy = require("../../data/contributorTaxonomy.json");
const inventory = require("../fixtures/approvedContributorTaxonomyInventory.json");

describe("contributor taxonomy seed and APIs", () => {
  it("seeds the approved taxonomy and returns it from active Domain/Skill APIs", async () => {
    await ensureContributorTaxonomy();

    const domains = await Domain.find({ isActive: true }).sort({ nameFR: 1 });
    const skills = await Skill.find({ isActive: true });
    expect(domains).toHaveLength(inventory.domainCount);
    expect(skills).toHaveLength(inventory.skillCount);

    const listed = await request(app).get("/api/contributors/domains");
    expect(listed.statusCode).toBe(200);
    expect(listed.body.domains).toHaveLength(inventory.domainCount);
    expect(
      listed.body.domains.every((domain) => domain.nameFR && domain.nameEN && domain.id)
    ).toBe(true);

    const construction = domains.find(
      (domain) => domain.nameFR === "Construction et bâtiment"
    );
    expect(construction).toBeTruthy();

    const domainSkills = await request(app).get(
      `/api/contributors/domains/${construction._id}/skills`
    );
    expect(domainSkills.statusCode).toBe(200);
    expect(domainSkills.body.skills).toHaveLength(
      taxonomy.domains.find((domain) => domain.slug === construction.slug).skills.length
    );
    expect(
      domainSkills.body.skills.some(
        (skill) => skill.nameFR === "Maçonnerie" && skill.nameEN === "Masonry"
      )
    ).toBe(true);
  });

  it("soft-deactivates obsolete taxonomy rows without deleting their documents", async () => {
    await ensureContributorTaxonomy();

    const obsoleteDomain = await Domain.create({
      slug: "obsolete-domain",
      nameFR: "Obsolète",
      nameEN: "Obsolete",
      isActive: true,
    });
    const obsoleteSkill = await Skill.create({
      slug: "obsolete-skill",
      domainId: obsoleteDomain._id,
      nameFR: "Compétence obsolète",
      nameEN: "Obsolete skill",
      isActive: true,
    });

    await ensureContributorTaxonomy();

    const domainAfter = await Domain.findById(obsoleteDomain._id);
    const skillAfter = await Skill.findById(obsoleteSkill._id);
    expect(domainAfter).toBeTruthy();
    expect(skillAfter).toBeTruthy();
    expect(domainAfter.isActive).toBe(false);
    expect(skillAfter.isActive).toBe(false);

    const listed = await request(app).get("/api/contributors/domains");
    expect(listed.body.domains.some((domain) => domain.nameEN === "Obsolete")).toBe(
      false
    );
  });

  it("preserves stable slugs across reseeds so ContributorProfile IDs stay valid", async () => {
    await ensureContributorTaxonomy();
    const before = await Domain.findOne({ slug: "construction-and-building" });
    const beforeSkill = await Skill.findOne({
      slug: "construction-and-building-masonry",
    });
    expect(before).toBeTruthy();
    expect(beforeSkill).toBeTruthy();

    await ensureContributorTaxonomy();

    const after = await Domain.findOne({ slug: "construction-and-building" });
    const afterSkill = await Skill.findOne({
      slug: "construction-and-building-masonry",
    });
    expect(String(after._id)).toBe(String(before._id));
    expect(String(afterSkill._id)).toBe(String(beforeSkill._id));
    expect(after.nameFR).toBe("Construction et bâtiment");
    expect(afterSkill.nameFR).toBe("Maçonnerie");
    expect(afterSkill.nameEN).toBe("Masonry");
  });
});
