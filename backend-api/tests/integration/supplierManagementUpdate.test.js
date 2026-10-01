const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../../index");
const Supplier = require("../../models/Supplier");
const MagicLinkService = require("../../services/MagicLinkService");
const { AuditEvent, AUDIT_ACTIONS } = require("../../services/AuditService");

const baseSupplier = {
  name: "Editable Co",
  categories: ["construction_materials"],
  country: "CM",
  city: "Yaoundé",
  accountEmail: "owner@example.com",
  phone: "0612345678",
  publicEmail: "public@example.com",
  website: "https://editable.example.com",
};

async function createActiveSupplier(overrides = {}) {
  return Supplier.create({
    ...baseSupplier,
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

describe("GET/PATCH /api/suppliers/management", () => {
  beforeAll(() => {
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = "test-jwt-secret-management";
    }
  });

  it("requires a management session", async () => {
    const getRes = await request(app).get("/api/suppliers/management");
    expect(getRes.statusCode).toBe(401);

    const patchRes = await request(app)
      .patch("/api/suppliers/management")
      .send({ name: "X" });
    expect(patchRes.statusCode).toBe(401);
  });

  it("returns editable supplier fields including private email", async () => {
    const supplier = await createActiveSupplier();
    const token = await sessionTokenFor(supplier._id);

    const res = await request(app)
      .get("/api/suppliers/management")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      id: supplier._id.toString(),
      name: "Editable Co",
      accountEmail: "owner@example.com",
      phone: "0612345678",
      categories: ["construction_materials"],
    });
    expect(res.body).not.toHaveProperty("status");
    expect(res.body).not.toHaveProperty("isVisible");
    expect(res.body).not.toHaveProperty("ownerId");
  });

  it("updates permitted fields, protects system fields, and records audit", async () => {
    const supplier = await createActiveSupplier({
      accountEmail: "update@example.com",
    });
    const token = await sessionTokenFor(supplier._id);

    const res = await request(app)
      .patch("/api/suppliers/management")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Updated Co",
        categories: ["wood_lumber"],
        country: "CM",
        city: "Douala",
        phone: "0699999999",
        accountEmail: "update@example.com",
        publicEmail: "newpublic@example.com",
        website: "https://updated.example.com",
        status: "Deleted",
        isVisible: false,
        ownerId: new mongoose.Types.ObjectId().toString(),
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.supplier.name).toBe("Updated Co");
    expect(res.body.supplier.city).toBe("Douala");
    expect(res.body.supplier.categories).toEqual(["wood_lumber"]);
    expect(res.body.supplier.accountEmail).toBe("update@example.com");

    const stored = await Supplier.findById(supplier._id).lean();
    expect(stored.status).toBe("Active");
    expect(stored.isVisible).toBe(true);
    expect(stored.name).toBe("Updated Co");

    const publicRes = await request(app).get(`/api/suppliers/${supplier._id}`);
    expect(publicRes.statusCode).toBe(200);
    expect(publicRes.body.name).toBe("Updated Co");
    expect(publicRes.body).not.toHaveProperty("accountEmail");

    const audits = await AuditEvent.find({
      supplierId: supplier._id,
      action: AUDIT_ACTIONS.SUPPLIER_UPDATED,
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
    expect(audits[0].sessionId).toBeTruthy();
    expect(audits[0].metadata.changedFields).toEqual(
      expect.arrayContaining(["name", "categories", "city", "phone"])
    );
  });

  it("rejects invalid updates", async () => {
    const supplier = await createActiveSupplier({
      accountEmail: "invalid@example.com",
    });
    const token = await sessionTokenFor(supplier._id);

    const res = await request(app)
      .patch("/api/suppliers/management")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "",
        categories: [],
        country: "CM",
        phone: "12",
        accountEmail: "invalid@example.com",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  it("accepts a partial PATCH that only changes an optional field", async () => {
    const supplier = await createActiveSupplier({
      accountEmail: "partial@example.com",
      website: "https://before.example.com",
      city: "Yaoundé",
    });
    const token = await sessionTokenFor(supplier._id);

    const res = await request(app)
      .patch("/api/suppliers/management")
      .set("Authorization", `Bearer ${token}`)
      .send({ website: "https://after.example.com" });

    expect(res.statusCode).toBe(200);
    expect(res.body.supplier).toMatchObject({
      name: "Editable Co",
      categories: ["construction_materials"],
      country: "CM",
      city: "Yaoundé",
      phone: "0612345678",
      accountEmail: "partial@example.com",
      website: "https://after.example.com",
    });

    const stored = await Supplier.findById(supplier._id).lean();
    expect(stored.name).toBe("Editable Co");
    expect(stored.categories).toEqual(["construction_materials"]);
    expect(stored.country).toBe("CM");
    expect(stored.phone).toBe("0612345678");
    expect(stored.accountEmail).toBe("partial@example.com");
    expect(stored.website).toBe("https://after.example.com");
    expect(stored.city).toBe("Yaoundé");
  });

  it("accepts a partial PATCH that only changes phone", async () => {
    const supplier = await createActiveSupplier({
      accountEmail: "phone-only@example.com",
    });
    const token = await sessionTokenFor(supplier._id);

    const res = await request(app)
      .patch("/api/suppliers/management")
      .set("Authorization", `Bearer ${token}`)
      .send({ phone: "0699887766" });

    expect(res.statusCode).toBe(200);
    expect(res.body.supplier.phone).toBe("0699887766");
    expect(res.body.supplier.name).toBe("Editable Co");
    expect(res.body.supplier.accountEmail).toBe("phone-only@example.com");

    const stored = await Supplier.findById(supplier._id).lean();
    expect(stored.phone).toBe("0699887766");
    expect(stored.name).toBe("Editable Co");
    expect(stored.categories).toEqual(["construction_materials"]);
  });

  it("accepts a partial PATCH that only changes categories", async () => {
    const supplier = await createActiveSupplier({
      accountEmail: "cats-only@example.com",
    });
    const token = await sessionTokenFor(supplier._id);

    const res = await request(app)
      .patch("/api/suppliers/management")
      .set("Authorization", `Bearer ${token}`)
      .send({ categories: ["wood_lumber", "metal_steel"] });

    expect(res.statusCode).toBe(200);
    expect(res.body.supplier.categories).toEqual([
      "wood_lumber",
      "metal_steel",
    ]);
    expect(res.body.supplier.phone).toBe("0612345678");
  });

  it("rejects clearing a required field in a partial PATCH", async () => {
    const supplier = await createActiveSupplier({
      accountEmail: "clear-required@example.com",
    });
    const token = await sessionTokenFor(supplier._id);

    const res = await request(app)
      .patch("/api/suppliers/management")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "" });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toHaveProperty("name");

    const stored = await Supplier.findById(supplier._id).lean();
    expect(stored.name).toBe("Editable Co");
  });

  it("stores a changed contact email as pending without replacing the verified email", async () => {
    const supplier = await createActiveSupplier({
      accountEmail: "keep@example.com",
    });
    const token = await sessionTokenFor(supplier._id);

    const res = await request(app)
      .patch("/api/suppliers/management")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Keep Email Co",
        categories: ["construction_materials"],
        country: "CM",
        phone: "0612345678",
        accountEmail: "new-owner@example.com",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.supplier.accountEmail).toBe("keep@example.com");
    expect(res.body.supplier.pendingContactEmail).toBe("new-owner@example.com");
    expect(res.body.emailVerificationPending).toBe(true);
    const stored = await Supplier.findById(supplier._id).lean();
    expect(stored.accountEmail).toBe("keep@example.com");
    expect(stored.pendingContactEmail).toBe("new-owner@example.com");
  });
});
