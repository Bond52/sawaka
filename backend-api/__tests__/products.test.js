const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");

const isCI = process.env.CI === "true";

beforeAll(async () => {
  if (isCI) {
    // En CI : pas de connexion Mongo
    return;
  }

  await mongoose.connect(process.env.MONGO_URI);
});

afterAll(async () => {
  if (isCI) {
    return;
  }

  await mongoose.connection.close();
});

describe("GET /api/products", () => {
  it(
    "should return 200 and JSON",
    async () => {
      const res = await request(app).get("/api/products");

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toMatch(/json/);
    },
    10000 // timeout explicite (optionnel mais propre)
  );
});
