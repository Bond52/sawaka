/** @type {import('jest').Config} */
module.exports = {
  displayName: "integration",
  rootDir: __dirname,
  testEnvironment: "node",
  testMatch: ["**/*.test.js"],
  setupFilesAfterEnv: ["<rootDir>/setup.integration.js"],
  testTimeout: 120000,
};
