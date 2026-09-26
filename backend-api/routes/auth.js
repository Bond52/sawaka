const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt"); // si souci Node v22, switch vers bcryptjs
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const {
  createUserAccount,
  issueSessionToken,
  sessionCookieOptions,
  AccountRegistrationError,
  ACCOUNT_FIELDS_REQUIRED,
  ACCOUNT_ALREADY_EXISTS,
} = require("../services/accountRegistration");

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe requis" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Mot de passe invalide" });

    // ⚠️ utiliser _id et pas id
    const token = jwt.sign(
      { id: user._id.toString(), roles: user.roles },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res
      .cookie("token", token, { httpOnly: true, sameSite: "none", secure: true })
      .json({
        token,
        roles: user.roles,
        username: user.username,  // ✅ Ajouté
        firstName: user.firstName,
        lastName: user.lastName
      });
  } catch (err) {
    console.error("❌ Erreur dans /login :", err);
    res.status(500).json({ error: "Erreur serveur", details: err.message });
  }
});

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const {
      firstName, lastName, username, email, phone,
      country, province, city, pickupPoint,
      isSeller, commerceName, neighborhood, idCardImage,
      password
    } = req.body;

    let user;
    try {
      user = await createUserAccount(
        {
          firstName,
          lastName,
          username,
          email,
          phone,
          country,
          province,
          city,
          pickupPoint,
          commerceName,
          neighborhood,
          idCardImage,
          password,
        },
        { isSeller }
      );
    } catch (err) {
      if (err instanceof AccountRegistrationError) {
        if (err.code === ACCOUNT_FIELDS_REQUIRED) {
          return res
            .status(400)
            .json({ error: "Nom d'utilisateur, email et mot de passe requis" });
        }
        if (err.code === ACCOUNT_ALREADY_EXISTS) {
          return res
            .status(400)
            .json({ error: "Email ou nom d'utilisateur déjà utilisé" });
        }
      }
      throw err;
    }

    const token = issueSessionToken(user);

    res
      .cookie("token", token, sessionCookieOptions())
      .status(201)
      .json({
        message: "Utilisateur créé avec succès",
        token,
        roles: user.roles,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName
      });
  } catch (err) {
    console.error("❌ Erreur dans /register :", err);
    res.status(500).json({ error: "Erreur serveur", details: err.message });
  }
});

// ================================================
// 🔍 ME — Retourne l'utilisateur connecté
// ================================================
router.get("/me", (req, res) => {
  try {
    const bearer = req.headers.authorization;
    const headerToken =
      bearer && bearer.startsWith("Bearer ")
        ? bearer.split(" ")[1]
        : null;

    const cookieToken = req.cookies?.token;
    const token = headerToken || cookieToken;

    if (!token) return res.status(401).json({ error: "Non connecté" });

    const user = jwt.verify(token, process.env.JWT_SECRET);

    return res.json(user);
  } catch (err) {
    return res.status(401).json({ error: "Token invalide" });
  }
});

module.exports = router;
