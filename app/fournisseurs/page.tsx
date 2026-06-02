"use client";

import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { listFournisseurs, Fournisseur } from "@/app/lib/apiFournisseurs";

export default function FournisseursPage() {
  const { t } = useTranslation();
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    listFournisseurs()
      .then(setFournisseurs)
      .catch((err) => console.error("Erreur fournisseurs :", err))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const cats = fournisseurs.map((f) => f.categorie);
    return ["all", ...Array.from(new Set(cats))];
  }, [fournisseurs]);

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
        <p className="text-sawaka-600 text-lg">{t("suppliers.loading")}</p>
      </div>
    );
  }

  return (
    <div className="wrap py-12">
      <h1 className="text-3xl font-bold text-sawaka-700 mb-4">
        {t("suppliers.title")}
      </h1>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <input
          type="text"
          placeholder={t("suppliers.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-1/2 px-4 py-2 border border-cream-400 rounded-lg focus:ring-2 focus:ring-sawaka-500"
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full md:w-1/3 px-4 py-2 border border-cream-400 rounded-lg"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat === "all" ? t("suppliers.allCategories") : cat}
            </option>
          ))}
        </select>
      </div>

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
              <strong>{t("suppliers.productsLabel")}</strong> {f.produits.join(", ")}
            </p>

            <p className="text-sawaka-600 text-sm">
              📍 {f.adresse}
              <br />
              📞 {f.telephone}
              <br />
              ✉️ {f.email}
            </p>

            <p className="text-sawaka-500 text-sm mt-3">
              {t("suppliers.deliveryTime")} {f.delaiLivraison}
            </p>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-gray-500 mt-6">
          {t("suppliers.empty")}
        </p>
      )}
    </div>
  );
}
