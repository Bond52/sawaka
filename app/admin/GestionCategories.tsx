"use client";
import { useEffect, useState } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";

type Category = {
  _id: string;
  name: string;
  type: "produit" | "vente";
};

export default function GestionCategories() {
  const { t } = useTranslation();
  const [typeActif, setTypeActif] = useState<"produit" | "vente">("produit");
  const [categories, setCategories] = useState<Category[]>([]);
  const [nouvelleCategorie, setNouvelleCategorie] = useState("");
  const [loading, setLoading] = useState(false);
  const API_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "https://ecommerce-web-avec-tailwind.onrender.com";

  useEffect(() => {
    const chargerCategories = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_URL}/api/admin/categories?type=${typeActif}`,
          { credentials: "include" }
        );
        if (!res.ok) throw new Error("Erreur de chargement");
        const data = await res.json();
        setCategories(data);
      } catch (err) {
        console.error("Erreur fetch catégories :", err);
      } finally {
        setLoading(false);
      }
    };
    chargerCategories();
  }, [typeActif]);

  const ajouterCategorie = async () => {
    if (!nouvelleCategorie.trim()) return alert(t("alerts.categoryNameRequired"));
    try {
      const res = await fetch(`${API_URL}/api/admin/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: nouvelleCategorie.trim(), type: typeActif }),
      });
      if (!res.ok) throw new Error("Erreur création catégorie");
      const cat = await res.json();
      setCategories((prev) => [...prev, cat]);
      setNouvelleCategorie("");
    } catch (err) {
      console.error(err);
      alert(t("alerts.categoryAddFailed"));
    }
  };

  const supprimerCategorie = async (id: string) => {
    if (!confirm(t("alerts.deleteCategoryConfirm"))) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/categories/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erreur suppression catégorie");
      setCategories((prev) => prev.filter((c) => c._id !== id));
    } catch (err) {
      console.error(err);
      alert(t("alerts.categoryDeleteFailed"));
    }
  };

  const typeLabel =
    typeActif === "produit" ? t("admin.typeProduct") : t("admin.typeSale");

  return (
    <div className="mt-4">
      <h2 className="text-lg font-semibold mb-4">{t("admin.categoryTitle")}</h2>

      <div className="flex gap-4 mb-4">
        <button
          onClick={() => setTypeActif("produit")}
          className={`flex items-center gap-2 px-3 py-2 rounded ${
            typeActif === "produit"
              ? "bg-sawaka-500 text-white"
              : "bg-gray-100 hover:bg-gray-200"
          }`}
        >
          📊 {t("admin.productsTab")}
        </button>
        <button
          onClick={() => setTypeActif("vente")}
          className={`flex items-center gap-2 px-3 py-2 rounded ${
            typeActif === "vente"
              ? "bg-sawaka-500 text-white"
              : "bg-gray-100 hover:bg-gray-200"
          }`}
        >
          🛒 {t("admin.salesTab")}
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder={t("admin.newCategory", { type: typeLabel })}
          value={nouvelleCategorie}
          onChange={(e) => setNouvelleCategorie(e.target.value)}
          className="flex-1 border rounded-lg px-3 py-2"
        />
        <button
          onClick={ajouterCategorie}
          className="bg-sawaka-600 text-white px-4 py-2 rounded-lg hover:bg-sawaka-700"
        >
          ➕ {t("admin.add")}
        </button>
      </div>

      {loading ? (
        <p>{t("common.loading")}</p>
      ) : categories.length === 0 ? (
        <p className="text-gray-500 italic">{t("admin.noCategories")}</p>
      ) : (
        <table className="w-full border border-gray-300 rounded-lg overflow-hidden">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">{t("admin.name")}</th>
              <th className="text-left p-2">{t("admin.type")}</th>
              <th className="text-center p-2">{t("admin.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat._id} className="border-t hover:bg-cream-50">
                <td className="p-2">{cat.name}</td>
                <td className="p-2 capitalize">{cat.type}</td>
                <td className="p-2 text-center">
                  <button
                    onClick={() => supprimerCategorie(cat._id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    🗑 {t("common.delete")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
