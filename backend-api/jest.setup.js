/**
 * Jest setup: connect Mongoose to MongoDB before running tests.
 * CI provides MONGO_URI via workflow env (MongoDB service container).
 * Required so GET /api/products and other DB-dependent tests can run.
 */
const mongoose = require("mongoose");

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/sawaka_test";

beforeAll(async () => {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });
}, 15000);

afterAll(async () => {
  await mongoose.disconnect();
});
