const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user");

const ACCOUNT_FIELDS_REQUIRED = "ACCOUNT_FIELDS_REQUIRED";
const ACCOUNT_ALREADY_EXISTS = "ACCOUNT_ALREADY_EXISTS";

class AccountRegistrationError extends Error {
  constructor(code) {
    super(code);
    this.name = "AccountRegistrationError";
    this.code = code;
  }
}

/**
 * Shared account creation used by POST /api/auth/register and contributor onboarding.
 * Does not force the seller role. Callers pass isSeller explicitly.
 */
async function createUserAccount(input = {}, options = {}) {
  const username = typeof input.username === "string" ? input.username : "";
  const email = typeof input.email === "string" ? input.email : "";
  const password = typeof input.password === "string" ? input.password : "";

  if (!username || !email || !password) {
    throw new AccountRegistrationError(ACCOUNT_FIELDS_REQUIRED);
  }

  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) {
    throw new AccountRegistrationError(ACCOUNT_ALREADY_EXISTS);
  }

  const isSeller = Boolean(options.isSeller);
  const roles = ["acheteur"];
  if (isSeller) roles.push("vendeur");

  const hash = await bcrypt.hash(password, 10);

  try {
    return await User.create({
      firstName: input.firstName || "",
      lastName: input.lastName || "",
      username,
      email,
      phone: input.phone || "",
      country: input.country || "",
      province: input.province || "",
      city: input.city || "",
      pickupPoint: input.pickupPoint || "",
      isSeller,
      commerceName: input.commerceName || "",
      neighborhood: input.neighborhood || "",
      idCardImage: input.idCardImage || "",
      password: hash,
      roles,
    });
  } catch (err) {
    if (err && err.code === 11000) {
      throw new AccountRegistrationError(ACCOUNT_ALREADY_EXISTS);
    }
    throw err;
  }
}

function issueSessionToken(user) {
  return jwt.sign(
    { id: user._id.toString(), roles: user.roles },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function sessionCookieOptions() {
  return { httpOnly: true, sameSite: "none", secure: true };
}

module.exports = {
  ACCOUNT_FIELDS_REQUIRED,
  ACCOUNT_ALREADY_EXISTS,
  AccountRegistrationError,
  createUserAccount,
  issueSessionToken,
  sessionCookieOptions,
};
