const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();
const app = express();

// 🔐 Obligatoire pour Render/Vercel (proxy HTTPS)
app.set("trust proxy", 1);

// ======================================================
// 🌍 CONFIGURATION CORS
// ======================================================

// Origines autorisées (PROD + QA + localhost)
const allowedOrigins = [
  "https://ecommerce-web-avec-tailwind.vercel.app", // PROD
  "https://qa.sawaka.org",                           // QA
  "https://sawaka.org",
  "https://www.sawaka.org",
  process.env.FRONTEND_URL,
  "http://localhost:3000",
].filter(Boolean);

// Autoriser automatiquement toutes les URLs de preview Vercel
const vercelPreviewRegex =
  /^https:\/\/ecommerce-web-avec-tailwind-[a-z0-9]+\.vercel\.app$/;

// Ajoute Access-Control-Allow-Credentials AVANT CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});

// CORS dynamique
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // Requêtes internes / tests

      const isAllowed =
        allowedOrigins.includes(origin) || vercelPreviewRegex.test(origin);

      if (isAllowed) return callback(null, origin);

      if (process.env.NODE_ENV !== "test") {
        console.log("❌ Origine CORS refusée :", origin);
      }

      return callback(new Error("Origine non autorisée par CORS : " + origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Préflight OPTIONS automatique
app.options(
  "*",
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      const isAllowed =
        allowedOrigins.includes(origin) || vercelPreviewRegex.test(origin);

      if (isAllowed) return callback(null, origin);

      return callback(new Error("CORS non autorisé"));
    },
    credentials: true,
  })
);

// ======================================================
// 📦 MIDDLEWARES GLOBAUX
// ======================================================

app.use(express.json());
app.use(cookieParser());

// ======================================================
// 🔌 API ROUTES
// ======================================================

// 🔐 Authentification (login, register, refresh, logout)
app.use("/api/auth", require("./routes/auth"));

// 👤 Utilisateurs (profil, préférences, compte)
app.use("/api/user", require("./routes/user"));

// 🛍️ Produits (catalogue, recherche, filtres)
app.use("/api/products", require("./routes/products"));

// 👩🏾‍🎨 Artisans (profils, portfolios, visibilité)
app.use("/api/artisans", require("./routes/artisans"));

// 🧑‍💼 Vendeurs / Articles (gestion produits vendeurs)
app.use("/api/seller", require("./routes/seller.articles.routes"));

// 🛒 Commandes (création, suivi, historique)
app.use("/api/orders", require("./routes/order.routes"));

// 💰 Budgets (plafonds, alertes, suivi dépenses)
app.use("/api/budget", require("./routes/budget.routes"));

// 🧾 Administration (back-office, modération, stats internes)
app.use("/api/admin", require("./routes/admin.routes"));

// 🔨 Outils internes (scripts, helpers, debug)
app.use("/api/tools", require("./routes/tools"));

// 🏭 Fournisseurs (sources produits, partenariats)
app.use("/api/fournisseurs", require("./routes/fournisseurs"));

// 📨 Feedback utilisateurs (avis, signalements)
app.use("/api/feedback", require("./routes/feedback"));

// 📊 Statistiques publiques / internes
app.use("/stats", require("./routes/stats"));

// 🔨 Enchères (création, offres, clôture)
app.use("/api/auction", require("./routes/auction"));


// ======================================================
// ⏱️ CRON JOBS (désactivés en test / CI)
// ======================================================

const isTestOrCI =
  process.env.NODE_ENV === "test" || process.env.CI === "true";

if (!isTestOrCI) {
  const cron = require("node-cron");
  const closeExpiredAuctions = require("./cronJobs/endAuction");

  cron.schedule("*/5 * * * *", closeExpiredAuctions);
}

// ======================================================
// 🔎 ROUTE DE SANTÉ / ROOT
// ======================================================

app.get("/", (_, res) =>
  res.send("🎉 API e-commerce Sawaka opérationnelle !")
);

// ======================================================
// 🔌 CONNEXION MONGODB (SAUF TEST / CI)
// ======================================================

async function connectMongo() {
  if (isTestOrCI) {
    return;
  }

  await mongoose.connect(process.env.MONGO_URI);

  console.log("✅ Connecté à MongoDB");
}

// ======================================================
// 🚀 LANCEMENT DU SERVEUR
// ======================================================

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  connectMongo()
    .then(() => {
      app.listen(PORT, () =>
        console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`)
      );
    })
    .catch((err) => {
      console.error("❌ Erreur MongoDB :", err.message);
      process.exit(1);
    });
}

module.exports = app;
