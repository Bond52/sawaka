const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },

    username: { type: String, required: true, unique: true },
    nickname: { type: String, default: "" },

    email: { type: String, required: true, unique: true },
    phone: { type: String, default: "" },

    country: { type: String, default: "" },
    province: { type: String, default: "" },
    city: { type: String, default: "" },
    pickupPoint: { type: String, default: "" },

    // 📌 Avatar / Logo Cloudinary
    avatarUrl: { type: String, default: "" },

    // 👤 Description courte présentée dans le profil
    about: { type: String, default: "" },

    // 🛍️ Espace vendeur
    isSeller: { type: Boolean, default: false },
    commerceName: { type: String, default: "" },
    neighborhood: { type: String, default: "" },
    idCardImage: { type: String, default: "" },

    // 🔐 Authentification
    password: { type: String, required: true },
    /** Account email ownership. Verification workflow is implemented separately. */
    emailVerified: { type: Boolean, default: false },

    // 🎭 Rôles de l'utilisateur
    roles: {
      type: [String],
      enum: ["acheteur", "vendeur", "admin", "livreur"],
      default: ["acheteur"],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
