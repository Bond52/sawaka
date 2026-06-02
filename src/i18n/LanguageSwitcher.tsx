"use client";

import { useTranslation } from "./I18nProvider";
import type { Locale } from "./index";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "fr", label: "FR" },
];

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();

  return (
    <div
      className="flex items-center rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold"
      role="group"
      aria-label={t("language.switcher")}
    >
      {OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setLocale(value)}
          className={`px-2.5 py-1.5 transition ${
            locale === value
              ? "bg-sawaka-600 text-white"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
          aria-pressed={locale === value}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
