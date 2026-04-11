const mongoose = require("mongoose");

const SupplierSchema = new mongoose.Schema(
  {
    supplierId: { type: String, unique: true, sparse: true },
    name: { type: String, default: "" },

    categories: {
      type: [String],
      default: [],
    },

    country: { type: String, default: "" },
    region: { type: String, default: "" },
    city: { type: String, default: "" },
    address: { type: String, default: "" },
    postalCode: { type: String, default: "" },

    accountEmail: {
      type: String,
      required: true,
      match: [/.+\@.+\..+/, "Invalid account email format"],
    },
    publicEmail: { type: String, default: "" },
    phone: { type: String, required: true, minlength: 6 },
    website: { type: String, default: "" },

    status: {
      type: String,
      enum: ["Invited", "Active", "Deleted"],
      default: "Invited",
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    isVisible: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Supplier", SupplierSchema);
