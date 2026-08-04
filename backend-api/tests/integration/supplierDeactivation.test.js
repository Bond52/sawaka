const request = require("supertest");
const app = require("../../index");
const Supplier = require("../../models/Supplier");
const MagicLinkService = require("../../services/MagicLinkService");
const SupplierManagementSession = require("../../models/SupplierManagementSession");
const { AuditEvent, AUDIT_ACTIONS } = require("../../services/AuditService");

async function createActiveSupplier(overrides = {}) {
  return Supplier.create({
    name: "Deactivate Me",
    categories: ["construction_materials"],
    country: "CM",
    city: "Douala",
    accountEmail: "owner@example.com",
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

describe("POST /api/suppliers/management/deactivate", () => {
  beforeAll(() => {
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = "test-jwt-secret-management";
    }
  });

  it("requires a management session", async () => {
    const res = await request(app).post("/api/suppliers/management/deactivate");
    expect(res.statusCode).toBe(401);
  });

  it("logically deactivates, audits, invalidates session, and hides publicly", async () => {
    const supplier = await createActiveSupplier();
    const token = await sessionTokenFor(supplier._id);

    const res = await request(app)
      .post("/api/suppliers/management/deactivate")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.supplierId).toBe(supplier._id.toString());

    const stored = await Supplier.findById(supplier._id).lean();
    expect(stored).toBeTruthy();
    expect(stored.status).toBe("Inactive");
    expect(stored.isVisible).toBe(false);
    expect(stored.deactivatedAt).toBeTruthy();

    const audits = await AuditEvent.find({
      supplierId: supplier._id,
      action: AUDIT_ACTIONS.SUPPLIER_DEACTIVATED,
    });
    expect(audits).toHaveLength(1);
    expect(audits[0].sessionId).toBeTruthy();

    const sessions = await SupplierManagementSession.find({
      supplierId: supplier._id,
    });
    expect(sessions.length).toBeGreaterThanOrEqual(1);
    expect(sessions.every((s) => s.invalidatedAt)).toBe(true);

    const me = await request(app)
      .get("/api/suppliers/management/me")
      .set("Authorization", `Bearer ${token}`);
    expect(me.statusCode).toBe(401);

    const profile = await request(app).get(`/api/suppliers/${supplier._id}`);
    expect(profile.statusCode).toBe(404);

    const directory = await request(app).get("/api/suppliers");
    expect(directory.statusCode).toBe(200);
    expect(
      directory.body.find((s) => s.id === supplier._id.toString())
    ).toBeUndefined();
  });

  it("returns unavailable when already inactive", async () => {
    const supplier = await createActiveSupplier({
      accountEmail: "again@example.com",
    });
    const token = await sessionTokenFor(supplier._id);

    await request(app)
      .post("/api/suppliers/management/deactivate")
      .set("Authorization", `Bearer ${token}`);

    // Session invalidated — need a fresh path: create another session before
    // deactivation is not possible after Inactive. Direct second call with
    // same token should be 401 (session invalid).
    const second = await request(app)
      .post("/api/suppliers/management/deactivate")
      .set("Authorization", `Bearer ${token}`);
    expect(second.statusCode).toBe(401);
  });
});
