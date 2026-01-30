#!/usr/bin/env node

/**
 * Generates a fully static Swagger UI site from swagger.json,
 * suitable for GitHub Pages.
 *
 * Output: backend-api/docs/api-docs/
 *   - index.html
 *   - swagger.json
 *
 * Usage:
 *   node scripts/generate-swagger-ui.js [path/to/swagger.json]
 *
 * If no input path is given, looks for:
 *   - docs/swagger/swagger.json
 *   - swagger.json (in backend-api root)
 *
 * If swagger.json is not found, creates a minimal placeholder spec.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "docs", "api-docs");
const DEFAULT_INPUT_PATHS = [
  path.join(ROOT, "docs", "swagger", "swagger.json"),
  path.join(ROOT, "swagger.json"),
];

const SWAGGER_UI_VERSION = "5.11.0";
const CDN_BASE = `https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}`;

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sawaka API Documentation</title>
  <link rel="stylesheet" href="${CDN_BASE}/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${CDN_BASE}/swagger-ui-bundle.js" crossorigin></script>
  <script src="${CDN_BASE}/swagger-ui-standalone-preset.js" crossorigin></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: "./swagger.json",
        dom_id: "#swagger-ui",
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>
`;

function findSwaggerJson(explicitPath) {
  if (explicitPath) {
    const p = path.isAbsolute(explicitPath) ? explicitPath : path.join(ROOT, explicitPath);
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  }
  for (const p of DEFAULT_INPUT_PATHS) {
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  }
  return null;
}

function getPlaceholderSpec() {
  return JSON.stringify(
    {
      openapi: "3.0.0",
      info: {
        title: "Sawaka API",
        version: "1.0.0",
        description: "Add swagger.json to backend-api/docs/swagger/ or run swagger-jsdoc to generate the full spec."
      },
      paths: {}
    },
    null,
    2
  );
}

function main() {
  const explicitPath = process.argv[2];
  let specStr = findSwaggerJson(explicitPath);

  if (!specStr) {
    console.warn("⚠ swagger.json not found. Using placeholder spec.");
    console.warn("  To use a real spec: place swagger.json in backend-api/docs/swagger/");
    console.warn("  or pass a path: node scripts/generate-swagger-ui.js path/to/swagger.json");
    specStr = getPlaceholderSpec();
  }

  try {
    JSON.parse(specStr);
  } catch (e) {
    console.error("❌ Invalid JSON in swagger spec:", e.message);
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "index.html"), INDEX_HTML, "utf8");
  fs.writeFileSync(path.join(OUTPUT_DIR, "swagger.json"), specStr, "utf8");

  console.log("✅ Static Swagger UI site generated");
  console.log(`   Output: ${OUTPUT_DIR}`);
  console.log(`   Open: ${path.join(OUTPUT_DIR, "index.html")}`);
}

main();
