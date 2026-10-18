import assert from "node:assert/strict";
import test from "node:test";
import { formatCompletedMonth, parseRealizationDetail } from "./realizationDetail.ts";

const DOMAIN = { id: "domain-wood", nameFR: "Menuiserie", nameEN: "Carpentry" };

function payload(overrides: Record<string, unknown> = {}) {
  return {
    realization: {
      id: "507f1f77bcf86cd799439011",
      description: "Table en chêne",
      domainId: DOMAIN.id,
      domain: DOMAIN,
      completedOn: "2024-03-12",
      mainMaterial: "Chêne blanc",
      images: [{ url: "https://cdn.example/1.jpg" }, { url: "https://cdn.example/2.jpg" }],
      ...overrides,
    },
    contributor: {
      id: "profile-amina",
      displayName: "Amina Diallo",
      photoUrl: null,
      city: "Douala",
      region: "Littoral",
      country: "Cameroon",
      domain: DOMAIN,
    },
  };
}

test("parses a published realization and keeps image order", () => {
  const detail = parseRealizationDetail(payload());
  assert.ok(detail);
  assert.deepEqual(detail.imageUrls, ["https://cdn.example/1.jpg", "https://cdn.example/2.jpg"]);
  assert.equal(detail.mainMaterial, "Chêne blanc");
  assert.equal(detail.description, "Table en chêne");
  assert.equal(detail.domain?.nameFR, "Menuiserie");
  assert.equal(detail.completedOn, "2024-03-12");
  assert.equal(detail.contributor.displayName, "Amina Diallo");
  assert.equal("email" in detail, false);
  assert.equal("email" in detail.contributor, false);
});

test("treats a missing main material as empty text", () => {
  const body = payload();
  delete (body.realization as { mainMaterial?: string }).mainMaterial;
  const detail = parseRealizationDetail(body);
  assert.ok(detail);
  assert.equal(detail.mainMaterial, "");
});

test("rejects a product payload and a response without a contributor", () => {
  assert.equal(parseRealizationDetail({ products: [{ title: "Table" }] }), null);
  assert.equal(parseRealizationDetail({ realization: payload().realization }), null);
});

test("drops private contributor fields instead of copying them", () => {
  const body = payload();
  (body.contributor as { email?: string }).email = "amina@example.com";
  const detail = parseRealizationDetail(body);
  assert.ok(detail);
  assert.equal(JSON.stringify(detail).includes("amina@example.com"), false);
});

test("rejects an invalid completion date", () => {
  assert.equal(parseRealizationDetail(payload({ completedOn: "2024-13-40" })), null);
});

test("formats the completion month without shifting the day", () => {
  assert.match(formatCompletedMonth("2024-03-12", "fr"), /mars 2024/i);
  assert.match(formatCompletedMonth("2024-03-12", "en"), /March 2024/);
  assert.equal(formatCompletedMonth("", "en"), "");
});
