"use client";

import Link from "next/link";

export default function FeaturedProjects() {
  /* IDs REELS issus de ta base */
  const IDS = {
    pascal: "692a3dc77be2252fe0996451",
    amina: "692a3dc77be2252fe099644d",
    samuel: "692a3dc77be2252fe099644e",
  };

  /* ============================
        PROJETS (MOCK HOME)
  ============================= */
  const projets = [
    {
      auteur: "Pascal Ebong",
      id: IDS.pascal,
      ville: "Ebolowa (Sud)",
      titre: "Faire parler les plantes avec Arduino 🌿🤖",
      categorie: "Électronique",
      image: "/images/arduino_flower.jpeg",
      hasDetailPage: true,
    },
    {
      auteur: "Amina Njoh",
      id: IDS.amina,
      ville: "Bafoussam (Ouest)",
      titre: "Grande commande de robes pour mariage 👗✨",
      categorie: "Textile",
      image: "/images/marriage_dress.jpeg",
      hasDetailPage: false,
    },
    {
      auteur: "Samuel Bikoko",
      id: IDS.samuel,
      ville: "Yaoundé (Centre)",
      titre: "Biko-Blade : outil artisanal 3-en-1 🪵🔧",
      categorie: "Artisanat",
      image: "/images/tool_project.jpeg",
      hasDetailPage: false,
    },
  ];

  function handleComingSoon() {
    alert(
      "🚧 Ce projet n’a pas encore de page de détail.\n\n👉 Le projet Arduino est disponible en exemple."
    );
  }

  return (
    <section>
      {/* ===== HEADER ===== */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-sawaka-800">
          Projets en Vedette
        </h2>

        <Link
          href="/projets"
          className="text-sm font-medium text-orange-600 border border-orange-500 px-4 py-2 rounded-lg hover:bg-orange-50 transition"
        >
          Voir tous →
        </Link>
      </div>

      {/* ===== GRID ===== */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {projets.map((p, index) => (
          <div
            key={index}
            className="bg-white rounded-xl border shadow-sm hover:shadow-md transition overflow-hidden"
          >
            {/* IMAGE */}
            <div className="h-44 bg-cream-100 overflow-hidden">
              <img
                src={p.image}
                alt={p.titre}
                className="h-full w-full object-cover"
              />
            </div>

            {/* CONTENT */}
            <div className="p-4">
              <p className="text-xs uppercase text-orange-500 mb-1">
                {p.categorie}
              </p>

              <h3 className="font-semibold text-sawaka-800 mb-2 line-clamp-2">
                {p.titre}
              </h3>

              <p className="text-sm text-sawaka-600">
                par {p.auteur}
              </p>

              <p className="text-xs text-sawaka-500 mb-3">
                📍 {p.ville}
              </p>

              {/* ACTION */}
              {p.hasDetailPage ? (
                <Link
                  href={`/projets/${p.id}`}
                  className="text-sm text-orange-600 hover:underline"
                >
                  Voir le projet →
                </Link>
              ) : (
                <button
                  onClick={handleComingSoon}
                  className="text-sm text-sawaka-400 hover:text-sawaka-600 underline"
                >
                  Voir le projet →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
