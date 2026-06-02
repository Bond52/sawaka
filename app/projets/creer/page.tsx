"use client";

import { useState } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { listFournisseurs } from "@/app/lib/apiFournisseurs";
import { listTools } from "@/app/lib/apiTools";

const CITIES = [
  "Douala", "Yaoundé", "Bafoussam", "Ebolowa", "Kribi",
  "Garoua", "Maroua", "Buea", "Bamenda", "Bertoua",
  "Ngaoundéré", "Limbe", "Dschang"
];

function getProjectIdeas(budget: number) {
  if (budget <= 5000) {
    return ["Petite décoration en bois", "Boîte personnalisée", "Porte-clef artisanal"];
  } else if (budget <= 15000) {
    return ["Tabouret simple", "Cadre photo solide", "Mini-étagère murale"];
  } else if (budget <= 30000) {
    return [
      "Table basse minimaliste",
      "Tabouret renforcé",
      "Lampe artisanale",
      "Début de pièces pour babyfoot artisanal"
    ];
  } else {
    return [
      "Meuble complet",
      "Babyfoot artisanal (structure de base)",
      "Chaise haut de gamme",
    ];
  }
}

export default function CreerProjetPage() {
  const { t } = useTranslation();
  const [budget, setBudget] = useState<number>(0);
  const [city, setCity] = useState("");
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!budget || !city) return;

    setLoading(true);

    try {
      const fournisseurs = await listFournisseurs();
      const tools = await listTools();
      const ideas = getProjectIdeas(budget);

      const cloudFactories = [
        {
          name: "Atelier Bois & Sculpture — Douala",
          equipments: ["Scie électrique", "Ponçeuse", "Établi massif"],
          available: true,
        },
        {
          name: "FabLab Métal — Yaoundé",
          equipments: ["Poste à souder", "Découpeuse métal", "Casques & gants"],
          available: false,
        },
        {
          name: "Atelier Textile — Bafoussam",
          equipments: ["Machines à coudre", "Table de découpe"],
          available: true,
        },
      ];

      setResult({
        fournisseurs,
        tools,
        ideas,
        cloudFactories,
      });
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  }

  return (
    <div className="wrap py-12">
      <h1 className="text-3xl font-bold text-sawaka-700 mb-4">{t("projects.create")}</h1>

      <p className="text-sawaka-700 text-lg leading-relaxed max-w-2xl mb-8">
        {t("projects.createHint")}
        <br />
        🧠 <strong>{t("projects.createGoal")}</strong>
      </p>

      <form onSubmit={handleSubmit} className="grid md:grid-cols-3 gap-6 mb-12">
        <div>
          <label className="block mb-2 font-semibold">{t("projects.yourBudget")}</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder={t("projects.budgetExample")}
            value={budget}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/\D/g, "");
              setBudget(cleaned === "" ? 0 : Number(cleaned));
            }}
            className="w-full h-12 px-4 rounded-lg border-2 border-cream-300 focus:border-sawaka-500"
          />
        </div>

        <div>
          <label className="block mb-2 font-semibold">{t("projects.yourCity")}</label>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full p-3 border-2 border-cream-300 rounded-lg focus:border-sawaka-500"
          >
            <option value="">{t("projects.selectCity")}</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            className="w-full bg-sawaka-600 hover:bg-sawaka-700 text-white p-3 rounded-lg transition"
          >
            {t("projects.explorePossibilities")}
          </button>
        </div>
      </form>

      {loading && <p className="text-center text-sawaka-600">{t("projects.analyzing")}</p>}

      {result && (
        <div className="space-y-12">
          <div>
            <h2 className="text-2xl font-bold text-sawaka-700 mb-3">
              🪵 {t("projects.materialsTitle", { budget })}
            </h2>
            {result.fournisseurs.length === 0 ? (
              <p className="text-sawaka-600">{t("projects.noMaterials")}</p>
            ) : (
              <ul className="grid md:grid-cols-2 gap-4">
                {result.fournisseurs.map((f: any) => (
                  <li key={f._id} className="p-4 border rounded-lg bg-white shadow-sm">
                    <div className="font-semibold text-sawaka-800">{f.nom}</div>
                    <div className="text-sm text-sawaka-600">📍 {f.categorie}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold text-sawaka-700 mb-3">
              🔧 {t("projects.toolsTitle")}
            </h2>

            <ul className="grid md:grid-cols-2 gap-4">
              {result.tools.map((tool: any) => (
                <li key={tool.id} className="p-4 border rounded-lg bg-white shadow-sm">
                  <div className="font-semibold text-sawaka-800">{tool.name}</div>
                  <div className="text-sm text-sawaka-600">
                    {tool.vendor ? (
                      <>
                        📍 {tool.vendor}<br />💰 {tool.price}
                      </>
                    ) : (
                      <span className="text-red-600">
                        {t("projects.noManufacturer")}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-sawaka-700 mb-3">
              🏭 {t("projects.workshopsTitle")}
            </h2>

            <ul className="grid md:grid-cols-2 gap-4">
              {result.cloudFactories.map((cf: any, i: number) => (
                <li key={i} className="p-4 border rounded-lg bg-white shadow-sm">
                  <div className="font-semibold text-sawaka-800">{cf.name}</div>
                  <ul className="text-sawaka-600 text-sm mt-2 list-disc pl-5">
                    {cf.equipments.map((eq: string, k: number) => (
                      <li key={k}>{eq}</li>
                    ))}
                  </ul>
                  <p className={`mt-2 font-semibold ${cf.available ? "text-green-600" : "text-red-600"}`}>
                    {cf.available ? t("common.available") : t("projects.currentlyUnavailable")}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-sawaka-700 mb-3">💡 {t("projects.ideasTitle")}</h2>
            <ul className="list-disc pl-6 text-sawaka-700 space-y-1">
              {result.ideas.map((idea: string, i: number) => (
                <li key={i}>{idea}</li>
              ))}
            </ul>
          </div>

          <div className="bg-sawaka-50 p-6 rounded-lg border border-sawaka-200">
            <p className="text-sawaka-700 text-lg leading-relaxed">
              🎉 <strong>{t("projects.visionClear")}</strong>
              <br />
              {t("projects.visionPublish")}
            </p>

            <button
              onClick={() => alert(t("alerts.projectCreateRequiresAccount"))}
              className="mt-4 bg-sawaka-600 hover:bg-sawaka-700 text-white px-5 py-3 rounded-lg transition"
            >
              ➕ {t("projects.createMyProject")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
