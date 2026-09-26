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

async function seedDirectorySuppliers() {
  await Supplier.create([
    activeVisible({
      name: "Acme Wood Supply",
      categories: ["wood_lumber"],
      accountEmail: "acme@example.com",
    }),
    activeVisible({
      name: "BuildMart CM",
      categories: ["construction_materials"],
      accountEmail: "buildmart@example.com",
    }),
    activeVisible({
      name: "Steel Works",
      categories: ["metal_steel"],
      accountEmail: "steel@example.com",
    }),
    activeVisible({
      name: "Hidden Acme",
      categories: ["wood_lumber"],
      accountEmail: "hidden@example.com",
      status: "Invited",
      isVisible: false,
    }),
    activeVisible({
      name: "Invisible BuildMart",
      categories: ["construction_materials"],
      accountEmail: "invisible@example.com",
      isVisible: false,
    }),
  ]);
}

describe("GET /api/suppliers", () => {
  it("returns active and visible suppliers", async () => {
    const supplier = await Supplier.create({
      ...baseSupplier,
      status: "Active",
      isVisible: true,
    });

    const res = await request(app).get("/api/suppliers");

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
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

  it("returns region when provided", async () => {
    await Supplier.create({
      ...baseSupplier,
      status: "Active",
      isVisible: true,
    });

    const res = await request(app).get("/api/suppliers");

    expect(res.statusCode).toBe(200);
    expect(res.body[0].region).toBe("Centre");
  });

  it("omits region when empty or whitespace-only", async () => {
    await Supplier.create({
      ...baseSupplier,
      accountEmail: "empty-region@example.com",
      region: "",
      status: "Active",
      isVisible: true,
    });
    await Supplier.create({
      ...baseSupplier,
      accountEmail: "blank-region@example.com",
      region: "   ",
      status: "Active",
      isVisible: true,
    });

    const res = await request(app).get("/api/suppliers");

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(2);
    for (const supplier of res.body) {
      expect(supplier).not.toHaveProperty("region");
    }
  });

  it("excludes inactive suppliers", async () => {
    await Supplier.create({
      ...baseSupplier,
      accountEmail: "invited@example.com",
      status: "Invited",
      isVisible: false,
    });
    await Supplier.create({
      ...baseSupplier,
      accountEmail: "deleted@example.com",
      status: "Deleted",
      isVisible: true,
    });
    await Supplier.create({
      ...baseSupplier,
      accountEmail: "active@example.com",
      status: "Active",
      isVisible: true,
    });

    const res = await request(app).get("/api/suppliers");

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Public Supplier");
  });

  it("excludes invisible suppliers", async () => {
    await Supplier.create({
      ...baseSupplier,
      accountEmail: "hidden@example.com",
      status: "Active",
      isVisible: false,
    });
    await Supplier.create({
      ...baseSupplier,
      accountEmail: "visible@example.com",
      status: "Active",
      isVisible: true,
    });

    const res = await request(app).get("/api/suppliers");

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Public Supplier");
  });

  it("does not expose private fields", async () => {
    await Supplier.create({
      ...baseSupplier,
      status: "Active",
      isVisible: true,
    });

    const res = await request(app).get("/api/suppliers");

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);

    const supplier = res.body[0];
    expect(supplier).not.toHaveProperty("accountEmail");
    expect(supplier).not.toHaveProperty("ownerId");
    expect(supplier).not.toHaveProperty("status");
    expect(supplier).not.toHaveProperty("isVisible");
    expect(supplier).not.toHaveProperty("_id");
    expect(supplier).not.toHaveProperty("createdAt");
    expect(supplier).not.toHaveProperty("updatedAt");
    expect(supplier).not.toHaveProperty("__v");
  });

  it("returns an empty array when no public suppliers are available", async () => {
    await Supplier.create({
      ...baseSupplier,
      status: "Invited",
      isVisible: false,
    });

    const res = await request(app).get("/api/suppliers");

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns a user-safe 500 when directory retrieval fails unexpectedly", async () => {
    const spy = jest.spyOn(Supplier, "find").mockImplementation(() => {
      throw new Error("ECONNREFUSED mongodb suppliers");
    });
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const res = await request(app).get("/api/suppliers");

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: "Erreur serveur" });
      expect(res.body).not.toHaveProperty("details");
      expect(res.body).not.toHaveProperty("stack");
      expect(JSON.stringify(res.body)).not.toMatch(
        /ECONNREFUSED|mongodb|suppliers/i
      );
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      consoleSpy.mockRestore();
    }
  });

  it("returns a user-safe 500 when search retrieval fails unexpectedly", async () => {
    const spy = jest.spyOn(Supplier, "find").mockImplementation(() => {
      throw new Error("cursor killed on collection suppliers");
    });
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const res = await request(app)
        .get("/api/suppliers")
        .query({ search: "acme" });

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: "Erreur serveur" });
      expect(JSON.stringify(res.body)).not.toMatch(/cursor|collection/i);
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      consoleSpy.mockRestore();
    }
  });

  describe("search and category filtering", () => {
    beforeEach(async () => {
      await seedDirectorySuppliers();
    });

    it("searches by full supplier name", async () => {
      const res = await request(app).get("/api/suppliers").query({
        search: "Acme Wood Supply",
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe("Acme Wood Supply");
    });

    it("searches by partial supplier name", async () => {
      const res = await request(app).get("/api/suppliers").query({
        search: "build",
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe("BuildMart CM");
    });

    it("searches case-insensitively", async () => {
      const res = await request(app).get("/api/suppliers").query({
        search: "STEEL WORKS",
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe("Steel Works");
    });

    it("trims leading and trailing spaces in search", async () => {
      const res = await request(app).get("/api/suppliers").query({
        search: "  acme  ",
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe("Acme Wood Supply");
    });

    it("filters by category", async () => {
      const res = await request(app).get("/api/suppliers").query({
        category: "wood_lumber",
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe("Acme Wood Supply");
      expect(res.body[0].categories).toContain("wood_lumber");
    });

    it("combines name search and category filtering", async () => {
      await Supplier.create(
        activeVisible({
          name: "Acme Construction",
          categories: ["construction_materials"],
          accountEmail: "acme-construction@example.com",
        })
      );

      const res = await request(app).get("/api/suppliers").query({
        search: "acme",
        category: "wood_lumber",
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe("Acme Wood Supply");
    });

    it("returns an empty array when no suppliers match", async () => {
      const res = await request(app).get("/api/suppliers").query({
        search: "nonexistent supplier",
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("excludes inactive or invisible suppliers from filtered results", async () => {
      const res = await request(app).get("/api/suppliers").query({
        search: "acme",
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe("Acme Wood Supply");
    });

    it("does not expose private fields in filtered results", async () => {
      const res = await request(app).get("/api/suppliers").query({
        category: "metal_steel",
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(1);

      const supplier = res.body[0];
      expect(supplier).not.toHaveProperty("accountEmail");
      expect(supplier).not.toHaveProperty("ownerId");
      expect(supplier).not.toHaveProperty("status");
      expect(supplier).not.toHaveProperty("isVisible");
    });

    it("returns 400 for invalid category", async () => {
      const res = await request(app).get("/api/suppliers").query({
        category: "invalid_cat",
      });

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: "Invalid category" });
    });

    it("returns 400 when search is not a string", async () => {
      const res = await request(app)
        .get("/api/suppliers")
        .query("search=acme&search=other");

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: "search must be a string" });
    });
  });
});
