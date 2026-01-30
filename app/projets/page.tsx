"use client";

export default function ProjetsEnCoursPage() {
  /* IDs REELS issus de ta base */
  const IDS = {
    pascal: "692a3dc77be2252fe0996451",
    amina: "692a3dc77be2252fe099644d",
    samuel: "692a3dc77be2252fe099644e",
  };

  /* ============================
        PROJETS (MOCK)
  ============================= */
  const projets = [
    {
      auteur: "Pascal Ebong",
      id: IDS.pascal,
      ville: "Ebolowa (Sud)",
      titre: "Faire parler les plantes avec Arduino 🌿🤖",
      categorie: "Électronique",
      image: "/images/arduino_flower.jpeg",
      hasDetailPage: true, // ✅ seul projet actif
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
      "🚧 Ce projet n’a pas encore de page de détail.\n\n👉 Cliquez sur le projet Arduino pour voir un exemple complet d’affichage de projet."
    );
  }

  return (
    <div className="wrap py-12">
      {/* ===== HEADER ===== */}
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-bold text-sawaka-800 mb-2">
          Explorer les projets
        </h1>
        <p className="text-sawaka-600">
          Découvrez les projets portés par la communauté Sawaka
        </p>
      </div>

      {/* ===== GRID CENTRÉE ===== */}
      <div className="flex justify-center">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl w-full">
          {projets.map((p, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-sm border hover:shadow-md transition overflow-hidden"
            >
              {/* IMAGE */}
              <div className="h-44 bg-cream-100 overflow-hidden">
                <img
                  src={p.image}
                  alt={p.titre}
                  className="object-cover h-full w-full"
                />
              </div>

              {/* CONTENT */}
              <div className="p-4">
                <p className="text-xs uppercase text-sawaka-500 mb-1">
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
                  <a
                    href={`/projets/${p.id}`}
                    className="text-sm text-sawaka-600 hover:text-sawaka-800 underline"
                  >
                    Voir le projet →
                  </a>
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
      </div>
    </div>
  );
}
