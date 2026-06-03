import en from "@/src/locales/en.json";
import fr from "@/src/locales/fr.json";

export type Locale = "en" | "fr";

export const LOCALES: Locale[] = ["en", "fr"];
export const DEFAULT_LOCALE: Locale = "en";
export const STORAGE_KEY = "sawaka-locale";

const dictionaries: Record<Locale, Record<string, unknown>> = { en, fr };

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/** Missing fr → en; missing en → key string */
export function translate(locale: Locale, key: string): string {
  const enValue = getNested(dictionaries.en as Record<string, unknown>, key);
  const frValue = getNested(dictionaries.fr as Record<string, unknown>, key);

  if (locale === "fr") {
    if (typeof frValue === "string") return frValue;
    if (typeof enValue === "string") return enValue;
    return key;
  }

  if (typeof enValue === "string") return enValue;
  return key;
}

export function translateWithParams(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>
): string {
  let text = translate(locale, key);
  if (!params) return text;
  for (const [name, value] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${name}\\}`, "g"), String(value));
  }
  return text;
}

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "fr";
}

export function getBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith("fr")) return "fr";
  return DEFAULT_LOCALE;
}

export function getStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** User preference → browser → English */
export function resolveInitialLocale(): Locale {
  return getStoredLocale() ?? getBrowserLocale();
}

export function persistLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore quota / private mode */
  }
}

export { dictionaries };
