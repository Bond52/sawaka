const MagicLinkToken = require("../models/MagicLinkToken");

/**
 * Migrates the legacy non-sparse unique `token_1` index in place.
 *
 * Before token hashing was introduced, every token persisted a plaintext
 * `token` value. Hashed tokens deliberately omit that field. A legacy
 * non-sparse unique index therefore accepts one omitted value and rejects all
 * later tokens with a duplicate-key error. Keeping the index sparse preserves
 * uniqueness for legacy plaintext tokens while allowing hashed-only tokens.
 *
 * @returns {Promise<boolean>} Whether a legacy index was migrated.
 */
async function ensureMagicLinkTokenIndexCompatibility() {
  const collection = MagicLinkToken.collection;
  let indexes;
  try {
    indexes = await collection.indexes();
  } catch (err) {
    // A fresh database has no collection yet. Mongoose creates its declared
    // sparse indexes when the collection is first used.
    if (err && (err.code === 26 || err.codeName === "NamespaceNotFound")) {
      return false;
    }
    throw err;
  }
  const tokenIndex = indexes.find(
    (index) =>
      index &&
      index.name === "token_1" &&
      index.key &&
      index.key.token === 1
  );

  if (!tokenIndex || tokenIndex.sparse) {
    return false;
  }

  await collection.dropIndex(tokenIndex.name);
  await collection.createIndex(
    { token: 1 },
    {
      name: tokenIndex.name,
      unique: true,
      sparse: true,
    }
  );

  return true;
}

module.exports = { ensureMagicLinkTokenIndexCompatibility };
