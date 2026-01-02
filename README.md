[![Latest Release](https://img.shields.io/github/v/release/Bond52/sawaka)](https://github.com/Bond52/sawaka/releases)

# 🧺 Sawaka — Artisans Social Network (Open Source)

Sawaka is an open-source platform designed to connect local artisans with their communities.  
It is built on a modern, scalable architecture using **Next.js**, **Node.js/Express**, and **MongoDB**, with a focus on simplicity, performance, and extensibility.

---

## ✨ Key Features

- 🧑‍🎨 Artisan management (profiles, photos, categories)
- 🛒 Product and service management
- 👤 Authentication system (JWT)
- 🖼️ Image uploads (Cloudinary)
- 📦 REST API powered by Node.js and Express
- 🌐 Recommended deployment: **Vercel** (frontend) + **Render** (backend)

---

## 📘 Project Vision

The project vision is documented in the GitHub Wiki:  
👉 https://github.com/Bond52/sawaka/wiki/Vision-Document

This vision serves as a reference for:
- Epics definition
- Backlog prioritization
- Functional and technical decisions

---

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/Bond52/sawaka.git
cd sawaka
```

---

### 2. Install dependencies

#### 🔹 Frontend (Next.js – root folder)

```bash
npm install
```

#### 🔹 Backend (Node.js / Express API)

```bash
cd backend-api
npm install
```

---

## 🛠️ Environment Variables

To run the project locally or in production, create the following environment files.

---

### 🔧 Backend (`backend-api/.env`)

```ini
PORT=5000
MONGO_URI=...
JWT_SECRET=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

---

## 🌐 API Environments

- **Production**: https://sawaka-api-prod.onrender.com  
- **QA**: https://sawaka-api-qa.onrender.com  

---

### 🌐 Frontend (`.env.local`)

```ini
NEXT_PUBLIC_API_URL=https://sawaka-api-prod.onrender.com
```

⚠️ Never commit `.env` files to GitHub.

---

## 📐 Diagrams & Architecture

Architecture diagrams (system architecture, flows, data models) are created using **draw.io (diagrams.net)**  
and stored in the `/docs/diagrams` directory.

---

## ✅ Definition of Done (DoD)

An issue, task, or user story is considered **Done** when all of the following conditions are met:

- Code is implemented according to acceptance criteria
- Code is committed to the correct branch following the branching strategy
- No regression is introduced on desktop or mobile
- Responsive behavior is validated (mobile / tablet / desktop)
- Application builds successfully without errors
- Feature or fix is deployed to the QA environment
- No blocking or critical bug remains open
- Documentation is updated when applicable

This Definition of Done applies to all work items across the Sawaka project.

---

## 🤝 Contributing

All contributions are welcome!  
Please read first:

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

Additional guidelines are available in the Wiki:
- Definition of Ready
- Coding standards
- Workflow (issues, pull requests, reviews)

---

## 🌳 Branching Strategy

- `main` → production-ready code
- `qa` → integration and testing
- `feature/*` → new features
- `fix/*` → bug fixes
- `hotfix/*` → urgent production fixes
