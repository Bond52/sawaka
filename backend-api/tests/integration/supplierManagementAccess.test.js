const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../../index");
const Supplier = require("../../models/Supplier");
const MagicLinkToken = require("../../models/MagicLinkToken");
const EmailService = require("../../services/EmailService");
const supplierRoutes = require("../../routes/supplier.routes");

jest.mock("../../services/EmailService", () => ({
  sendSupplierActivationEmail: jest.fn(),
  sendSupplierManagementEmail: jest.fn(),
  sendContactEmailVerification: jest.fn(),
  sendMagicLink: jest.fn(),
}));

const baseSupplier = {
  name: "Managed Supplier",
  categories: ["construction_materials"],
  country: "CM",
  city: "Douala",
  accountEmail: "private@example.com",
  phone: "0612345678",
};

describe("POST /api/suppliers/:id/management-link", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    if (supplierRoutes.managementLinkRateLimit?.reset) {
      supplierRoutes.managementLinkRateLimit.reset();
    }
    EmailService.sendSupplierManagementEmail.mockResolvedValue(true);
  });

  it("returns a generic confirmation and sends email when contact email matches", async () => {
    const supplier = await Supplier.create({
      ...baseSupplier,
      status: "Active",
      isVisible: true,
    });

    const res = await request(app)
      .post(`/api/suppliers/${supplier._id}/management-link`)
      .send({ email: "  Private@Example.com  " });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(res.body).not.toHaveProperty("token");
    expect(JSON.stringify(res.body)).not.toMatch(/private@example|token/i);

    expect(EmailService.sendSupplierManagementEmail).toHaveBeenCalledTimes(1);
    const [sentTo, rawToken] =
      EmailService.sendSupplierManagementEmail.mock.calls[0];
    expect(sentTo).toBe("Private@Example.com");
    expect(typeof rawToken).toBe("string");
    expect(rawToken.length).toBeGreaterThan(10);

    const tokens = await MagicLinkToken.find({
      supplierId: supplier._id,
      purpose: "SUPPLIER_MANAGEMENT",
    });
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenHash).toBeTruthy();
    expect(tokens[0].token).toBeFalsy();
  });

  it("generates independent links for repeated requests across suppliers", async () => {
    const supplierA = await Supplier.create({
      ...baseSupplier,
      accountEmail: "supplier-a@example.com",
      status: "Active",
      isVisible: true,
    });
    const supplierB = await Supplier.create({
      ...baseSupplier,
      accountEmail: "supplier-b@example.com",
      status: "Active",
      isVisible: true,
    });

    for (const [supplier, email] of [
      [supplierA, "supplier-a@example.com"],
      [supplierB, "supplier-b@example.com"],
      [supplierA, "supplier-a@example.com"],
    ]) {
      const res = await request(app)
        .post(`/api/suppliers/${supplier._id}/management-link`)
        .send({ email });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ success: true });
    }

    const tokens = await MagicLinkToken.find({
      purpose: "SUPPLIER_MANAGEMENT",
    }).sort({ createdAt: 1 });

    expect(tokens).toHaveLength(3);
    expect(tokens.map((token) => token.supplierId.toString())).toEqual([
      supplierA._id.toString(),
      supplierB._id.toString(),
      supplierA._id.toString(),
    ]);
    expect(new Set(tokens.map((token) => token.tokenHash)).size).toBe(3);
    expect(EmailService.sendSupplierManagementEmail).toHaveBeenCalledTimes(3);
  });

  it("returns the same confirmation without sending when email does not match", async () => {
    const supplier = await Supplier.create({
      ...baseSupplier,
      status: "Active",
      isVisible: true,
    });

    const res = await request(app)
      .post(`/api/suppliers/${supplier._id}/management-link`)
      .send({ email: "other@example.com" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(EmailService.sendSupplierManagementEmail).not.toHaveBeenCalled();
    const tokens = await MagicLinkToken.find({ supplierId: supplier._id });
    expect(tokens).toHaveLength(0);
  });

  it("does not send a link for inactive suppliers", async () => {
    const supplier = await Supplier.create({
      ...baseSupplier,
      status: "Invited",
      isVisible: false,
    });

    const res = await request(app)
      .post(`/api/suppliers/${supplier._id}/management-link`)
      .send({ email: "private@example.com" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(EmailService.sendSupplierManagementEmail).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid email format", async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post(`/api/suppliers/${id}/management-link`)
      .send({ email: "not-valid" });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it("returns 400 for an invalid supplier id", async () => {
    const res = await request(app)
      .post("/api/suppliers/not-valid/management-link")
      .send({ email: "a@b.com" });

    expect(res.statusCode).toBe(400);
  });

  it("rate limits repeated requests", async () => {
    const supplier = await Supplier.create({
      ...baseSupplier,
      status: "Active",
      isVisible: true,
    });

    const url = `/api/suppliers/${supplier._id}/management-link`;
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).post(url).send({ email: "x@y.com" });
      expect(res.statusCode).toBe(200);
    }

    const limited = await request(app).post(url).send({ email: "x@y.com" });
    expect(limited.statusCode).toBe(429);
    expect(limited.body.error).toMatch(/too many/i);
  });
});
