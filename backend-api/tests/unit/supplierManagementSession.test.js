const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

jest.mock("../../models/SupplierManagementSession");

const SupplierManagementSession = require("../../models/SupplierManagementSession");
const {
  createManagementSession,
  requireSupplierManagementSession,
  invalidateSessionsForSupplier,
  TOKEN_TYPE,
} = require("../../middleware/supplierManagementSession");

describe("supplierManagementSession middleware", () => {
  const supplierId = new mongoose.Types.ObjectId().toString();
  const secret = "test-secret-for-mgmt-session";

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = secret;
  });

  describe("createManagementSession", () => {
    it("persists a session and returns a typed JWT", async () => {
      SupplierManagementSession.create.mockResolvedValue({});

      const result = await createManagementSession(supplierId);

      expect(SupplierManagementSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          supplierId,
          jti: expect.any(String),
          expiresAt: expect.any(Date),
        })
      );
      expect(result.token).toBeTruthy();
      const payload = jwt.verify(result.token, secret);
      expect(payload.typ).toBe(TOKEN_TYPE);
      expect(payload.supplierId).toBe(supplierId);
      expect(payload.jti).toBe(result.jti);
    });
  });

  describe("requireSupplierManagementSession", () => {
    function mockRes() {
      return {
        statusCode: 200,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.body = payload;
          return this;
        },
      };
    }

    it("rejects missing Authorization header", async () => {
      const req = { headers: {} };
      const res = mockRes();
      const next = jest.fn();

      await requireSupplierManagementSession(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects expired or invalidated sessions", async () => {
      SupplierManagementSession.create.mockResolvedValue({});
      const { token, jti } = await createManagementSession(supplierId);

      SupplierManagementSession.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          jti,
          supplierId,
          expiresAt: new Date(Date.now() + 60_000),
          invalidatedAt: new Date(),
        }),
      });

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      await requireSupplierManagementSession(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("accepts a valid session and binds supplierId", async () => {
      SupplierManagementSession.create.mockResolvedValue({});
      const { token, jti } = await createManagementSession(supplierId);

      SupplierManagementSession.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          jti,
          supplierId,
          expiresAt: new Date(Date.now() + 60_000),
          invalidatedAt: null,
        }),
      });

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      await requireSupplierManagementSession(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.managementSession).toEqual({ supplierId, jti });
    });

    it("rejects activation-style JWTs without management typ", async () => {
      const activationToken = jwt.sign({ supplierId }, secret, {
        expiresIn: "7d",
      });
      const req = {
        headers: { authorization: `Bearer ${activationToken}` },
      };
      const res = mockRes();
      const next = jest.fn();

      await requireSupplierManagementSession(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("invalidateSessionsForSupplier", () => {
    it("marks active sessions invalidated", async () => {
      SupplierManagementSession.updateMany.mockResolvedValue({
        modifiedCount: 1,
      });

      await invalidateSessionsForSupplier(supplierId);

      expect(SupplierManagementSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          supplierId,
          invalidatedAt: null,
        }),
        { $set: { invalidatedAt: expect.any(Date) } }
      );
    });
  });
});
