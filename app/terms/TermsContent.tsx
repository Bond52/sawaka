"use client";

import { useTranslation } from "@/src/i18n/I18nProvider";

export default function TermsContent() {
  const { t } = useTranslation();

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <header className="mb-10 pb-8 border-b border-sawaka-200">
        <h1 className="text-3xl md:text-4xl font-bold text-sawaka-900 mb-4">
          {t("terms.title")}
        </h1>
        <div className="flex flex-col sm:flex-row sm:gap-6 text-sm text-sawaka-700">
          <p>
            <span className="font-semibold text-sawaka-800">
              {t("terms.versionLabel")}
            </span>{" "}
            1.0
          </p>
          <p>
            <span className="font-semibold text-sawaka-800">
              {t("terms.effectiveDateLabel")}
            </span>{" "}
            {t("terms.effectiveDate")}
          </p>
        </div>
      </header>

      <div className="space-y-10">
        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("terms.s1Title")}
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("terms.s1P1")}</p>
            <p>{t("terms.s1P2")}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("terms.s2Title")}
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("terms.s2P1")}</p>
            <p>{t("terms.s2P2")}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("terms.s3Title")}
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("terms.s3Intro")}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t("terms.s3Item1")}</li>
              <li>{t("terms.s3Item2")}</li>
              <li>{t("terms.s3Item3")}</li>
            </ul>
            <p>{t("terms.s3P2")}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("terms.s4Title")}
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("terms.s4P1")}</p>
            <p>{t("terms.s4Intro")}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t("terms.s4Item1")}</li>
              <li>{t("terms.s4Item2")}</li>
              <li>{t("terms.s4Item3")}</li>
              <li>{t("terms.s4Item4")}</li>
              <li>{t("terms.s4Item5")}</li>
              <li>{t("terms.s4Item6")}</li>
            </ul>
            <p>{t("terms.s4P2")}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("terms.s5Title")}
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("terms.s5P1")}</p>
            <p>{t("terms.s5P2")}</p>
            <p>{t("terms.s5P3")}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("terms.s6Title")}
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("terms.s6P1")}</p>
            <p>{t("terms.s6Intro")}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t("terms.s6Item1")}</li>
              <li>{t("terms.s6Item2")}</li>
              <li>{t("terms.s6Item3")}</li>
              <li>{t("terms.s6Item4")}</li>
            </ul>
            <p>{t("terms.s6P2")}</p>
            <p>{t("terms.s6Intro2")}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t("terms.s6Item5")}</li>
              <li>{t("terms.s6Item6")}</li>
              <li>{t("terms.s6Item7")}</li>
              <li>{t("terms.s6Item8")}</li>
            </ul>
            <p>{t("terms.s6P3")}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("terms.s7Title")}
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("terms.s7P1")}</p>
            <p>{t("terms.s7P2")}</p>
            <p>{t("terms.s7P3")}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("terms.s8Title")}
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("terms.s8P1")}</p>
            <p>{t("terms.s8P2")}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("terms.s9Title")}
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("terms.s9P1")}</p>
            <p>{t("terms.s9P2")}</p>
            <p>{t("terms.s9P3")}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("terms.s10Title")}
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("terms.s10Intro")}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t("terms.s10Item1")}</li>
              <li>{t("terms.s10Item2")}</li>
              <li>{t("terms.s10Item3")}</li>
              <li>{t("terms.s10Item4")}</li>
              <li>{t("terms.s10Item5")}</li>
              <li>{t("terms.s10Item6")}</li>
            </ul>
            <p>{t("terms.s10P2")}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("terms.s11Title")}
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("terms.s11P1")}</p>
            <p>{t("terms.s11P2")}</p>
            <p>{t("terms.s11P3")}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-sawaka-800 mb-4">
            {t("terms.s12Title")}
          </h2>
          <div className="space-y-4 text-sawaka-700">
            <p>{t("terms.s12P1")}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
