# CI Pipeline Diagnosis

## Summary

The Sawaka CI workflow (`.github/workflows/ci.yml`) runs Jest, Newman, and Playwright but was **unstable or failing** due to missing services, wrong assumptions about running servers, and absent steps (lint, docs, build).

## Root Causes

### 1. Jest (Backend) — **Failing**
- **Issue:** `products.test.js` hits `GET /api/products`, which uses `Product.find()`. MongoDB is **never connected** in test/CI (`index.js` skips `connectMongo` when `NODE_ENV=test` or `CI=true`). Mongoose operations therefore fail or hang.
- **Evidence:** `connectMongo` returns early in test/CI; no Jest setup connects Mongoose.
- **Fix:** Use a **MongoDB service container** in GHA, add a **Jest setup file** that connects Mongoose to `MONGO_URI` before tests, and run Jest with `--runInBand` so a single worker shares the connection.

### 2. Newman (API) — **Failing**
- **Issue:** Newman runs against `{{base_url}}/api/products` with `base_url: http://localhost:5000`. The **API server is never started** in CI, so Newman connects to nothing.
- **Evidence:** Workflow has no “start API” step; Postman env points to localhost:5000.
- **Fix:** Start the backend API server in the background (with `MONGO_URI` from the service container and `JWT_SECRET` set) **before** running Newman. Use `wait-on` or a simple poll to ensure the server is ready.

### 3. Playwright (Frontend) — **Failing**
- **Issue:** Playwright uses `baseURL: http://localhost:3000` and visits `/`. The **Next.js dev server is never started**, so Playwright hits nothing.
- **Evidence:** No “start Next.js” step in the workflow; `homepage.spec.ts` navigates to `/`.
- **Fix:** Start the Next.js dev server in the background before Playwright, then wait for `http://localhost:3000` to be ready (e.g. `wait-on`) and run Playwright.

### 4. Lint — **Not run**
- **Issue:** Frontend has `npm run lint` (Next.js lint), but the workflow does not run it.
- **Fix:** Add a lint step (e.g. `npm run lint` at repo root) and fix any lint failures.

### 5. Build — **Not run**
- **Issue:** DoD requires “Application builds successfully”. The workflow does not run `npm run build`.
- **Fix:** Add a build step for the frontend (`npm run build`) to ensure the app builds.

### 6. Documentation generation — **Not run / missing**
- **Issue:** “Docs generation” is in scope, but the workflow does not run it. Backend has no docs scripts in `package.json`.
- **Fix:** Add minimal docs generation (e.g. JSDoc or a no-op script) to the backend and a CI step that runs it, so “docs generation passes” without breaking CI.

### 7. Environment & secrets
- **Issue:** `MONGO_URI` is taken from `secrets.MONGO_URI_TEST`. Using a **service container** makes CI self-contained and reproducible; we can use a fixed `MONGO_URI` for the container instead of a secret.
- **Fix:** Add a MongoDB service container, set `MONGO_URI` (and optionally `JWT_SECRET`) in the workflow env, and use these when running the API and Jest.

### 8. npm cache & install
- **Issue:** `cache: 'npm'` with a single lockfile path may not cache both root and `backend-api` correctly. Workflow uses `npm install`; `npm ci` is better for reproducible CI.
- **Fix:** Use `npm ci` where lockfiles exist, and align cache paths if we cache both root and backend.

### 9. Triggers
- **Current:** `push` / `pull_request` on `main` and `qa`. No issue.
- **No change needed** to triggers.

## Files Modified

| File | Change |
|------|--------|
| `.github/workflows/ci.yml` | MongoDB service; env vars; install order (frontend first for wait-on/newman); combined API+Newman and Next+Playwright steps; lint; build; docs |
| `backend-api/jest.config.js` | `setupFilesAfterEnv`, `testTimeout` |
| `backend-api/jest.setup.js` | **New.** Connect Mongoose to `MONGO_URI` before tests, disconnect after |
| `backend-api/index.js` | Connect MongoDB when running as main module in CI (for Newman) if `MONGO_URI` set |
| `backend-api/package.json` | `docs:generate` script, `jsdoc` devDep, test script `--runInBand` |
| `backend-api/jsdoc.json` | **New.** Minimal JSDoc config for routes, models, middleware |
| `package.json` | `wait-on`, `eslint-config-next` devDeps |
| `.eslintrc.json` | **New.** `extends: "next/core-web-vitals"` for non-interactive lint |
| `app/acheteur/page.tsx` | Fix unescaped `'` (lint) |
| `app/amelioration/page.tsx` | Fix unescaped `'` (lint) |
| `app/components/home/HeroSection.tsx` | Fix unescaped `'` (lint) |
| `.gitignore` | `backend-api/docs` |

## Final Checklist (DoD)

- [ ] **Jest** passes (MongoDB service + `jest.setup.js` + `--runInBand`)
- [ ] **Newman** passes (API started with Mongo + env, then `wait-on` + Newman)
- [ ] **Playwright** passes (Next.js `npm run start`, then `wait-on` + Playwright)
- [ ] **Lint** passes (`npm run lint` with `.eslintrc.json` + fixes for `react/no-unescaped-entities`)
- [ ] **Build** passes (`npm run build`)
- [ ] **Docs generation** passes (`npm run docs:generate` in backend-api)

## Determinism & Reproducibility

- Use **MongoDB service container** (no external MongoDB secret required for CI).
- Use **fixed `JWT_SECRET`** in CI.
- Use **`npm ci`** where lockfiles exist.
- Run Jest with **`--runInBand`** for a single worker.
- Start API and Next.js **in CI**, then run Newman and Playwright against them.
