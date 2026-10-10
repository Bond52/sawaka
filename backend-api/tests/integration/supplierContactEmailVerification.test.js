const request = require("supertest");
const app = require("../../index");
const Supplier = require("../../models/Supplier");
const MagicLinkService = require("../../services/MagicLinkService");
const EmailService = require("../../services/EmailService");
const { AuditEvent, AUDIT_ACTIONS } = require("../../services/AuditService");
const supplierRoutes = require("../../routes/supplier.routes");

jest.mock("../../services/EmailService", () => ({
  sendSupplierActivationEmail: jest.fn().mockResolvedValue(true),
  sendSupplierManagementEmail: jest.fn().mockResolvedValue(true),
  sendContactEmailVerification: jest.fn().mockResolvedValue(true),
  sendMagicLink: jest.fn().mockResolvedValue(true),
}));

async function createActiveSupplier(overrides = {}) {
  return Supplier.create({
    name: "Verify Co",
    categories: ["construction_materials"],
    country: "CM",
    city: "Douala",
    accountEmail: "verified@example.com",
    phone: "0612345678",
    status: "Active",
    isVisible: true,
    ...overrides,
  });
}

async function sessionTokenFor(supplierId) {
  const { rawToken } = await MagicLinkService.generateToken({
    supplierId,
    purpose: MagicLinkService.PURPOSES.SUPPLIER_MANAGEMENT,
  });
  const res = await request(app)
    .post("/api/suppliers/management-session")
    .send({ token: rawToken });
  expect(res.statusCode).toBe(200);
  return res.body.token;
}

describe("Contact email verification workflow", () => {
  beforeAll(() => {
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = "test-jwt-secret-management";
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    EmailService.sendContactEmailVerification.mockResolvedValue(true);
    EmailService.sendSupplierManagementEmail.mockResolvedValue(true);
    if (supplierRoutes.contactEmailResendRateLimit?.reset) {
      supplierRoutes.contactEmailResendRateLimit.reset();
    }
    if (supplierRoutes.managementLinkRateLimit?.reset) {
      supplierRoutes.managementLinkRateLimit.reset();
    }
  });

  it("saves other fields and pending email, then verifies via magic link", async () => {
    const supplier = await createActiveSupplier();
    const token = await sessionTokenFor(supplier._id);

    const patch = await request(app)
      .patch("/api/suppliers/management")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Verify Co Updated",
        categories: ["wood_lumber"],
        country: "CM",
        phone: "0612345678",
        accountEmail: "pending@example.com",
      });

    expect(patch.statusCode).toBe(200);
    expect(patch.body.emailVerificationPending).toBe(true);
    expect(patch.body.supplier.name).toBe("Verify Co Updated");
    expect(patch.body.supplier.accountEmail).toBe("verified@example.com");
    expect(patch.body.supplier.pendingContactEmail).toBe(
      "pending@example.com"
    );
    expect(EmailService.sendContactEmailVerification).toHaveBeenCalled();
    const rawVerifyToken =
      EmailService.sendContactEmailVerification.mock.calls[0][1];

    const verify = await request(app)
      .post("/api/suppliers/contact-email/verify")
      .send({ token: rawVerifyToken });

    expect(verify.statusCode).toBe(200);
    expect(verify.body.success).toBe(true);

    const stored = await Supplier.findById(supplier._id).lean();
    expect(stored.accountEmail).toBe("pending@example.com");
    expect(stored.pendingContactEmail).toBeFalsy();
    expect(stored.contactEmailVerifiedAt).toBeTruthy();

    const audits = await AuditEvent.find({
      supplierId: supplier._id,
      action: AUDIT_ACTIONS.SUPPLIER_CONTACT_EMAIL_VERIFIED,
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);

    // Old verified email must not grant management access after change
    await request(app)
      .post(`/api/suppliers/${supplier._id}/management-link`)
      .send({ email: "verified@example.com" });
    expect(EmailService.sendSupplierManagementEmail).not.toHaveBeenCalled();

    await request(app)
      .post(`/api/suppliers/${supplier._id}/management-link`)
      .send({ email: "pending@example.com" });
    expect(EmailService.sendSupplierManagementEmail).toHaveBeenCalled();
  });

  it("rejects reused verification tokens", async () => {
    const supplier = await createActiveSupplier({
      accountEmail: "a@example.com",
      pendingContactEmail: "b@example.com",
    });
    const { rawToken } = await MagicLinkService.generateToken({
      supplierId: supplier._id,
      purpose: MagicLinkService.PURPOSES.CONTACT_EMAIL_VERIFICATION,
      pendingEmail: "b@example.com",
    });

    const first = await request(app)
      .post("/api/suppliers/contact-email/verify")
      .send({ token: rawToken });
    expect(first.statusCode).toBe(200);

    const second = await request(app)
      .post("/api/suppliers/contact-email/verify")
      .send({ token: rawToken });
    expect(second.statusCode).toBe(400);
  });

  it("cancels pending email change", async () => {
    const supplier = await createActiveSupplier({
      accountEmail: "keep@example.com",
      pendingContactEmail: "temp@example.com",
    });
    const token = await sessionTokenFor(supplier._id);

    const res = await request(app)
      .post("/api/suppliers/management/contact-email/cancel")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.supplier.accountEmail).toBe("keep@example.com");
    expect(res.body.supplier.pendingContactEmail).toBeUndefined();

    const stored = await Supplier.findById(supplier._id).lean();
    expect(stored.accountEmail).toBe("keep@example.com");
    expect(stored.pendingContactEmail).toBeFalsy();
  });

  it("rate limits verification resend", async () => {
    const supplier = await createActiveSupplier({
      accountEmail: "keep@example.com",
      pendingContactEmail: "temp@example.com",
    });
    const token = await sessionTokenFor(supplier._id);
    const url = "/api/suppliers/management/contact-email/resend";

    for (let i = 0; i < 5; i += 1) {
      const res = await request(app)
        .post(url)
        .set("Authorization", `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
    }

    const limited = await request(app)
      .post(url)
      .set("Authorization", `Bearer ${token}`);
    expect(limited.statusCode).toBe(429);
  });
});
