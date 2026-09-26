const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../../index");
const Supplier = require("../../models/Supplier");

const baseSupplier = {
  name: "Public Supplier",
  categories: ["construction_materials"],
  country: "CM",
  region: "Centre",
  city: "Yaoundé",
  address: "12 Rue Publique",
  postalCode: "12345",
  accountEmail: "private@example.com",
  publicEmail: "public@example.com",
  phone: "0612345678",
  website: "https://public.example.com",
  ownerId: new mongoose.Types.ObjectId(),
};

function activeVisible(overrides = {}) {
  return {
    ...baseSupplier,
    status: "Active",
    isVisible: true,
    ...overrides,
  };
}

describe("GET /api/suppliers/:id", () => {
  it("returns the public profile for an active visible supplier", async () => {
    const supplier = await Supplier.create(activeVisible());

    const res = await request(app).get(`/api/suppliers/${supplier._id}`);

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body).toEqual({
      id: supplier._id.toString(),
      name: "Public Supplier",
      categories: ["construction_materials"],
      country: "CM",
      region: "Centre",
      city: "Yaoundé",
      address: "12 Rue Publique",
      postalCode: "12345",
      publicEmail: "public@example.com",
      phone: "0612345678",
      website: "https://public.example.com",
    });
  });

  it("returns 404 for an invalid supplier identifier", async () => {
    const res = await request(app).get("/api/suppliers/not-a-valid-id");

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "Supplier not found" });
  });

  it("returns 404 for a nonexistent supplier", async () => {
    const missingId = new mongoose.Types.ObjectId().toString();

    const res = await request(app).get(`/api/suppliers/${missingId}`);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "Supplier not found" });
  });

  it("returns 404 for an inactive supplier", async () => {
    const supplier = await Supplier.create(
      activeVisible({
        status: "Invited",
        isVisible: false,
      })
    );

    const res = await request(app).get(`/api/suppliers/${supplier._id}`);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "Supplier not found" });
  });

  it("returns 404 for an invisible supplier", async () => {
    const supplier = await Supplier.create(
      activeVisible({
        isVisible: false,
      })
    );

    const res = await request(app).get(`/api/suppliers/${supplier._id}`);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "Supplier not found" });
  });

  it("does not expose private fields", async () => {
    const supplier = await Supplier.create(activeVisible());

    const res = await request(app).get(`/api/suppliers/${supplier._id}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).not.toHaveProperty("accountEmail");
    expect(res.body).not.toHaveProperty("ownerId");
    expect(res.body).not.toHaveProperty("status");
    expect(res.body).not.toHaveProperty("isVisible");
    expect(res.body).not.toHaveProperty("_id");
    expect(res.body).not.toHaveProperty("createdAt");
    expect(res.body).not.toHaveProperty("updatedAt");
    expect(res.body).not.toHaveProperty("__v");
  });

  it("returns a user-safe 500 when retrieval fails unexpectedly", async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const spy = jest.spyOn(Supplier, "findOne").mockImplementation(() => {
      throw new Error("ECONNREFUSED mongodb");
    });
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const res = await request(app).get(`/api/suppliers/${id}`);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: "Erreur serveur" });
      expect(res.body).not.toHaveProperty("details");
      expect(res.body).not.toHaveProperty("stack");
      expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|mongodb/i);
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      consoleSpy.mockRestore();
    }
  });
});
