jest.mock("../../models/MagicLinkToken");

const MagicLinkToken = require("../../models/MagicLinkToken");
const {
  ensureMagicLinkTokenIndexCompatibility,
} = require("../../services/MagicLinkTokenIndexService");

describe("ensureMagicLinkTokenIndexCompatibility", () => {
  beforeEach(() => {
    MagicLinkToken.collection = {
      indexes: jest.fn(),
      dropIndex: jest.fn(),
      createIndex: jest.fn(),
    };
  });

  it("replaces the legacy non-sparse token index without removing uniqueness", async () => {
    MagicLinkToken.collection.indexes.mockResolvedValue([
      { name: "_id_", key: { _id: 1 } },
      { name: "token_1", key: { token: 1 }, unique: true },
    ]);

    await expect(ensureMagicLinkTokenIndexCompatibility()).resolves.toBe(true);

    expect(MagicLinkToken.collection.dropIndex).toHaveBeenCalledWith("token_1");
    expect(MagicLinkToken.collection.createIndex).toHaveBeenCalledWith(
      { token: 1 },
      { name: "token_1", unique: true, sparse: true }
    );
  });

  it("leaves the current sparse token index unchanged", async () => {
    MagicLinkToken.collection.indexes.mockResolvedValue([
      { name: "token_1", key: { token: 1 }, unique: true, sparse: true },
    ]);

    await expect(ensureMagicLinkTokenIndexCompatibility()).resolves.toBe(false);

    expect(MagicLinkToken.collection.dropIndex).not.toHaveBeenCalled();
    expect(MagicLinkToken.collection.createIndex).not.toHaveBeenCalled();
  });

  it("skips migration when the collection has not been created yet", async () => {
    MagicLinkToken.collection.indexes.mockRejectedValue({
      code: 26,
      codeName: "NamespaceNotFound",
    });

    await expect(ensureMagicLinkTokenIndexCompatibility()).resolves.toBe(false);

    expect(MagicLinkToken.collection.dropIndex).not.toHaveBeenCalled();
    expect(MagicLinkToken.collection.createIndex).not.toHaveBeenCalled();
  });
});
