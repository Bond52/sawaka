"use client";

import type { ReactNode } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";

const CONTACT_EMAIL = "contact@sawaka.org";

const AUDIENCE_KEYS = [
  "artisans",
  "makers",
  "entrepreneurs",
  "students",
  "creators",
  "suppliers",
  "mentors",
  "ideas",
] as const;

const FEATURE_KEYS = [
  "ideas",
  "suppliers",
  "materials",
  "tools",
  "experience",
  "collaborate",
  "showcase",
  "network",
  "learn",
] as const;

const VALUE_KEYS = [
  "collaboration",
  "knowledge",
  "accessibility",
  "transparency",
  "learning",
  "localImpact",
  "innovation",
  "community",
] as const;

const VISION_KEYS = ["suppliers", "knowledge", "bi", "ai", "mapping"] as const;

const ASSOCIATION_KEYS = [
  "support",
  "collaboration",
  "contributors",
  "partnerships",
  "initiatives",
] as const;

const CTA_KEYS = ["follow", "feedback", "test", "ideas", "community"] as const;

const MISSION_HELP_KEYS = [
  "discoverIdeas",
  "findSuppliers",
  "connectEntrepreneurs",
  "findResources",
  "learnCommunity",
  "collaborate",
] as const;

const DIFFERENCE_KEYS = [
  "projectDiscovery",
  "supplierDiscovery",
  "collaboration",
  "communityKnowledge",
  "practicalGuidance",
] as const;

const WHY_KEYS = ["noStart", "lackInfo", "noEcosystem"] as const;

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
      {children}
    </h2>
  );
}

function InfoCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-sawaka-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <h3 className="font-semibold text-sawaka-900 mb-2">{title}</h3>
      <p className="text-sm text-sawaka-700 leading-relaxed">{description}</p>
    </div>
  );
}

function ValueCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-sawaka-200 bg-sawaka-50 p-5">
      <h3 className="font-semibold text-sawaka-900 mb-2">{title}</h3>
      <p className="text-sm text-sawaka-700 leading-relaxed">{description}</p>
    </div>
  );
}

export default function MissionContent() {
  const { t } = useTranslation();

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <header className="mb-12 rounded-2xl border border-sawaka-200 bg-gradient-to-br from-sawaka-50 to-cream-100 px-6 py-10 sm:px-10">
        <h1 className="text-3xl md:text-4xl font-bold text-sawaka-900 mb-4">
          {t("mission.title")}
        </h1>
        <p className="text-lg text-sawaka-700 leading-relaxed">
          {t("mission.subtitle")}
        </p>
      </header>

      <div className="space-y-14">
        <section>
          <SectionHeading>{t("mission.s1Title")}</SectionHeading>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("mission.s1Intro")}</p>
            <ul className="list-disc pl-6 space-y-2">
              {WHY_KEYS.map((key) => (
                <li key={key}>{t(`mission.why.${key}`)}</li>
              ))}
            </ul>
            <p>{t("mission.s1Closing")}</p>
          </div>
        </section>

        <section>
          <SectionHeading>{t("mission.s2Title")}</SectionHeading>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("mission.s2Intro")}</p>
            <ul className="list-disc pl-6 space-y-2">
              {MISSION_HELP_KEYS.map((key) => (
                <li key={key}>{t(`mission.help.${key}`)}</li>
              ))}
            </ul>
            <p className="font-medium text-sawaka-800">{t("mission.s2Closing")}</p>
          </div>
        </section>

        <section>
          <SectionHeading>{t("mission.s3Title")}</SectionHeading>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("mission.s3Intro")}</p>
            <ul className="list-disc pl-6 space-y-2">
              {DIFFERENCE_KEYS.map((key) => (
                <li key={key}>{t(`mission.difference.${key}`)}</li>
              ))}
            </ul>
            <p>{t("mission.s3Closing")}</p>
          </div>
        </section>

        <section>
          <SectionHeading>{t("mission.s4Title")}</SectionHeading>
          <p className="text-sawaka-700 mb-6">{t("mission.s4Intro")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {AUDIENCE_KEYS.map((key) => (
              <InfoCard
                key={key}
                title={t(`mission.audience.${key}.title`)}
                description={t(`mission.audience.${key}.desc`)}
              />
            ))}
          </div>
        </section>

        <section>
          <SectionHeading>{t("mission.s5Title")}</SectionHeading>
          <p className="text-sawaka-700 mb-6">{t("mission.s5Intro")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURE_KEYS.map((key) => (
              <InfoCard
                key={key}
                title={t(`mission.features.${key}.title`)}
                description={t(`mission.features.${key}.desc`)}
              />
            ))}
          </div>
          <p className="mt-6 text-sm text-sawaka-600 italic">
            {t("mission.s5Closing")}
          </p>
        </section>

        <section>
          <SectionHeading>{t("mission.s6Title")}</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {VALUE_KEYS.map((key) => (
              <ValueCard
                key={key}
                title={t(`mission.values.${key}.title`)}
                description={t(`mission.values.${key}.desc`)}
              />
            ))}
          </div>
        </section>

        <section>
          <SectionHeading>{t("mission.s7Title")}</SectionHeading>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("mission.s7Intro")}</p>
            <ul className="list-disc pl-6 space-y-2">
              {VISION_KEYS.map((key) => (
                <li key={key}>{t(`mission.vision.${key}`)}</li>
              ))}
            </ul>
            <p className="text-sm text-sawaka-600 italic">
              {t("mission.s7Closing")}
            </p>
          </div>
        </section>

        <section>
          <SectionHeading>{t("mission.s8Title")}</SectionHeading>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("mission.s8Intro")}</p>
            <ul className="list-disc pl-6 space-y-2">
              {ASSOCIATION_KEYS.map((key) => (
                <li key={key}>{t(`mission.association.${key}`)}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-2xl border border-sawaka-200 bg-gradient-to-br from-sawaka-50 to-cream-100 px-6 py-8 sm:px-10">
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("mission.ctaTitle")}
          </h2>
          <p className="text-sawaka-700 mb-4">{t("mission.ctaIntro")}</p>
          <ul className="list-disc pl-6 space-y-2 text-sawaka-700 mb-6">
            {CTA_KEYS.map((key) => (
              <li key={key}>{t(`mission.cta.${key}`)}</li>
            ))}
          </ul>
          <p className="text-sawaka-700">
            {t("mission.ctaBefore")}{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-sawaka-800 underline hover:text-sawaka-900 font-medium"
            >
              {CONTACT_EMAIL}
            </a>
            {t("mission.ctaAfter")}
          </p>
        </section>
      </div>
    </div>
  );
}
