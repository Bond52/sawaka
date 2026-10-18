import assert from "node:assert/strict";
import test from "node:test";
import {
  filterPortfolioRealizations,
  parseOwnedRealizations,
  type PortfolioRealization,
} from "./portfolioRealizations.ts";

const chair: PortfolioRealization = {
  id: "1",
  sequence: 1,
  status: "published",
  title: "Table basse",
  description: "Chaise en noyer",
  domainId: "wood",
  completedOn: "2024-05-01",
  mainMaterial: "Noyer",
  imageCount: 2,
  imageUrl: "https://images.example/chair.jpg",
};

const draft: PortfolioRealization = {
  id: "2",
  sequence: 2,
  status: "draft",
  title: "",
  description: "Brouillon secret",
  domainId: null,
  completedOn: null,
  mainMaterial: "",
  imageCount: 0,
  imageUrl: null,
};

test("parseOwnedRealizations keeps drafts and the first stored image", () => {
  const items = parseOwnedRealizations({
    realizations: [
      {
        id: "1",
        clientGroupId: "group-1",
        sequence: 1,
        title: "Table basse",
        description: "Chaise en noyer",
        domainId: "wood",
        completedOn: "2024-05-01",
        mainMaterial: "Noyer",
        status: "published",
        images: [
          { url: "https://images.example/chair.jpg" },
          { url: "https://images.example/detail.jpg" },
        ],
        publicId: "must-not-be-copied",
      },
      {
        id: "2",
        sequence: 2,
        description: "Brouillon secret",
        domainId: null,
        completedOn: null,
        status: "draft",
        images: [],
      },
    ],
  });
  assert.deepEqual(items, [chair, draft]);
});

test("parseOwnedRealizations rejects product inventory and a public-only shape", () => {
  assert.equal(parseOwnedRealizations({ items: [], total: 0 }), null);
  assert.equal(parseOwnedRealizations({ articles: [] }), null);
  assert.equal(
    parseOwnedRealizations({
      realizations: [{ id: "1", title: "Chaise", status: "published" }],
    }),
    null
  );
});

test("filterPortfolioRealizations searches title, description, and category", () => {
  const items = [chair, draft];
  const label = (item: PortfolioRealization) => (item.domainId === "wood" ? "Menuiserie" : "");
  assert.deepEqual(
    filterPortfolioRealizations(items, { query: "noyer", status: "", domainId: "" }, label).map((item) => item.id),
    ["1"]
  );
  assert.deepEqual(
    filterPortfolioRealizations(items, { query: "table basse", status: "", domainId: "" }, label).map((item) => item.id),
    ["1"]
  );
  assert.deepEqual(
    filterPortfolioRealizations(items, { query: "menuiserie", status: "", domainId: "" }, label).map((item) => item.id),
    ["1"]
  );
  assert.deepEqual(
    filterPortfolioRealizations(items, { query: "titre inventé", status: "", domainId: "" }, label),
    []
  );
  assert.deepEqual(
    filterPortfolioRealizations(items, { query: "", status: "draft", domainId: "" }, label).map((item) => item.id),
    ["2"]
  );
  assert.deepEqual(
    filterPortfolioRealizations(items, { query: "", status: "", domainId: "wood" }, label).map((item) => item.id),
    ["1"]
  );
});
