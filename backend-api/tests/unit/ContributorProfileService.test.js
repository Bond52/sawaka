const {
  initialLifecycle,
  collectProfileFieldErrors,
  shapeProfile,
  PROFILE_STATUS,
  DISPLAY_NAME_MAX,
  MAX_SELECTED_SKILLS,
  MAX_CUSTOM_SKILLS,
  CUSTOM_SKILL_MAX,
} = require("../../services/ContributorProfileService");

describe("contributor profile rules", () => {
  const domainId = "64b000000000000000000001";
  const skillId = "64b000000000000000000002";

  function validBody(overrides = {}) {
    return {
      displayName: "  Amina Nguema  ",
      domainId,
      skillIds: [skillId],
      country: " Cameroun ",
      ...overrides,
    };
  }

  it("trims the display name and accepts the required profile", () => {
    const { fields, value } = collectProfileFieldErrors(validBody());
    expect(fields).toEqual({});
    expect(value.displayName).toBe("Amina Nguema");
    expect(value.country).toBe("Cameroun");
  });

  it("rejects display names outside 2 to 80 characters", () => {
    expect(collectProfileFieldErrors(validBody({ displayName: " A " })).fields.displayName).toBe(
      "DISPLAY_NAME_LENGTH"
    );
    expect(
      collectProfileFieldErrors(
        validBody({ displayName: "x".repeat(DISPLAY_NAME_MAX + 1) })
      ).fields.displayName
    ).toBe("DISPLAY_NAME_LENGTH");
  });

  it("requires one skill and rejects more than 20 selections", () => {
    expect(
      collectProfileFieldErrors(validBody({ skillIds: [], customSkills: [] })).fields.skillIds
    ).toBe("SKILL_REQUIRED");

    const tooMany = Array.from({ length: MAX_SELECTED_SKILLS + 1 }, (_, index) =>
      `64b0000000000000000000${String(index).padStart(2, "0")}`.slice(0, 24)
    );
    expect(
      collectProfileFieldErrors(validBody({ skillIds: tooMany })).fields.skillIds
    ).toBe("SKILL_LIMIT");
  });

  it("rejects duplicate, empty, over-long and too many custom skills", () => {
    expect(
      collectProfileFieldErrors(
        validBody({ skillIds: [], customSkills: [" Tissage ", "tissage"] })
      ).fields.customSkills
    ).toBe("CUSTOM_SKILL_DUPLICATE");

    expect(
      collectProfileFieldErrors(
        validBody({ skillIds: [], customSkills: ["   "] })
      ).fields.customSkills
    ).toBe("CUSTOM_SKILL_INVALID");

    expect(
      collectProfileFieldErrors(
        validBody({ skillIds: [], customSkills: ["a".repeat(CUSTOM_SKILL_MAX + 1)] })
      ).fields.customSkills
    ).toBe("CUSTOM_SKILL_LENGTH");

    const labels = Array.from({ length: MAX_CUSTOM_SKILLS + 1 }, (_, index) => `Art ${index}`);
    expect(
      collectProfileFieldErrors(validBody({ skillIds: [], customSkills: labels })).fields
        .customSkills
    ).toBe("CUSTOM_SKILL_LIMIT");
  });

  it("rejects executable markup in the biography and keeps a trimmed biography", () => {
    expect(
      collectProfileFieldErrors(
        validBody({ biography: "  Bonjour <script>alert(1)</script>  " })
      ).fields.biography
    ).toBe("BIOGRAPHY_MARKUP");

    const { fields, value } = collectProfileFieldErrors(
      validBody({ biography: "  Formatrices locales.  " })
    );
    expect(fields.biography).toBeUndefined();
    expect(value.biography).toBe("Formatrices locales.");
  });

  it("starts unverified accounts as pending and non-public", () => {
    expect(initialLifecycle({ emailVerified: false })).toEqual({
      status: PROFILE_STATUS.PENDING_EMAIL_VERIFICATION,
      isVisible: false,
    });
    expect(initialLifecycle({})).toEqual({
      status: PROFILE_STATUS.PENDING_EMAIL_VERIFICATION,
      isVisible: false,
    });
  });

  it("starts an already verified account as active and visible", () => {
    expect(initialLifecycle({ emailVerified: true })).toEqual({
      status: PROFILE_STATUS.ACTIVE,
      isVisible: true,
    });
  });

  it("shapes a public profile without account or lifecycle fields", () => {
    const profile = {
      _id: "64b000000000000000000010",
      displayName: "Amina",
      biography: "Bio",
      country: "Cameroun",
      region: "Centre",
      city: "Yaoundé",
      skills: [
        { skillId: skillId, isCustom: false, customLabel: "" },
        { skillId: null, isCustom: true, customLabel: "Raphia" },
      ],
      status: PROFILE_STATUS.PENDING_EMAIL_VERIFICATION,
      isVisible: false,
    };
    const domain = {
      _id: domainId,
      nameFR: "Construction et bâtiment",
      nameEN: "Construction & Building",
    };
    const skills = [{ _id: skillId, nameFR: "Maçonnerie", nameEN: "Masonry" }];

    const owner = shapeProfile(profile, domain, skills, { includeLifecycle: true });
    const pub = shapeProfile(profile, domain, skills, { includeLifecycle: false });

    expect(owner.status).toBe(PROFILE_STATUS.PENDING_EMAIL_VERIFICATION);
    expect(owner.isVisible).toBe(false);
    expect(owner.skills[1]).toEqual({ customLabel: "Raphia", isCustom: true });
    expect(pub.status).toBeUndefined();
    expect(pub.isVisible).toBeUndefined();
    expect(JSON.stringify(pub)).not.toMatch(/email|password|token/i);
  });
});
