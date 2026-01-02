# 🧺 Sawaka — Réseau Social des Artisans Africains (Open Source)

Sawaka est une plateforme open source visant à connecter les artisans locaux à leurs communautés.  
Ce projet fournit une architecture moderne basée sur **Next.js**, **Node.js/Express**, et **MongoDB**, avec un design simple, rapide et extensible.

<<<<<<< HEAD
## ✨ Fonctionnalités principales
- 🧑‍🎨 Gestion des artisans (profils, photos, catégories)
- 🛒 Gestion des produits et services
- 👤 Système d’authentification (JWT)
- 🖼️ Upload d’images (Cloudinary)
- 📦 API Node.js pour les opérations backend
- 🌐 Déploiement recommandé : **Vercel** (frontend) + **Render** (backend)

---

## 🚀 Démarrage rapide
=======
# 🧺 Sawaka — Artisans Social Network (Open Source)

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

## Project Vision

The project vision is documented in the GitHub Wiki:
https://github.com/Bond52/sawaka/wiki/Vision-Document

---

## 🚀 Quick Start
>>>>>>> 303064a (docs: update README and PR template)

### 1. Cloner le projet

```bash
git clone https://github.com/Bond52/sawaka.git
cd sawaka
```

---

### 2. Installer les dépendances

#### 🔹 Frontend (Next.js)

```bash
npm install
```

#### 🔹 Backend (API Node.js / Express)

```bash
cd backend-api
npm install
```

---

## 🛠️ Variables d'environnement nécessaires

Afin de faire fonctionner le projet en local ou en production, vous devez créer les fichiers d'environnement suivants.

---

### 🔧 Backend (`backend-api/.env`)

Créer un fichier `.env` dans le dossier `backend-api` :

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

Créer un fichier `.env.local` à la racine du projet :

```ini
<<<<<<< HEAD
NEXT_PUBLIC_API_URL=https://ton-backend.onrender.com
=======
NEXT_PUBLIC_API_URL=https://sawaka-api-prod.onrender.com
>>>>>>> 303064a (docs: update README and PR template)
```

⚠️ Ne jamais commiter vos fichiers `.env` dans GitHub.

---
## 📐 Diagrams & Architecture

Project diagrams (architecture, flows, data models) are created using draw.io (diagrams.net) and stored in the `/docs/diagrams` folder.
---

## ✅ Definition of Done (DoD)

An issue, task, or user story is considered **Done** when all the following conditions are met:

- Code is implemented according to the acceptance criteria
- Code is committed to the correct branch following the branching strategy
- No regression is introduced on desktop or mobile
- Responsive behavior is validated (mobile / tablet / desktop)
- Application builds successfully without errors
- Feature or fix is deployed to the QA environment
- No blocking or critical bug remains open
- Documentation is updated when applicable

This Definition of Done applies to all work items across the Sawaka project.

 --

## 🤝 Contribuer

Toutes les contributions sont les bienvenues !  
Merci de lire d'abord :

- [CONTRIBUTING.md](CONTRIBUTING.md)  
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)


Please refer to the Wiki for:
- Definition of Ready
- Definition of Done
- Coding standards
- Workflow (issues, PR, reviews)

---
<<<<<<< HEAD
=======

## 🌳 Branching Strategy

- `main` → production-ready code
- `qa` → integration & testing
- `feature/*` → new features
- `fix/*` → bug fixes
- `hotfix/*` → urgent production fixes

---
>>>>>>> 303064a (docs: update README and PR template)
