"use client";

import Link from "next/link";
import { useTranslation } from "@/src/i18n/I18nProvider";

export default function HeroSection() {
  const { t } = useTranslation();

  return (
    <section className="relative h-[70vh] w-full overflow-hidden text-white [&_h1]:!text-white [&_p]:!text-white">
      <img
        src="/images/hero-artisan.png"
        alt={t("home.heroAlt")}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-black/55" aria-hidden />
      <div className="relative z-10 flex h-full items-center">
        <div className="wrap ml-0 max-w-2xl md:ml-12 lg:ml-20">
          <h1 className="mb-4 font-display text-4xl font-bold md:text-6xl">
            {t("home.heroTitle")}
          </h1>
          <p className="mb-6 text-lg opacity-90 md:text-xl">
            {t("home.heroSubtitle")}
          </p>
          <Link
            href="/projets"
            className="btn btn-primary inline-flex items-center gap-2 px-6 py-3"
          >
            {t("home.exploreProjects")}
          </Link>
        </div>
      </div>
    </section>
  );
}
