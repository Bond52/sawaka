"use client";

import { useTranslation } from "@/src/i18n/I18nProvider";

const PRIVACY_EMAIL = "privacy@sawaka.org";

export default function PrivacyContent() {
  const { t } = useTranslation();

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <header className="mb-10 pb-8 border-b border-sawaka-200">
        <h1 className="text-3xl md:text-4xl font-bold text-sawaka-900 mb-4">
          {t("privacy.title")}
        </h1>
        <div className="flex flex-col sm:flex-row sm:gap-6 text-sm text-sawaka-700">
          <p>
            <span className="font-semibold text-sawaka-800">
              {t("privacy.versionLabel")}
            </span>{" "}
            1.0
          </p>
          <p>
            <span className="font-semibold text-sawaka-800">
              {t("privacy.lastUpdatedLabel")}
            </span>{" "}
            {t("privacy.lastUpdated")}
          </p>
        </div>
      </header>

      <div className="space-y-10">
        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("privacy.s1Title")}
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("privacy.s1P1")}</p>
            <p>{t("privacy.s1P2")}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("privacy.s2Title")}
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("privacy.s2P1")}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t("privacy.s2Item1")}</li>
              <li>{t("privacy.s2Item2")}</li>
              <li>{t("privacy.s2Item3")}</li>
              <li>{t("privacy.s2Item4")}</li>
              <li>{t("privacy.s2Item5")}</li>
              <li>{t("privacy.s2Item6")}</li>
            </ul>
            <p>{t("privacy.s2P2")}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("privacy.s3Title")}
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("privacy.s3Intro")}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t("privacy.s3Item1")}</li>
              <li>{t("privacy.s3Item2")}</li>
              <li>{t("privacy.s3Item3")}</li>
              <li>{t("privacy.s3Item4")}</li>
              <li>{t("privacy.s3Item5")}</li>
              <li>{t("privacy.s3Item6")}</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("privacy.s4Title")}
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("privacy.s4P1")}</p>
            <p>{t("privacy.s4P2")}</p>
            <p>{t("privacy.s4P3")}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("privacy.s5Title")}
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("privacy.s5P1")}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t("privacy.s5Item1")}</li>
              <li>{t("privacy.s5Item2")}</li>
              <li>{t("privacy.s5Item3")}</li>
              <li>{t("privacy.s5Item4")}</li>
            </ul>
            <p>{t("privacy.s5P2")}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("privacy.s6Title")}
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("privacy.s6P1")}</p>
            <p>{t("privacy.s6P2")}</p>
            <p>{t("privacy.s6P3")}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("privacy.s7Title")}
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("privacy.s7Intro")}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t("privacy.s7Item1")}</li>
              <li>{t("privacy.s7Item2")}</li>
              <li>{t("privacy.s7Item3")}</li>
              <li>{t("privacy.s7Item4")}</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("privacy.s8Title")}
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("privacy.s8P1")}</p>
            <p>{t("privacy.s8P2")}</p>
            <p>{t("privacy.s8P3")}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("privacy.s9Title")}
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("privacy.s9P1")}</p>
            <p>{t("privacy.s9P2")}</p>
            <p>{t("privacy.s9P3")}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("privacy.s10Title")}
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("privacy.s10P1")}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t("privacy.s10Item1")}</li>
              <li>{t("privacy.s10Item2")}</li>
              <li>{t("privacy.s10Item3")}</li>
            </ul>
            <p>
              {t("privacy.s10P2Before")}{" "}
              <a
                href={`mailto:${PRIVACY_EMAIL}`}
                className="text-sawaka-700 underline hover:text-sawaka-800"
              >
                {PRIVACY_EMAIL}
              </a>
              {t("privacy.s10P2After")}
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("privacy.s11Title")}
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("privacy.s11P1")}</p>
            <p>{t("privacy.s11P2")}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("privacy.s12Title")}
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>
              {t("privacy.s12P1Before")}{" "}
              <a
                href={`mailto:${PRIVACY_EMAIL}`}
                className="text-sawaka-700 underline hover:text-sawaka-800"
              >
                {PRIVACY_EMAIL}
              </a>
              {t("privacy.s12P1After")}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
