const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../../index");
const Supplier = require("../../models/Supplier");
const MagicLinkToken = require("../../models/MagicLinkToken");
const MagicLinkService = require("../../services/MagicLinkService");
const SupplierManagementSession = require("../../models/SupplierManagementSession");

const baseSupplier = {
  name: "Session Supplier",
  categories: ["construction_materials"],
  country: "CM",
  city: "Douala",
  accountEmail: "owner@example.com",
  phone: "0612345678",
};

describe("POST /api/suppliers/management-session", () => {
  beforeAll(() => {
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = "test-jwt-secret-management";
    }
  });

  async function createActiveSupplier(overrides = {}) {
    return Supplier.create({
      ...baseSupplier,
      status: "Active",
      isVisible: true,
      ...overrides,
    });
  }

  async function issueManagementToken(supplierId) {
    const { rawToken } = await MagicLinkService.generateToken({
      supplierId,
      purpose: MagicLinkService.PURPOSES.SUPPLIER_MANAGEMENT,
    });
    return rawToken;
  }

  it("establishes a management session and consumes the magic-link token", async () => {
    const supplier = await createActiveSupplier();
    const rawToken = await issueManagementToken(supplier._id);

    const res = await request(app)
      .post("/api/suppliers/management-session")
      .send({ token: rawToken });

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.supplierId).toBe(supplier._id.toString());
    expect(res.body.expiresAt).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/owner@example/i);
    expect(JSON.stringify(res.body)).not.toContain(rawToken);

    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(payload.typ).toBe("SUPPLIER_MANAGEMENT");
    expect(payload.supplierId).toBe(supplier._id.toString());

    const tokenDocs = await MagicLinkToken.find({
      supplierId: supplier._id,
      purpose: "SUPPLIER_MANAGEMENT",
    });
    expect(tokenDocs).toHaveLength(1);
    expect(tokenDocs[0].isUsed).toBe(true);

    const sessions = await SupplierManagementSession.find({
      supplierId: supplier._id,
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].jti).toBe(payload.jti);

    const me = await request(app)
      .get("/api/suppliers/management/me")
      .set("Authorization", `Bearer ${res.body.token}`);

    expect(me.statusCode).toBe(200);
    expect(me.body).toEqual({ supplierId: supplier._id.toString() });
  });

  it("rejects reused tokens", async () => {
    const supplier = await createActiveSupplier({
      accountEmail: "reuse@example.com",
    });
    const rawToken = await issueManagementToken(supplier._id);

    const first = await request(app)
      .post("/api/suppliers/management-session")
      .send({ token: rawToken });
    expect(first.statusCode).toBe(200);

    const second = await request(app)
      .post("/api/suppliers/management-session")
      .send({ token: rawToken });
    expect(second.statusCode).toBe(400);
    expect(second.body.error).toMatch(/already used|Invalid magic link/i);
  });

  it("rejects activation tokens for management session", async () => {
    const supplier = await createActiveSupplier({
      accountEmail: "act@example.com",
    });
    const { rawToken } = await MagicLinkService.generateToken({
      supplierId: supplier._id,
      purpose: MagicLinkService.PURPOSES.SUPPLIER_ACTIVATION,
    });

    const res = await request(app)
      .post("/api/suppliers/management-session")
      .send({ token: rawToken });

    expect(res.statusCode).toBe(400);
  });

  it("rejects missing management session on /management/me", async () => {
    const res = await request(app).get("/api/suppliers/management/me");
    expect(res.statusCode).toBe(401);
  });

  it("rejects activation JWT on /management/me", async () => {
    const token = jwt.sign(
      { supplierId: new mongoose.Types.ObjectId().toString() },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const res = await request(app)
      .get("/api/suppliers/management/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(401);
  });
});
