"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";

const CITIES = [
  "Douala",
  "Yaoundé",
  "Bafoussam",
  "Ebolowa",
  "Kribi",
  "Garoua",
  "Maroua",
  "Buea",
  "Bamenda",
  "Bertoua",
  "Ngaoundéré",
  "Limbe",
  "Dschang",
];

export default function ProjectExplorer() {
  const { t } = useTranslation();
  const [projectType, setProjectType] =
    useState<"business" | "creative">("business");
  const [keyword, setKeyword] = useState("");
  const [budget, setBudget] = useState<number>(0);
  const [city, setCity] = useState("");
  const [result, setResult] = useState<{ ok: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword && !budget && !city) return;
    setLoading(true);
    setResult(null);
    setTimeout(() => {
      setResult({ ok: true });
      setLoading(false);
    }, 800);
  }

  useEffect(() => {
    if (result && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [result]);

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-5xl mx-auto bg-white border border-gray-200 rounded-2xl px-6 py-3 flex flex-col md:flex-row gap-3 items-center shadow-sm"
      >
        <input
          type="text"
          placeholder={t("home.searchKeywords")}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="flex-1 h-11 px-4 border border-gray-300 rounded-lg outline-none text-sm focus:border-orange-500"
        />
        <input
          type="text"
          inputMode="numeric"
          placeholder={t("home.budgetFcfa")}
          value={budget || ""}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/\D/g, "");
            setBudget(cleaned === "" ? 0 : Number(cleaned));
          }}
          className="h-11 px-4 border border-gray-300 rounded-lg outline-none text-sm focus:border-orange-500"
        />
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="h-11 px-4 border border-gray-300 rounded-lg bg-white text-sm outline-none focus:border-orange-500"
        >
          <option value="">{t("home.city")}</option>
          {CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-11 px-7 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold transition"
        >
          {t("common.search")}
        </button>
      </form>

      <div className="mt-1.5 flex justify-center gap-6 text-sm text-sawaka-700">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={projectType === "business"}
            onChange={() => setProjectType("business")}
            className="accent-orange-500"
          />
          {t("home.projectTypeBusiness")}
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={projectType === "creative"}
            onChange={() => setProjectType("creative")}
            className="accent-orange-500"
          />
          {t("home.projectTypeCreative")}
        </label>
      </div>

      {loading && (
        <p className="mt-3 text-center text-sm text-sawaka-600">
          {t("home.searching")}
        </p>
      )}

      {result && <div ref={resultsRef} className="mt-8" />}
    </>
  );
}
