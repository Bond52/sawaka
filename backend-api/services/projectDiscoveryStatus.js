const { STAGE_STATUS, NEED_STATUS } = require("../models/Project");

/**
 * Discovery status for public directory display/filtering.
 * Distinct from publication status (draft | published).
 * `proposed` is reserved for future moderator-approved AI proposals
 * and must never be assigned by this derivation for ordinary projects.
 */
const DISCOVERY_STATUS = Object.freeze({
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  BLOCKED: "blocked",
  COMPLETED: "completed",
  PROPOSED: "proposed",
});

const DISCOVERY_STATUS_VALUES = Object.freeze(Object.values(DISCOVERY_STATUS));

/**
 * Precedence:
 * 1. blocked — non-cancelled stage blocked OR blocked need on non-cancelled stage
 * 2. not_started — no eligible (non-cancelled) stages
 * 3. completed — every eligible stage completed
 * 4. in_progress — otherwise (has unfinished eligible stages)
 *
 * Cancelled stages are ignored. Proposed is never returned here.
 */
function deriveDiscoveryStatus(stages) {
  const list = Array.isArray(stages) ? stages : [];
  const eligible = list.filter((stage) => stage && stage.status !== STAGE_STATUS.CANCELLED);

  const stageBlocked = eligible.some((stage) => stage.status === STAGE_STATUS.BLOCKED);
  const needBlocked = eligible.some((stage) =>
    (stage.needs || []).some(
      (need) => need && need.status === NEED_STATUS.BLOCKED
    )
  );
  if (stageBlocked || needBlocked) return DISCOVERY_STATUS.BLOCKED;

  if (eligible.length === 0) return DISCOVERY_STATUS.NOT_STARTED;

  if (eligible.every((stage) => stage.status === STAGE_STATUS.COMPLETED)) {
    return DISCOVERY_STATUS.COMPLETED;
  }

  return DISCOVERY_STATUS.IN_PROGRESS;
}

function isDiscoveryStatus(value) {
  return typeof value === "string" && DISCOVERY_STATUS_VALUES.includes(value);
}

module.exports = {
  DISCOVERY_STATUS,
  DISCOVERY_STATUS_VALUES,
  deriveDiscoveryStatus,
  isDiscoveryStatus,
};
