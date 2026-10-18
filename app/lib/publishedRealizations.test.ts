import assert from "node:assert/strict";
import test from "node:test";
import { publishedRealizationsUrl } from "./publishedRealizations.ts";

test("publishedRealizationsUrl targets the public catalog", () => {
  assert.equal(
    publishedRealizationsUrl("http://localhost:5000", {}),
    "http://localhost:5000/api/realizations"
  );
  assert.equal(
    publishedRealizationsUrl("http://localhost:5000/", {
      q: "chaise bois",
      domainId: "abc",
    }),
    "http://localhost:5000/api/realizations?q=chaise+bois&domainId=abc"
  );
  const blank = publishedRealizationsUrl("http://localhost:5000", {
    q: "  ",
    domainId: "",
  });
  assert.equal(blank.includes("/me"), false);
  assert.equal(blank.includes("status"), false);
  assert.equal(blank, "http://localhost:5000/api/realizations");
});

