const {
  DISCOVERY_STATUS,
  deriveDiscoveryStatus,
} = require("../../services/projectDiscoveryStatus");

describe("deriveDiscoveryStatus", () => {
  it("returns not_started when there are no eligible stages", () => {
    expect(deriveDiscoveryStatus([])).toBe(DISCOVERY_STATUS.NOT_STARTED);
    expect(
      deriveDiscoveryStatus([{ status: "cancelled", needs: [{ status: "blocked" }] }])
    ).toBe(DISCOVERY_STATUS.NOT_STARTED);
  });

  it("returns blocked when a non-cancelled stage is blocked", () => {
    expect(
      deriveDiscoveryStatus([
        { status: "blocked", needs: [] },
        { status: "completed", needs: [] },
      ])
    ).toBe(DISCOVERY_STATUS.BLOCKED);
  });

  it("returns blocked when a need on a non-cancelled stage is blocked", () => {
    expect(
      deriveDiscoveryStatus([
        {
          status: "in_progress",
          needs: [{ status: "blocked" }],
        },
      ])
    ).toBe(DISCOVERY_STATUS.BLOCKED);
  });

  it("ignores blocked needs on cancelled stages", () => {
    expect(
      deriveDiscoveryStatus([
        { status: "cancelled", needs: [{ status: "blocked" }] },
        { status: "in_progress", needs: [{ status: "open" }] },
      ])
    ).toBe(DISCOVERY_STATUS.IN_PROGRESS);
  });

  it("returns completed when every eligible stage is completed", () => {
    expect(
      deriveDiscoveryStatus([
        { status: "completed", needs: [] },
        { status: "cancelled", needs: [{ status: "blocked" }] },
      ])
    ).toBe(DISCOVERY_STATUS.COMPLETED);
  });

  it("returns in_progress for unfinished eligible stages", () => {
    expect(
      deriveDiscoveryStatus([
        { status: "not_started", needs: [] },
        { status: "completed", needs: [] },
      ])
    ).toBe(DISCOVERY_STATUS.IN_PROGRESS);
  });

  it("never returns proposed for ordinary stage data", () => {
    expect(deriveDiscoveryStatus([{ status: "completed", needs: [] }])).not.toBe(
      DISCOVERY_STATUS.PROPOSED
    );
  });
});
