const mongoose = require("mongoose");

const PURPOSE = "USER_EMAIL_VERIFICATION";

const userEmailVerificationTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true },
    purpose: {
      type: String,
      enum: [PURPOSE],
      required: true,
    },
    /** SHA-256 of the normalized account email. The address itself is not stored. */
    boundEmailHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    isUsed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userEmailVerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
userEmailVerificationTokenSchema.index({ userId: 1, purpose: 1, isUsed: 1 });

module.exports = mongoose.model(
  "UserEmailVerificationToken",
  userEmailVerificationTokenSchema
);
module.exports.USER_EMAIL_VERIFICATION = PURPOSE;
