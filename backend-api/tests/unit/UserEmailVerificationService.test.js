const {
  hashToken,
  profileMeetsPublicationCriteria,
  USER_EMAIL_VERIFICATION,
} = require("../../services/UserEmailVerificationService");
const { PROFILE_STATUS } = require("../../models/ContributorProfile");

describe("UserEmailVerificationService rules", () => {
  it("hashes tokens so the stored value is not the raw token", () => {
    const raw = "ab".repeat(32);
    const hashed = hashToken(raw);
    expect(hashed).toHaveLength(64);
    expect(hashed).not.toBe(raw);
    expect(hashToken(raw)).toBe(hashed);
  });

  it("uses a purpose that is not a supplier purpose", () => {
    expect(USER_EMAIL_VERIFICATION).toBe("USER_EMAIL_VERIFICATION");
  });

  it("accepts a profile that has the approved publication fields", () => {
    expect(
      profileMeetsPublicationCriteria({
        displayName: "Amina",
        country: "Cameroun",
        domainId: "64b000000000000000000001",
        skills: [{ isCustom: false, skillId: "64b000000000000000000002" }],
        status: PROFILE_STATUS.PENDING_EMAIL_VERIFICATION,
        isVisible: false,
      })
    ).toBe(true);
  });

  it("rejects a profile that is missing a skill, country, or display name", () => {
    const base = {
      displayName: "Amina",
      country: "Cameroun",
      domainId: "64b000000000000000000001",
      skills: [{ isCustom: true, customLabel: "Raphia" }],
    };
    expect(profileMeetsPublicationCriteria({ ...base, skills: [] })).toBe(false);
    expect(profileMeetsPublicationCriteria({ ...base, country: "  " })).toBe(false);
    expect(profileMeetsPublicationCriteria({ ...base, displayName: "A" })).toBe(false);
    expect(profileMeetsPublicationCriteria(null)).toBe(false);
  });
});
