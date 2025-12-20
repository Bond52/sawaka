"use client";

import { useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------
   📌 Liste des villes disponibles
------------------------------------------------------------------- */
const CITIES = [
  "Douala",
  "Yaoundé",
  "Bafoussam",
  "Ebolowa",
  "Kribi",
  "Garoua",
  "Maroua",
  "Buea",
  "Bamenda",
  "Bertoua",
  "Ngaoundéré",
  "Limbe",
  "Dschang",
];

/* ------------------------------------------------------------------
   💡 Idées créatives (mock)
------------------------------------------------------------------- */
function getCreativeIdeas(budget: number) {
  if (budget <= 5000) {
    return [
      "Illustration personnalisée",
      "Petit objet artistique",
      "Création textile simple",
    ];
  } else if (budget <= 15000) {
    return [
      "Prototype artistique",
      "Série d’objets décoratifs",
      "Création mode artisanale",
    ];
  } else {
    return [
      "Table basse minimaliste",
      "Lampe artisanale",
      "Babyfoot artisanal",
    ];
  }
}

/* ------------------------------------------------------------------
   🧰 Outils & matériaux (mock)
------------------------------------------------------------------- */
const MOCK_TOOLS_AND_MATERIALS = {
  tools: [
    "Machine à coudre",
    "Scie sauteuse",
    "Poste à souder",
    "Perceuse électrique",
    "Pinceaux professionnels",
    "Ordinateur + logiciel de design",
  ],
  materials: [
    "Bois brut",
    "Tissu coton & wax",
    "Peinture acrylique",
    "Métal recyclé",
    "Argile",
    "Fil et accessoires de couture",
  ],
};

export default function HomePage() {
  const [projectType, setProjectType] =
    useState<"business" | "creative">("business");

  const [budget, setBudget] = useState<number>(0);
  const [city, setCity] = useState("");
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const resultsRef = useRef<HTMLDivElement | null>(null);

  /* -------------------------------------------------------------
     🔍 Soumission
  -------------------------------------------------------------- */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!budget || !city) return;

    setLoading(true);
    setResult(null);

    try {
      if (projectType === "business") {
        setResult({
          type: "business",
          projectName: "Élevage de poulets de chair",
          pdfUrl: "/pdfs/Fiche_Projet_Elevage_Poulet_Cameroun.pdf",
          summary:
            "Projet d’élevage de poulets destiné au marché local, avec une approche progressive et maîtrisée.",
        });
      } else {
        setResult({
          type: "creative",
          ideas: getCreativeIdeas(budget),
          tools: MOCK_TOOLS_AND_MATERIALS.tools,
          materials: MOCK_TOOLS_AND_MATERIALS.materials,
          cloudFactories: [
            { name: "Atelier Bois & Sculpture — Douala", available: true },
            { name: "FabLab Métal — Yaoundé", available: false },
            { name: "Atelier Textile — Bafoussam", available: true },
          ],
        });
      }
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  }

  /* -------------------------------------------------------------
     ⬇️ Scroll automatique
  -------------------------------------------------------------- */
  useEffect(() => {
    if (result && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [result]);

  /* -------------------------------------------------------------
     🖼️ RENDU
  -------------------------------------------------------------- */
  return (
    <div className="wrap py-10">
      {/* ===== HERO ===== */}
      <section
        className={`flex flex-col items-center text-center ${
          result ? "pt-6" : "min-h-[45vh]"
        }`}
      >
        <h1 className="text-6xl md:text-7xl font-extrabold text-sawaka-700 mb-4">
          Sawaka
        </h1>

        <p className="text-xl text-sawaka-600 mb-6">
          Des opportunités à votre portée
        </p>

        {/* ===== FORMULAIRE ===== */}
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-3xl bg-white shadow-md rounded-full px-6 py-4 flex flex-col md:flex-row gap-4 items-center"
        >
          <input
            type="text"
            inputMode="numeric"
            placeholder="Votre budget (FCFA)"
            value={budget || ""}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/\D/g, "");
              setBudget(cleaned === "" ? 0 : Number(cleaned));
            }}
            className="flex-1 outline-none text-lg px-2"
          />

          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="outline-none text-lg px-2 bg-transparent"
          >
            <option value="">Votre ville</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="bg-sawaka-600 hover:bg-sawaka-700 text-white px-6 py-2 rounded-full transition"
          >
            Explorer
          </button>
        </form>

        {/* ===== TYPE DE PROJET ===== */}
        <div className="mt-6 flex justify-center gap-8 text-sawaka-700">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={projectType === "business"}
              onChange={() => setProjectType("business")}
              className="accent-sawaka-600"
            />
            Projet d’entreprise
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={projectType === "creative"}
              onChange={() => setProjectType("creative")}
              className="accent-sawaka-600"
            />
            Projet créatif
          </label>
        </div>

        {/* ===== CTA SANS RECHERCHE ===== */}
        {!result && (
          <div className="mt-16 max-w-4xl w-full">
            <div className="bg-sawaka-50 p-8 rounded-xl border border-sawaka-200 text-center">
              <p className="text-sawaka-700 text-lg">
               🎯<strong>Vous avez déjà une idée précise de votre projet ?</strong>
                <br />
                Créez votre projet dès maintenant ou explorez les opportunités disponibles sur le réseau Sawaka.
              </p>

              <button
                onClick={() =>
                  alert(
                    "🚫 La création de projet nécessite un compte. Fonctionnalité indisponible pour l'instant."
                  )
                }
                className="mt-4 bg-sawaka-600 hover:bg-sawaka-700 text-white px-6 py-3 rounded-lg transition"
              >
                ➕ Créer mon projet
              </button>
            </div>
          </div>
        )}

        {loading && (
          <p className="mt-4 text-sawaka-600">
            Analyse des opportunités…
          </p>
        )}
      </section>

      {/* ===== RESULTATS ===== */}
      {result && (
        <div
          ref={resultsRef}
          className="space-y-10 mt-10 border-t border-cream-200 pt-8"
        >
          {/* ===== PROJET ENTREPRISE ===== */}
          {result.type === "business" && (
            <section className="max-w-3xl mx-auto bg-white border rounded-xl p-8 shadow-sm text-center">
              <h2 className="text-2xl font-bold text-sawaka-700 mb-3">
                📄 {result.projectName}
              </h2>

              <p className="text-sawaka-600 mb-4">
                {result.summary}
              </p>

              <a
                href={result.pdfUrl}
                download
                className="inline-flex items-center gap-2 bg-sawaka-600 hover:bg-sawaka-700 text-white px-6 py-3 rounded-lg transition"
              >
                ⬇️ Télécharger la fiche projet (PDF)
              </a>
            </section>
          )}

          {/* ===== PROJET CRÉATIF COMPLET ===== */}
          {result.type === "creative" && (
            <section className="max-w-5xl mx-auto space-y-10">
              {/* Idées */}
              <div className="bg-white border rounded-xl p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-sawaka-700 mb-4">
                  💡 Idées créatives suggérées
                </h2>
                <ul className="list-disc list-inside text-sawaka-600 space-y-1">
                  {result.ideas.map((idea: string, i: number) => (
                    <li key={i}>{idea}</li>
                  ))}
                </ul>
              </div>

              {/* Outils + Matériaux */}
              <div className="bg-white border rounded-xl p-6 shadow-sm grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xl font-semibold text-sawaka-700 mb-2">
                    🧰 Outils nécessaires
                  </h3>
                  <ul className="list-disc list-inside text-sawaka-600 space-y-1">
                    {result.tools.map((tool: string, i: number) => (
                      <li key={i}>{tool}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-sawaka-700 mb-2">
                    🧱 Matériaux requis
                  </h3>
                  <ul className="list-disc list-inside text-sawaka-600 space-y-1">
                    {result.materials.map((mat: string, i: number) => (
                      <li key={i}>{mat}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Ateliers */}
              <div className="bg-white border rounded-xl p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-sawaka-700 mb-3">
                  🏭 Ateliers & FabLabs
                </h3>
                <ul className="space-y-2 text-sawaka-600">
                  {result.cloudFactories.map((cf: any, i: number) => (
                    <li key={i}>
                      <strong>{cf.name}</strong> —{" "}
                      {cf.available ? "✅ Disponible" : "❌ Indisponible"}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* ===== CTA FINAL (réutilisé) ===== */}
          <div className="max-w-5xl mx-auto mt-12">
            <div className="bg-sawaka-50 p-6 rounded-lg border border-sawaka-200 text-center">
              <p className="text-sawaka-700 text-lg">
                🎉 <strong>Vous avez maintenant une vision claire de votre projet ?</strong>
                <br />
                Vous pouvez créer et publier votre projet sur Sawaka.
              </p>

              <button
                onClick={() =>
                  alert(
                    "🚫 La création de projet nécessite un compte. Fonctionnalité indisponible pour l'instant."
                  )
                }
                className="mt-4 bg-sawaka-600 hover:bg-sawaka-700 text-white px-5 py-3 rounded-lg transition"
              >
                ➕ Créer mon projet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
