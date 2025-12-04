# 🧺 Sawaka — Réseau Social des Artisans Africains (Open Source)

Sawaka est une plateforme open source visant à connecter les artisans locaux à leurs communautés.  
Ce projet fournit une architecture moderne basée sur **Next.js**, **Node.js/Express**, et **MongoDB**, avec un design simple, rapide et extensible.

## ✨ Fonctionnalités principales
- 🧑‍🎨 Gestion des artisans (profils, photos, catégories)
- 🛒 Gestion des produits et services
- 👤 Système d’authentification (JWT)
- 🖼️ Upload d’images (Cloudinary)
- 📦 API Node.js pour les opérations backend
- 🌐 Déploiement recommandé : **Vercel** (frontend) + **Render** (backend)

---

## 🚀 Démarrage rapide

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

### 🌐 Frontend (`.env.local`)

Créer un fichier `.env.local` à la racine du projet :

```ini
NEXT_PUBLIC_API_URL=https://ton-backend.onrender.com
```

⚠️ Ne jamais commiter vos fichiers `.env` dans GitHub.

---

## 🤝 Contribuer

Toutes les contributions sont les bienvenues !  
Merci de lire d'abord :

- [CONTRIBUTING.md](CONTRIBUTING.md)  
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

---
