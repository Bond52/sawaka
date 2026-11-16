import assert from "node:assert/strict";
import test from "node:test";
import {
  isApprovedProjectCategory,
  isApprovedProjectCountry,
  normalizeProjectCountry,
  PROJECT_CATEGORY_OPTIONS,
  PROJECT_COUNTRY_OPTIONS,
  projectCategoryLabel,
  projectCountryLabel,
} from "./projectReferenceData.ts";

test("project categories reuse contributor domain slugs without supplier IDs", () => {
  assert.ok(PROJECT_CATEGORY_OPTIONS.length >= 10);
  assert.equal(
    isApprovedProjectCategory("agriculture-livestock-and-agro-processing"),
    true
  );
  assert.equal(isApprovedProjectCategory("construction_materials"), false);
  assert.equal(isApprovedProjectCategory("Agriculture"), false);
  assert.equal(
    projectCategoryLabel("agriculture-livestock-and-agro-processing", "fr"),
    "Agriculture, élevage et transformation agricole"
  );
  assert.equal(
    projectCategoryLabel("agriculture-livestock-and-agro-processing", "en"),
    "Agriculture, Livestock & Agro-processing"
  );
});

test("project countries include Cameroon and Republic of the Congo distinctly", () => {
  const values = PROJECT_COUNTRY_OPTIONS.map((option) => option.value);
  assert.ok(values.includes("CM"));
  assert.ok(values.includes("CG"));
  assert.ok(values.includes("CA"));
  assert.equal(normalizeProjectCountry("Cameroon"), "CM");
  assert.equal(normalizeProjectCountry("Cameroun"), "CM");
  assert.equal(normalizeProjectCountry("Republic of the Congo"), "CG");
  assert.equal(normalizeProjectCountry("République du Congo"), "CG");
  assert.equal(normalizeProjectCountry("Congo"), null);
  assert.equal(normalizeProjectCountry("Democratic Republic of the Congo"), null);
  assert.equal(isApprovedProjectCountry("CG"), true);
  assert.equal(projectCountryLabel("CG", "en"), "Republic of the Congo");
  assert.equal(projectCountryLabel("CG", "fr"), "République du Congo");
});
