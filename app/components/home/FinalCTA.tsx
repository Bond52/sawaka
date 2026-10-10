"use client";

import { useTranslation } from "@/src/i18n/I18nProvider";

export default function FinalCTA() {
  const { t } = useTranslation();

  return (
    <div className="max-w-5xl mx-auto mt-12">
      <div className="bg-sawaka-50 p-6 rounded-lg border border-sawaka-200 text-center">
        <p className="text-sawaka-700 text-lg">
          🎉 <strong>{t("home.finalCtaTitle")}</strong>
          <br />
          {t("home.finalCtaSubtitle")}
        </p>

        <button
          onClick={() => alert(t("alerts.projectCreateRequiresAccount"))}
          className="mt-4 bg-sawaka-600 hover:bg-sawaka-700 text-white px-5 py-3 rounded-lg transition"
        >
          ➕ {t("home.createMyProject")}
        </button>
      </div>
    </div>
  );
}
