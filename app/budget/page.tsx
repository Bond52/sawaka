'use client';

import { useState } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";

export default function BudgetPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"budget"|"projet">("budget");
  const [montant, setMontant] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<any>(null);

  const API = process.env.NEXT_PUBLIC_API_BASE ?? "https://ecommerce-web-avec-tailwind.onrender.com";

  const handleBudget = async () => {
    const res = await fetch(`${API}/api/budget/assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ montant: Number(montant) }),
    });
    setResult(await res.json());
  };

  const handleProjet = async () => {
    const res = await fetch(`${API}/api/budget/assistant-projet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ montant: Number(montant), description }),
    });
    setResult(await res.json());
  };

  return (
    <main className="wrap py-8">
      <h1 className="text-2xl font-bold text-sawaka-700 mb-6">💡 {t("budget.assistant")}</h1>

      <div className="flex gap-4 mb-6 border-b">
        <button 
          onClick={() => setActiveTab("budget")} 
          className={`px-4 py-2 ${activeTab==="budget"?"border-b-2 border-sawaka-500 text-sawaka-600":"text-sawaka-400"}`}>
          {t("budget.budgetAssistant")}
        </button>
        <button 
          onClick={() => setActiveTab("projet")} 
          className={`px-4 py-2 ${activeTab==="projet"?"border-b-2 border-sawaka-500 text-sawaka-600":"text-sawaka-400"}`}>
          {t("budget.projectAssistant")}
        </button>
      </div>

      <div className="space-y-4">
        <input 
          type="number" 
          value={montant} 
          onChange={e => setMontant(e.target.value)} 
          placeholder={t("budget.amountLabel")} 
          className="w-full border px-4 py-2 rounded-lg"
        />

        {activeTab==="projet" && (
          <textarea 
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t("budget.projectDescription")}
            className="w-full border px-4 py-2 rounded-lg"
          />
        )}

        <button 
          onClick={activeTab==="budget"?handleBudget:handleProjet}
          className="px-6 py-3 bg-sawaka-500 text-white rounded-lg"
        >
          {activeTab==="budget" ? t("budget.launchBudget") : t("budget.launchProject")}
        </button>
      </div>

      {result && (
        <div className="mt-6 bg-white p-6 rounded-lg shadow space-y-4">
          <h2 className="text-xl font-semibold text-sawaka-700">
            {result.projet}
          </h2>

          {result.budget && (
            <div className="flex justify-between text-sm text-sawaka-600 border-b pb-2">
              <span>{t("budget.budgetLabel")} <strong>{result.budget} {t("common.fcfa")}</strong></span>
              <span>{t("budget.usedLabel")} <strong>{result.totalUtilise ?? 0} {t("common.fcfa")}</strong></span>
              <span>{t("budget.remainingLabel")} <strong>{result.restant ?? (result.budget - (result.totalUtilise ?? 0))} {t("common.fcfa")}</strong></span>
            </div>
          )}

          {result.produits && result.produits.length > 0 ? (
            <ul className="divide-y divide-cream-200">
              {result.produits.map((p: any, i: number) => (
                <li key={i} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-sawaka-800">{p.title}</p>
                    <p className="text-sm text-gray-500">{p.description ?? ""}</p>
                  </div>
                  <span className="font-semibold text-sawaka-600">{p.price} {t("common.fcfa")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">{t("budget.noProducts")}</p>
          )}

          {result.recommandations && (
            <div className="mt-4 p-3 bg-cream-50 rounded border text-sm">
              <p className="font-medium text-sawaka-700 mb-1">💡 {t("budget.aiRecommendations")}</p>
              <p className="text-gray-700">{result.recommandations}</p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
