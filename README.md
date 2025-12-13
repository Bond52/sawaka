[![Latest Release](https://img.shields.io/github/v/release/Bond52/sawaka)](https://github.com/Bond52/sawaka/releases)


# 🧺 Sawaka — African Artisans Social Network (Open Source)

Sawaka is an open-source platform designed to connect local artisans with their communities.
The project provides a modern architecture based on **Next.js**, **Node.js/Express**, and **MongoDB**, with a simple, fast, and extensible design.

## ✨ Key Features
- 🧑‍🎨 Artisan management (profiles, photos, categories)
- 🛒 Product and service management
- 👤 Authentication system (JWT)
- 🖼️ Image uploads (Cloudinary)
- 📦 Node.js API for backend operations
- 🌐 Recommended deployment: **Vercel** (frontend) + **Render** (backend)

---

## 🚀 Quick Start

### 1. Clone the Project

```bash
git clone https://github.com/Bond52/sawaka.git
cd sawaka
```

---

### 2. Install Dependencies

#### 🔹 Frontend (Next.js)

```bash
npm install
```

#### 🔹 Backend (Node.js / Express API)

```bash
cd backend-api
npm install
```

---

## 🛠️ Required Environment Variables

To run the project locally or in production, you must create the following environment files.

---

### 🔧 Backend (`backend-api/.env`)

Create a `.env` file inside the `backend-api` folder:

```ini
PORT=5000
MONGO_URI=...
JWT_SECRET=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

---

### 🌐 Frontend (`.env.local`)

Create a `.env.local` file at the root of the project:

```ini
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

⚠️ Never commit your `.env` files to GitHub.

---

## 🤝 Contributing

All contributions are welcome!
Please read first:

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

---

## 🌳 Branching Strategy

- `main` → production-ready code
- `qa` → integration & testing
- `feature/*` → new features
- `fix/*` → bug fixes
- `hotfix/*` → urgent production fixes

---
