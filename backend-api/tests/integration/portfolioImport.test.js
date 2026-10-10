const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../../index");
const User = require("../../models/user");
const Article = require("../../models/Article");
const ContributorProfile = require("../../models/ContributorProfile");

function jpeg() {
  const buffer = Buffer.alloc(16, 0);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  return buffer;
}

function png() {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
}

async function account() {
  const hash = await bcrypt.hash("Secret123!", 10);
  await User.create({
    firstName: "Amina",
    lastName: "Diallo",
    username: "amina-import",
    email: "amina-import@example.com",
    password: hash,
    roles: ["acheteur"],
    isSeller: false,
  });
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "amina-import@example.com", password: "Secret123!" });
  return login.headers["set-cookie"];
}

describe("portfolio photo validation", () => {
  it("rejects an unauthenticated validation request", async () => {
    const res = await request(app)
      .post("/api/contributors/me/import-photos/validate")
      .attach("photos", jpeg(), { filename: "chair.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(401);
  });

  it("accepts jpeg and png, rejects svg, and stores nothing", async () => {
    const cookie = await account();
    const articlesBefore = await Article.countDocuments();
    const profilesBefore = await ContributorProfile.countDocuments();

    const res = await request(app)
      .post("/api/contributors/me/import-photos/validate")
      .set("Cookie", cookie)
      .attach("photos", jpeg(), { filename: "chair.jpg", contentType: "image/jpeg" })
      .attach("photos", png(), { filename: "gate.png", contentType: "image/png" })
      .attach("photos", Buffer.from("<svg></svg>"), {
        filename: "icon.svg",
        contentType: "image/svg+xml",
      });

    expect(res.status).toBe(200);
    expect(res.body.accepted.map((item) => item.name).sort()).toEqual(["chair.jpg", "gate.png"]);
    expect(res.body.rejected).toEqual([
      expect.objectContaining({ name: "icon.svg", code: "UNSUPPORTED_IMAGE_TYPE" }),
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(/cloudinary|token|buffer/i);
    expect(await Article.countDocuments()).toBe(articlesBefore);
    expect(await ContributorProfile.countDocuments()).toBe(profilesBefore);
  });

  it("rejects a file larger than the profile image limit", async () => {
    const cookie = await account();
    const big = Buffer.alloc(2 * 1024 * 1024 + 1, 0);
    big[0] = 0xff;
    big[1] = 0xd8;
    big[2] = 0xff;
    const res = await request(app)
      .post("/api/contributors/me/import-photos/validate")
      .set("Cookie", cookie)
      .attach("photos", big, { filename: "big.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.photos).toBe("IMAGE_TOO_LARGE");
    expect(await Article.countDocuments()).toBe(0);
  });
});
