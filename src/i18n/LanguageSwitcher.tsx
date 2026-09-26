"use client";

import { useTranslation } from "./I18nProvider";
import type { Locale } from "./index";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "fr", label: "FR" },
];

type LanguageSwitcherProps = {
  className?: string;
};

export default function LanguageSwitcher({ className = "" }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useTranslation();

  return (
    <div
      data-testid="language-switcher"
      className={`inline-flex items-center rounded-lg border-2 border-orange-200 bg-white p-0.5 shadow-sm ${className}`.trim()}
      role="group"
      aria-label={t("language.switcher")}
    >
      {OPTIONS.map(({ value, label }) => {
        const active = locale === value;
        return (
          <button
            key={value}
            type="button"
            data-testid={`language-switcher-${value}`}
            onClick={() => setLocale(value)}
            className={[
              "min-w-[2.75rem] rounded-md px-3 py-1.5 text-sm font-bold transition-colors",
              active
                ? "bg-orange-500 text-white shadow-sm"
                : "text-gray-700 hover:bg-orange-50 hover:text-orange-700",
            ].join(" ")}
            aria-pressed={active}
            aria-label={label}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
