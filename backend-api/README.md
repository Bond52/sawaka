# Sawaka Backend API

Node.js / Express REST API for the Sawaka platform. Handles authentication, products, artisans, orders, and related resources.

---

## Setup

### Install dependencies

```bash
npm install
```

For CI or reproducible installs: `npm ci`.

### Environment variables

Create a `.env` file in this directory:

```ini
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Do not commit `.env`.

---

## Run

**Development (with reload):**

```bash
npm run dev
```

**Production:**

```bash
npm start
```

API base: `http://localhost:5000` (or the configured `PORT`).

---

## Tests

**Jest** (unit/integration):

```bash
npm test
```

Requires MongoDB. Set `MONGO_URI` in `.env` (local or Atlas). CI uses a MongoDB service container; see [../.github/workflows/ci.yml](../.github/workflows/ci.yml).

Watch mode: `npm run test:watch`.

---

## Documentation (JSDoc)

Code-level docs are generated from JSDoc comments in `routes`, `models`, and `middleware`.

**Generate:**

```bash
npm run docs:generate
```

Output: `./docs/jsdoc/`. Open `docs/jsdoc/index.html` in a browser.

Configuration: `jsdoc.json`. The `docs` folder is gitignored.

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Run API (production) |
| `npm run dev` | Run API with nodemon |
| `npm test` | Run Jest tests |
| `npm run test:watch` | Jest watch mode |
| `npm run docs:generate` | Generate JSDoc |

---

## Project layout

- `routes/` — API route handlers
- `models/` — Mongoose models
- `middleware/` — Auth and shared middleware
- `__tests__/` — Jest tests
- `config/` — App config
- `cronJobs/` — Scheduled tasks (e.g. auctions)

---

## Links

- [Root README](../README.md) — Full project setup, CI, and contributing
- [CONTRIBUTING](../CONTRIBUTING.md) — Contribution guidelines
