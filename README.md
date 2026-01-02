[![Latest Release](https://img.shields.io/github/v/release/Bond52/sawaka)](https://github.com/Bond52/sawaka/releases)

# Sawaka — Artisans Social Network (Open Source)

Sawaka is an open-source platform that connects local artisans with their communities. It is built with **Next.js** (frontend), **Node.js / Express** (API), and **MongoDB**, with a focus on simplicity, performance, and extensibility.

---

## Features

- Artisan profiles, photos, and categories
- Product and service management
- JWT-based authentication
- Image uploads (Cloudinary)
- REST API (Node.js + Express)
- Recommended deployment: **Vercel** (frontend) + **Render** (backend)

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/Bond52/sawaka.git
cd sawaka
```

### 2. Install dependencies

**Frontend (root):**

```bash
npm install
```

**Backend:**

```bash
cd backend-api
npm install
cd ..
```

### 3. Environment variables

Create `backend-api/.env`:

```ini
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Create `.env.local` in the project root (for the Next.js app):

```ini
NEXT_PUBLIC_API_URL=https://sawaka-api-prod.onrender.com
```

For local development, use `http://localhost:5000` if the API runs locally.

Do **not** commit `.env` or `.env.local`.

### 4. Run the app

**Terminal 1 — API:**

```bash
cd backend-api && npm run dev
```

**Terminal 2 — Frontend:**

```bash
npm run dev
```

- Frontend: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:5000](http://localhost:5000)

See [backend-api/README.md](backend-api/README.md) for API-specific scripts and layout.

---

## Running tests locally

### Backend (Jest)

Requires a running MongoDB instance (local or cloud). Set `MONGO_URI` in `backend-api/.env`.

```bash
cd backend-api
npm test
```

### Frontend — Lint & build

```bash
npm run lint
npm run build
```

### Frontend — Playwright (E2E)

Build the app, then run Playwright:

```bash
npm run build
npm run start &
npx wait-on -t 60000 http://localhost:3000/
npx playwright test
```

### API — Newman (Postman)

Start the API first, then run the collection:

```bash
cd backend-api && node index.js &
npx wait-on -t 30000 http://localhost:5000/
npx newman run tests/api/postman/sawaka.postman_collection.json \
  -e tests/api/postman/sawaka.postman_environment.json
```

---

## CI and Definition of Done

**GitHub Actions is the executable Definition of Done (DoD).** The [Sawaka CI](.github/workflows/ci.yml) workflow runs on every push and pull request to `main` and `qa`. A pull request is considered **Done** only when all required checks pass.

### Required checks

All of the following must succeed:

| Check | Description |
|-------|-------------|
| **Tests** | **Jest** (backend), **Newman** (API), **Playwright** (frontend E2E) |
| **Lint** | `npm run lint` (Next.js ESLint) |
| **Build** | `npm run build` (Next.js) |
| **Documentation** | `npm run docs:generate` (JSDoc in `backend-api`) |

### Branch protection

Branch protection rules enforce these quality gates: the configured branches (e.g. `main`, `qa`) require that CI succeeds before a PR can be merged. No merge without passing checks.

### Definition of Done (summary)

A task or PR is **Done** when:

- Acceptance criteria are met
- Code is on the correct branch (`main` / `qa` / `feature/*` / `fix/*`)
- **All required CI checks pass** (tests, lint, build, documentation generation)
- No regressions on desktop or mobile
- Documentation is updated when relevant

**Workflow:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml). See [docs/CI_DIAGNOSIS.md](docs/CI_DIAGNOSIS.md) for CI design and troubleshooting.

---

## Documentation

### JSDoc (backend)

The backend uses **JSDoc** for code-level documentation (routes, models, middleware).

**Generate:**

```bash
cd backend-api
npm run docs:generate
```

**Output:** `backend-api/docs/jsdoc/`. Open `backend-api/docs/jsdoc/index.html` in a browser.

JSDoc is also generated in CI. The `backend-api/docs` directory is gitignored.

### API environments

- **Production:** [https://sawaka-api-prod.onrender.com](https://sawaka-api-prod.onrender.com)
- **QA:** [https://sawaka-api-qa.onrender.com](https://sawaka-api-qa.onrender.com)

### Project Vision

The project vision is documented in the GitHub Wiki: [Vision Document](https://github.com/Bond52/sawaka/wiki/Vision-Document). It serves as a reference for epics, backlog prioritization, and functional decisions.

### Diagrams

Architecture and flow diagrams (e.g. draw.io) can be stored in `docs/diagrams` when added.

---

## Contributing

We welcome contributions. Please read:

- [CONTRIBUTING.md](CONTRIBUTING.md) — How to contribute, branch strategy, quality standards
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — Community guidelines

**Onboarding path:**

1. Fork the repo, clone, install dependencies, set up env (see Quick Start).
2. Create a branch: `feature/my-feature` or `fix/my-fix`.
3. Make changes, run tests and lint locally.
4. Open a pull request against `main` or `qa`. Ensure CI passes.
5. Follow review feedback and update as needed.

Additional guidelines (Definition of Ready, coding standards, PR workflow) are in the [Wiki](https://github.com/Bond52/sawaka/wiki).

---

## Branching

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code |
| `qa` | Integration and testing |
| `feature/*` | New features |
| `fix/*` | Bug fixes |
| `hotfix/*` | Urgent production fixes |

---

## License and links

- **License:** See [LICENSE](LICENSE)
- **Security:** [SECURITY.md](SECURITY.md)
