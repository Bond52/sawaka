"use client";

import Link from "next/link";
import { useTranslation } from "@/src/i18n/I18nProvider";

export default function HeroSection() {
  const { t } = useTranslation();

  return (
    <section className="relative h-[70vh] w-full overflow-hidden">
      <img
        src="/images/hero-artisan.png"
        alt={t("home.heroAlt")}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 h-full flex items-center">
        <div className="wrap text-white max-w-2xl ml-0 md:ml-12 lg:ml-20">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            {t("home.heroTitle")}
          </h1>
          <p className="text-lg md:text-xl text-white/90 mb-6">
            {t("home.heroSubtitle")}
          </p>
          <Link
            href="/projets"
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition"
          >
            {t("home.exploreProjects")}
          </Link>
        </div>
      </div>
    </section>
  );
}
