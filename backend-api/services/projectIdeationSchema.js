const {
  isApprovedProjectCategory,
  normalizeProjectCountry,
} = require("./projectReferenceData");
const { NEED_KINDS } = require("../models/ProjectIdea");
const { candidateMaps, resolveVerifiedMatches } = require("./projectIdeationMatching");

const TEXT_MAX = 2000;
const TITLE_MAX = 160;
const IDEA_LIMIT_DEFAULT = 3;
const IDEA_LIMIT_MAX = 5;
const STAGE_MAX = 6;
const NEED_MAX = 6;
const SUPPORTED_CURRENCIES = new Set(["XAF", "CAD", "USD", "EUR"]);

class IdeationError extends Error {
  constructor(code, status = 400, extra = {}) {
    super(code);
    this.name = "IdeationError";
    this.code = code;
    this.status = status;
    this.fields = extra.fields;
    this.details = extra.details;
  }
}

function clip(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function sanitizeUserText(value, max = TEXT_MAX) {
  // Strip control chars and obvious markup to reduce prompt injection / XSS surface.
  return clip(String(value || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ""), max)
    .replace(/<\/?[a-z][^>]*>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCriteria(body = {}) {
  const fields = {};
  const interests = sanitizeUserText(body.interests, 500);
  const objective = sanitizeUserText(body.objective || body.objectives, 500);
  const skills = sanitizeUserText(body.skills, 500);
  const resources = sanitizeUserText(body.resources, 500);
  const constraints = sanitizeUserText(body.constraints, 500);
  const city = sanitizeUserText(body.city, 120);
  const categoryRaw = typeof body.category === "string" ? body.category.trim() : "";
  const countryRaw = typeof body.country === "string" ? body.country.trim() : "";
  const locale = body.locale === "en" ? "en" : "fr";

  if (!interests && !objective && !skills) {
    throw new IdeationError("CRITERIA_REQUIRED", 400, {
      fields: ["interests", "objective", "skills"],
    });
  }

  let category = "";
  if (categoryRaw) {
    if (!isApprovedProjectCategory(categoryRaw)) {
      throw new IdeationError("INVALID_CATEGORY", 400, { fields: ["category"] });
    }
    category = categoryRaw;
  }

  let country = "";
  if (countryRaw) {
    const normalized = normalizeProjectCountry(countryRaw);
    if (!normalized) {
      throw new IdeationError("INVALID_COUNTRY", 400, { fields: ["country"] });
    }
    country = normalized;
  }

  let budgetAmount = null;
  if (body.budgetAmount !== undefined && body.budgetAmount !== null && body.budgetAmount !== "") {
    const amount = Number(body.budgetAmount);
    if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000) {
      throw new IdeationError("INVALID_BUDGET", 400, { fields: ["budgetAmount"] });
    }
    budgetAmount = amount;
  }

  let budgetCurrency = "";
  if (body.budgetCurrency) {
    const currency = String(body.budgetCurrency).trim().toUpperCase();
    if (!SUPPORTED_CURRENCIES.has(currency)) {
      throw new IdeationError("INVALID_CURRENCY", 400, { fields: ["budgetCurrency"] });
    }
    budgetCurrency = currency;
  }
  if (budgetAmount !== null && !budgetCurrency) {
    budgetCurrency = country === "CA" ? "CAD" : "XAF";
  }

  let limit = Number(body.limit || IDEA_LIMIT_DEFAULT);
  if (!Number.isInteger(limit) || limit < 1) limit = IDEA_LIMIT_DEFAULT;
  if (limit > IDEA_LIMIT_MAX) limit = IDEA_LIMIT_MAX;

  return {
    interests,
    objective,
    category,
    skills,
    country,
    city,
    budgetAmount,
    budgetCurrency,
    resources,
    constraints,
    locale,
    limit,
    refineInstruction: sanitizeUserText(body.refineInstruction, 800),
    focusTitle: sanitizeUserText(body.focusTitle, TITLE_MAX),
  };
}

function asNeedKind(value) {
  const kind = typeof value === "string" ? value.trim().toLowerCase() : "";
  return NEED_KINDS.includes(kind) ? kind : "assistance";
}

function normalizeIdea(raw, criteria, maps) {
  if (!raw || typeof raw !== "object") return null;
  const title = sanitizeUserText(raw.title, TITLE_MAX);
  if (!title) return null;

  const stagesIn = Array.isArray(raw.stages) ? raw.stages.slice(0, STAGE_MAX) : [];
  const stages = [];
  stagesIn.forEach((stage, index) => {
    if (!stage || typeof stage !== "object") return;
    const stageTitle = sanitizeUserText(stage.title, TITLE_MAX);
    if (!stageTitle) return;
    const needsIn = Array.isArray(stage.needs) ? stage.needs.slice(0, NEED_MAX) : [];
    const needs = needsIn
      .map((need) => {
        if (!need || typeof need !== "object") return null;
        const needTitle = sanitizeUserText(need.title, TITLE_MAX);
        if (!needTitle) return null;
        const matchedContributors = resolveVerifiedMatches(
          need.matchedContributorIds || need.matchedContributors,
          maps.contributors
        );
        const matchedSuppliers = resolveVerifiedMatches(
          need.matchedSupplierIds || need.matchedSuppliers,
          maps.suppliers
        );
        const missing = Array.isArray(need.missingCapabilities)
          ? need.missingCapabilities
              .map((item) => sanitizeUserText(item, 160))
              .filter(Boolean)
              .slice(0, 8)
          : [];
        return {
          title: needTitle,
          description: sanitizeUserText(need.description, TEXT_MAX),
          kind: asNeedKind(need.kind || need.type),
          domainOrSkills: sanitizeUserText(need.domainOrSkills || need.skills, 300),
          geographicNote: sanitizeUserText(need.geographicNote, 200),
          matchedContributors,
          matchedSuppliers,
          missingCapabilities: missing,
        };
      })
      .filter(Boolean);

    stages.push({
      title: stageTitle,
      description: sanitizeUserText(stage.description, TEXT_MAX),
      position: index,
      needs,
    });
  });

  if (stages.length === 0) return null;

  let category = criteria.category || "";
  if (raw.category && isApprovedProjectCategory(String(raw.category).trim())) {
    category = String(raw.category).trim();
  }

  let country = criteria.country || "";
  const normalizedCountry = normalizeProjectCountry(raw.country || "");
  if (normalizedCountry) country = normalizedCountry;

  return {
    title,
    summary: sanitizeUserText(raw.summary, 500),
    description: sanitizeUserText(raw.description, TEXT_MAX),
    objective: sanitizeUserText(raw.objective, 500) || criteria.objective,
    category,
    country,
    city: sanitizeUserText(raw.city, 120) || criteria.city,
    relevance: sanitizeUserText(raw.relevance || raw.whyRelevant, TEXT_MAX),
    budgetNotes: sanitizeUserText(raw.budgetNotes || raw.budget, 400),
    challenges: Array.isArray(raw.challenges)
      ? raw.challenges.map((item) => sanitizeUserText(item, 240)).filter(Boolean).slice(0, 8)
      : [],
    stages,
  };
}

function validateGenerationPayload(payload, criteria, candidates) {
  if (!payload || typeof payload !== "object") {
    throw new IdeationError("AI_INVALID_SCHEMA", 502);
  }
  const maps = candidateMaps(candidates);
  const ideasIn = Array.isArray(payload.ideas) ? payload.ideas : [];
  const ideas = ideasIn
    .slice(0, criteria.limit)
    .map((idea) => normalizeIdea(idea, criteria, maps))
    .filter(Boolean);

  if (ideas.length === 0) {
    throw new IdeationError("AI_NO_VALID_IDEAS", 502);
  }
  return ideas;
}

/**
 * Deterministic mock generator for tests and local environments without an API key.
 * Still uses real candidate IDs only.
 */
function mockGenerateIdeas(criteria, candidates) {
  const count = criteria.limit || IDEA_LIMIT_DEFAULT;
  const ideas = [];
  const contributors = candidates.contributors || [];
  const suppliers = candidates.suppliers || [];
  const base =
    criteria.focusTitle ||
    criteria.interests ||
    criteria.objective ||
    criteria.skills ||
    "Community project";

  for (let i = 0; i < count; i += 1) {
    const contributor = contributors[i % Math.max(contributors.length, 1)];
    const supplier = suppliers[i % Math.max(suppliers.length, 1)];
    const title = `${base} — idea ${i + 1}`.slice(0, TITLE_MAX);
    ideas.push({
      title,
      summary: `Practical idea grounded in ${criteria.city || criteria.country || "local"} context.`,
      description: `Build on interests (${criteria.interests || "general"}) and skills (${criteria.skills || "learning"}).`,
      objective: criteria.objective || `Deliver a useful local outcome for idea ${i + 1}.`,
      category: criteria.category || "",
      country: criteria.country || "",
      city: criteria.city || "",
      relevance: "Aligned with stated interests and available ecosystem data.",
      budgetNotes:
        criteria.budgetAmount != null
          ? `Indicative budget around ${criteria.budgetAmount} ${criteria.budgetCurrency}`
          : "Budget to be refined with local quotes.",
      challenges: ["Validate demand with neighbors", "Secure reliable materials"],
      stages: [
        {
          title: "Prepare and validate",
          description: "Clarify scope, location, and constraints.",
          needs: [
            {
              title: "Planning support",
              description: "Help structuring the first milestones.",
              kind: "skill",
              domainOrSkills: criteria.skills || criteria.category,
              matchedContributorIds: contributor ? [contributor.id] : [],
              matchedSupplierIds: [],
              missingCapabilities: contributor ? [] : ["No verified contributor match yet"],
            },
          ],
        },
        {
          title: "Assemble resources",
          description: "Gather tools, materials, or services.",
          needs: [
            {
              title: "Core materials or tools",
              description: "Source essential inputs for the first stage.",
              kind: "resource",
              matchedContributorIds: [],
              matchedSupplierIds: supplier ? [supplier.id] : [],
              missingCapabilities: supplier ? [] : ["No verified supplier match yet"],
            },
            {
              title: "Hands-on assistance",
              description: "Short-term help during setup.",
              kind: "assistance",
              matchedContributorIds: [],
              matchedSupplierIds: [],
              missingCapabilities: ["Community helpers still to be confirmed"],
            },
          ],
        },
        {
          title: "Launch and share",
          description: "Deliver the first useful result and gather feedback.",
          needs: [
            {
              title: "Local outreach",
              description: "Share progress and invite collaborators.",
              kind: "service",
              matchedContributorIds: contributor ? [contributor.id] : [],
              matchedSupplierIds: [],
              missingCapabilities: [],
            },
          ],
        },
      ],
    });
  }

  if (criteria.refineInstruction && ideas[0]) {
    ideas[0].summary = `${ideas[0].summary} Refined: ${criteria.refineInstruction}`.slice(0, 500);
  }

  return { ideas };
}

function ideaToProjectDraftPayload(idea) {
  return {
    title: idea.title,
    summary: idea.summary || "",
    description: idea.description || "",
    objective: idea.objective || "",
    category: idea.category || "",
    country: idea.country || "",
    city: idea.city || "",
    commentAccess: "members",
    publish: false,
    stages: (idea.stages || []).map((stage) => ({
      title: stage.title,
      description: stage.description || "",
      status: "not_started",
      blockerExplanation: "",
      needs: (stage.needs || []).map((need) => ({
        title: need.title,
        description: need.description || "",
        kind: asNeedKind(need.kind),
        status: "open",
        blockerExplanation: "",
      })),
    })),
  };
}

module.exports = {
  IdeationError,
  parseCriteria,
  validateGenerationPayload,
  mockGenerateIdeas,
  ideaToProjectDraftPayload,
  sanitizeUserText,
  IDEA_LIMIT_DEFAULT,
  IDEA_LIMIT_MAX,
  SUPPORTED_CURRENCIES,
};
