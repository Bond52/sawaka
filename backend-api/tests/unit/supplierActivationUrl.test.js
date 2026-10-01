const {
  buildSupplierActivationUrl,
  buildSupplierManagementUrl,
  buildContactEmailVerificationUrl,
  DEFAULT_ORIGIN,
} = require("../../utils/supplierActivationUrl");

describe("supplierActivationUrl", () => {
  const token = "abc+token/value";

  beforeEach(() => {
    delete process.env.FRONTEND_URL;
    delete process.env.APP_BASE_URL;
    delete process.env.SUPPLIER_MAGIC_LINK_PATH;
    delete process.env.SUPPLIER_MANAGEMENT_LINK_PATH;
    delete process.env.SUPPLIER_CONTACT_EMAIL_VERIFY_PATH;
  });

  it("builds absolute URL from FRONTEND_URL", () => {
    process.env.FRONTEND_URL = "http://localhost:3000";
    expect(buildSupplierActivationUrl(token)).toBe(
      `http://localhost:3000/supplier/activate?token=${encodeURIComponent(token)}`
    );
  });

  it("falls back to APP_BASE_URL when FRONTEND_URL is unset", () => {
    process.env.APP_BASE_URL = "https://sawaka.com";
    expect(buildSupplierActivationUrl(token)).toBe(
      `https://sawaka.com/supplier/activate?token=${encodeURIComponent(token)}`
    );
  });

  it("prepends https when origin has no protocol", () => {
    process.env.FRONTEND_URL = "sawaka.com";
    expect(buildSupplierActivationUrl(token)).toBe(
      `https://sawaka.com/supplier/activate?token=${encodeURIComponent(token)}`
    );
  });

  it("uses default origin when env vars are unset", () => {
    expect(buildSupplierActivationUrl(token)).toBe(
      `${DEFAULT_ORIGIN}/supplier/activate?token=${encodeURIComponent(token)}`
    );
  });

  it("respects SUPPLIER_MAGIC_LINK_PATH", () => {
    process.env.FRONTEND_URL = "https://app.example.com";
    process.env.SUPPLIER_MAGIC_LINK_PATH = "custom/activate";
    expect(buildSupplierActivationUrl(token)).toBe(
      `https://app.example.com/custom/activate?token=${encodeURIComponent(token)}`
    );
  });

  it("builds management and contact-email verification URLs", () => {
    process.env.FRONTEND_URL = "https://app.example.com";
    expect(buildSupplierManagementUrl(token)).toBe(
      `https://app.example.com/supplier/manage?token=${encodeURIComponent(token)}`
    );
    expect(buildContactEmailVerificationUrl(token)).toBe(
      `https://app.example.com/supplier/verify-email?token=${encodeURIComponent(token)}`
    );
  });
});
