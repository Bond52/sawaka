"use client";

import Link from "next/link";
import { useTranslation } from "@/src/i18n/I18nProvider";

export default function FeaturedProjects() {
  const { t } = useTranslation();

  const IDS = {
    pascal: "692a3dc77be2252fe0996451",
    amina: "692a3dc77be2252fe099644d",
    samuel: "692a3dc77be2252fe099644e",
  };

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
    alert(t("alerts.projectDetailUnavailable"));
  }

  return (
    <section>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-sawaka-800">
            {t("home.featuredProjects")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            {t("home.featuredProjectsSubtitle")}
          </p>
        </div>
        <Link
          href="/projets"
          className="shrink-0 self-start text-sm font-medium text-orange-600 border border-orange-500 px-4 py-2 rounded-lg hover:bg-orange-50 transition"
        >
          {t("home.seeAll")}
        </Link>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {projets.map((p, index) => (
          <div
            key={index}
            className="bg-white rounded-xl border shadow-sm hover:shadow-md transition overflow-hidden"
          >
            <div className="h-44 bg-cream-100 overflow-hidden">
              <img
                src={p.image}
                alt={p.titre}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-4">
              <p className="text-xs uppercase text-orange-500 mb-1">
                {p.categorie}
              </p>
              <h3 className="font-semibold text-sawaka-800 mb-2 line-clamp-2">
                {p.titre}
              </h3>
              <p className="text-sm text-sawaka-600">
                {t("common.by")} {p.auteur}
              </p>
              <p className="text-xs text-sawaka-500 mb-3">📍 {p.ville}</p>
              {p.hasDetailPage ? (
                <Link
                  href={`/projets/${p.id}`}
                  className="text-sm text-orange-600 hover:underline"
                >
                  {t("home.seeProject")}
                </Link>
              ) : (
                <button
                  onClick={handleComingSoon}
                  className="text-sm text-sawaka-400 hover:text-sawaka-600 underline"
                >
                  {t("home.seeProject")}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
