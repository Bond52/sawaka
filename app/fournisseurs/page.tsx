"use client";

import { useEffect, useState, useMemo } from "react";
import { listFournisseurs, Fournisseur } from "@/app/lib/apiFournisseurs";

export default function FournisseursPage() {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");        // recherche texte
  const [category, setCategory] = useState("all"); // filtre catégorie

  useEffect(() => {
    listFournisseurs()
      .then(setFournisseurs)
      .catch((err) => console.error("Erreur fournisseurs :", err))
      .finally(() => setLoading(false));
  }, []);

  // 🔎 Extraire les catégories uniques
  const categories = useMemo(() => {
    const cats = fournisseurs.map((f) => f.categorie);
    return ["all", ...Array.from(new Set(cats))];
  }, [fournisseurs]);

  // 🔍 Filtrage dynamique
  const filtered = useMemo(() => {
    return fournisseurs.filter((f) => {
      const matchSearch =
        f.nom.toLowerCase().includes(search.toLowerCase()) ||
        f.adresse.toLowerCase().includes(search.toLowerCase());

      const matchCategory =
        category === "all" ? true : f.categorie === category;

      return matchSearch && matchCategory;
    });
  }, [fournisseurs, search, category]);

  if (loading) {
    return (
      <div className="wrap py-12">
        <p className="text-sawaka-600 text-lg">Chargement des fournisseurs...</p>
      </div>
    );
  }

  return (
    <div className="wrap py-12">
      <h1 className="text-3xl font-bold text-sawaka-700 mb-4">
        Fournisseurs
      </h1>

 {/*
      <p className="text-sawaka-700 text-lg leading-relaxed max-w-2xl mb-8">
        Trovuez des fournisseurs de matières premières et accessoires dans le réseau Sawaka
      </p>
*/}
      {/* 🔎 Barre de recherche + filtre */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        {/* Recherche */}
        <input
          type="text"
          placeholder="Rechercher un fournisseur..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-1/2 px-4 py-2 border border-cream-400 rounded-lg focus:ring-2 focus:ring-sawaka-500"
        />

        {/* Filtre catégorie */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full md:w-1/3 px-4 py-2 border border-cream-400 rounded-lg"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat === "all" ? "Toutes les catégories" : cat}
            </option>
          ))}
        </select>
      </div>

      {/* 🔥 Liste des fournisseurs */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
        {filtered.map((f) => (
          <div
            key={f._id}
            className="bg-white border border-cream-300 rounded-lg p-6 shadow-sm hover:shadow-md transition-all"
          >
            <h2 className="text-xl font-bold text-sawaka-700 mb-1">
              {f.nom}
            </h2>

            <p className="text-sawaka-500 text-sm mb-3">{f.categorie}</p>

            <p className="text-sawaka-600 text-sm mb-3">
              <strong>Produits :</strong> {f.produits.join(", ")}
            </p>

            <p className="text-sawaka-600 text-sm">
              📍 {f.adresse}
              <br />
              📞 {f.telephone}
              <br />
              ✉️ {f.email}
            </p>

            <p className="text-sawaka-500 text-sm mt-3">
              Délai de livraison : {f.delaiLivraison}
            </p>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-gray-500 mt-6">
          Aucun fournisseur trouvé.
        </p>
      )}
    </div>
  );
}
