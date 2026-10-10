const { createRateLimiter } = require("../../middleware/rateLimit");

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
  };
  return res;
}

describe("createRateLimiter", () => {
  it("allows requests under the limit and blocks when exceeded", () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 2,
      keyGenerator: () => "test-key",
    });

    const req = {};
    const next = jest.fn();

    const res1 = mockRes();
    limiter(req, res1, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res1.statusCode).toBe(200);

    const res2 = mockRes();
    limiter(req, res2, next);
    expect(next).toHaveBeenCalledTimes(2);

    const res3 = mockRes();
    limiter(req, res3, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(res3.statusCode).toBe(429);
    expect(res3.body).toEqual({
      error: "Too many requests. Please try again later.",
    });
    expect(res3.headers["Retry-After"]).toBeDefined();
  });

  it("reset clears counters", () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 1,
      keyGenerator: () => "reset-key",
    });
    const req = {};
    const next = jest.fn();

    limiter(req, mockRes(), next);
    limiter(req, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);

    limiter.reset();
    limiter(req, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
