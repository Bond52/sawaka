const request = require("supertest");
const app = require("../index");

describe("GET /api/products", () => {
  it(
    "should return 200 and JSON",
    async () => {
      const res = await request(app).get("/api/products");

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toMatch(/json/);
    },
    10000
  );
});
