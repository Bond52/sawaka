import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCompletedOn,
  parsePublicRealizations,
  publicRealizationsUrl,
} from "./publicRealizations.ts";

const published = {
  id: "pub-1",
  sequence: 2,
  description: "Table en bois",
  domainId: "wood",
  completedOn: "2024-06-02",
  images: [
    { url: "https://images.example/a.jpg", publicId: "secret-a" },
    { url: "https://images.example/b.jpg", publicId: "secret-b" },
    { url: "https://images.example/c.jpg" },
    { url: "https://images.example/d.jpg" },
  ],
  title: "Must not become a field",
  email: "owner@example.com",
};

test("parsePublicRealizations keeps one item when a realization has several photos", () => {
  const items = parsePublicRealizations({
    realizations: [
      published,
      {
        id: "pub-2",
        sequence: 3,
        description: "",
        domainId: null,
        completedOn: null,
        images: [{ url: "https://images.example/one.jpg" }],
      },
    ],
  });
  assert.ok(items);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], {
    id: "pub-1",
    sequence: 2,
    description: "Table en bois",
    domainId: "wood",
    completedOn: "2024-06-02",
    imageUrls: [
      "https://images.example/a.jpg",
      "https://images.example/b.jpg",
      "https://images.example/c.jpg",
      "https://images.example/d.jpg",
    ],
  });
  assert.equal("title" in items[0], false);
  assert.equal(items[1].domainId, null);
  assert.equal(items[1].completedOn, null);
  assert.equal(items[1].description, "");
});

test("parsePublicRealizations drops drafts and rejects product payloads", () => {
  const items = parsePublicRealizations({
    realizations: [
      {
        id: "draft-1",
        sequence: 1,
        description: "Brouillon secret",
        domainId: null,
        completedOn: null,
        status: "draft",
        images: [{ url: "https://images.example/draft.jpg", publicId: "draft-secret" }],
      },
      { ...published, status: "published" },
    ],
  });
  assert.ok(items);
  assert.deepEqual(
    items.map((item) => item.id),
    ["pub-1"]
  );
  assert.equal(JSON.stringify(items).includes("Brouillon secret"), false);
  assert.equal(JSON.stringify(items).includes("publicId"), false);
  assert.equal(parsePublicRealizations({ articles: [] }), null);
  assert.equal(parsePublicRealizations({ realizations: [{ title: "Chaise" }] }), null);
  assert.deepEqual(parsePublicRealizations({ realizations: [] }), []);
});

test("publicRealizationsUrl stays on the public contributor route", () => {
  assert.equal(
    publicRealizationsUrl("http://api.test/", "profile-1"),
    "http://api.test/api/contributors/profile-1/realizations"
  );
  assert.equal(publicRealizationsUrl("http://api.test", "me"), null);
  assert.equal(publicRealizationsUrl("http://api.test", "  "), null);
});

test("formatCompletedOn follows the locale and omits invalid dates", () => {
  assert.match(formatCompletedOn("2024-06-02", "en"), /2024/);
  assert.match(formatCompletedOn("2024-06-02", "fr"), /2024/);
  assert.equal(formatCompletedOn("2024-02-31", "en"), "");
  assert.equal(formatCompletedOn("", "fr"), "");
});
