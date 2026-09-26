const Domain = require("../models/Domain");
const Skill = require("../models/Skill");
const taxonomy = require("../data/contributorTaxonomy.json");

/**
 * Upserts the approved simplified domain/skill dataset.
 * Idempotent. Does not invent values beyond the JSON produced from the approved files.
 */
async function ensureContributorTaxonomy() {
  for (const domain of taxonomy.domains) {
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
}

module.exports = { ensureContributorTaxonomy };
