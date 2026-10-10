const request = require("supertest");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = require("../../index");
const User = require("../../models/user");

async function createUser({
  email,
  password,
  roles = ["acheteur", "vendeur"],
  username = "testuser",
}) {
  const hash = await bcrypt.hash(password, 10);
  return User.create({
    firstName: "Test",
    lastName: "User",
    username,
    email,
    password: hash,
    roles,
    isSeller: roles.includes("vendeur"),
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = "test-jwt-secret-auth";
    }
  });

  it("logs in a standard user and sets an httpOnly cookie", async () => {
    await createUser({
      email: "user@example.com",
      password: "Secret123!",
      username: "standarduser",
      roles: ["acheteur", "vendeur"],
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "user@example.com", password: "Secret123!" });

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.roles).toEqual(
      expect.arrayContaining(["acheteur", "vendeur"])
    );
    expect(res.body.username).toBe("standarduser");
    expect(res.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringMatching(/^token=/)])
    );
    expect(JSON.stringify(res.body)).not.toMatch(/password|Secret123/i);
  });

  it("logs in an administrator", async () => {
    await createUser({
      email: "admin@example.com",
      password: "AdminPass1!",
      username: "adminuser",
      roles: ["admin"],
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@example.com", password: "AdminPass1!" });

    expect(res.statusCode).toBe(200);
    expect(res.body.roles).toContain("admin");
  });

  it("rejects invalid credentials", async () => {
    await createUser({
      email: "user@example.com",
      password: "Secret123!",
      username: "standarduser",
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "user@example.com", password: "wrong-password" });

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBeTruthy();
    expect(res.body).not.toHaveProperty("token");
  });

  it("rejects unknown email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "missing@example.com", password: "whatever" });

    expect(res.statusCode).toBe(404);
    expect(res.body).not.toHaveProperty("token");
  });

  it("rejects missing fields", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = "test-jwt-secret-auth";
    }
  });

  it("returns the authenticated user from cookie", async () => {
    const user = await createUser({
      email: "me@example.com",
      password: "Secret123!",
      username: "meuser",
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "me@example.com", password: "Secret123!" });

    const cookie = login.headers["set-cookie"];
    const res = await request(app).get("/api/auth/me").set("Cookie", cookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(user._id.toString());
    expect(res.body.roles).toEqual(
      expect.arrayContaining(["acheteur", "vendeur"])
    );
  });

  it("rejects unauthenticated access", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.statusCode).toBe(401);
  });
});

describe("Admin authorization boundaries", () => {
  beforeEach(() => {
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = "test-jwt-secret-auth";
    }
  });

  it("allows administrator access to /api/admin/users", async () => {
    await createUser({
      email: "admin@example.com",
      password: "AdminPass1!",
      username: "adminuser",
      roles: ["admin"],
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@example.com", password: "AdminPass1!" });

    const res = await request(app)
      .get("/api/admin/users")
      .set("Cookie", login.headers["set-cookie"]);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("forbids standard users from /api/admin/users", async () => {
    await createUser({
      email: "user@example.com",
      password: "Secret123!",
      username: "standarduser",
      roles: ["acheteur", "vendeur"],
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "user@example.com", password: "Secret123!" });

    const res = await request(app)
      .get("/api/admin/users")
      .set("Cookie", login.headers["set-cookie"]);

    expect(res.statusCode).toBe(403);
  });

  it("rejects admin routes without a session cookie", async () => {
    const res = await request(app).get("/api/admin/users");
    expect(res.statusCode).toBe(401);
  });

  it("rejects admin routes after cookie/session invalidation", async () => {
    await createUser({
      email: "admin@example.com",
      password: "AdminPass1!",
      username: "adminuser",
      roles: ["admin"],
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@example.com", password: "AdminPass1!" });

    expect(login.statusCode).toBe(200);

    const forged = jwt.sign(
      { id: "000000000000000000000000", roles: ["acheteur"] },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const res = await request(app)
      .get("/api/admin/users")
      .set("Cookie", [`token=${forged}`]);

    expect(res.statusCode).toBe(403);
  });
});

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = "test-jwt-secret-auth";
    }
  });

  it("registers a new user and returns a session token", async () => {
    const res = await request(app).post("/api/auth/register").send({
      firstName: "New",
      lastName: "Seller",
      username: "newseller",
      email: "newseller@example.com",
      phone: "+237600000000",
      country: "Cameroun",
      province: "Littoral",
      city: "Douala",
      password: "Secret123!",
      isSeller: true,
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.roles).toEqual(
      expect.arrayContaining(["acheteur", "vendeur"])
    );
    expect(res.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringMatching(/^token=/)])
    );
  });
});

describe("Supplier Magic Link remains independent of account auth", () => {
  beforeEach(() => {
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = "test-jwt-secret-auth";
    }
  });

  it("does not grant supplier management rights via a Sawaka account cookie", async () => {
    await createUser({
      email: "user@example.com",
      password: "Secret123!",
      username: "standarduser",
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "user@example.com", password: "Secret123!" });

    const res = await request(app)
      .get("/api/suppliers/management")
      .set("Cookie", login.headers["set-cookie"]);

    // Management session requires supplierManagementJwt / dedicated middleware — not user cookie
    expect([401, 403]).toContain(res.statusCode);
  });
});
