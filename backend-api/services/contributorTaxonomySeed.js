const Domain = require("../models/Domain");
const Skill = require("../models/Skill");
const taxonomy = require("../data/contributorTaxonomy.json");

/**
 * Upserts the approved simplified domain/skill dataset.
 * Idempotent. Does not invent values beyond the JSON produced from the approved files.
 * Soft-deactivates Domains/Skills whose slugs are no longer in the approved set so
 * existing ContributorProfile ObjectId references are not silently deleted.
 */
async function ensureContributorTaxonomy() {
  const approvedDomainSlugs = [];
  const approvedSkillSlugs = [];

  for (const domain of taxonomy.domains) {
    approvedDomainSlugs.push(domain.slug);
    const domainDoc = await Domain.findOneAndUpdate(
      { slug: domain.slug },
      {
        slug: domain.slug,
        nameFR: domain.nameFR,
        nameEN: domain.nameEN,
        isActive: domain.isActive !== false,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    for (const skill of domain.skills) {
      approvedSkillSlugs.push(skill.slug);
      await Skill.findOneAndUpdate(
        { slug: skill.slug },
        {
          slug: skill.slug,
          domainId: domainDoc._id,
          nameFR: skill.nameFR,
          nameEN: skill.nameEN,
          isActive: skill.isActive !== false,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  }

  await Domain.updateMany(
    { slug: { $nin: approvedDomainSlugs } },
    { $set: { isActive: false } }
  );
  await Skill.updateMany(
    { slug: { $nin: approvedSkillSlugs } },
    { $set: { isActive: false } }
  );
}

module.exports = { ensureContributorTaxonomy };
