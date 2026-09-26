"use client";
import { useState } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import GestionUtilisateurs from "./GestionUtilisateurs";
import GestionCategories from "./GestionCategories";

export default function AdminPage() {
  const { t } = useTranslation();
  const [onglet, setOnglet] = useState<"utilisateurs" | "categories">("utilisateurs");

  return (
    <div className="max-w-5xl mx-auto mt-8 bg-white shadow p-6 rounded-xl">
      <h1 className="text-2xl font-bold mb-6">{t("admin.dashboard")}</h1>

      <div className="flex gap-4 border-b mb-6">
        <button
          onClick={() => setOnglet("utilisateurs")}
          className={`pb-2 ${onglet === "utilisateurs" ? "border-b-2 border-brown-600 font-semibold" : ""}`}
        >
          👥 {t("admin.users")}
        </button>
        <button
          onClick={() => setOnglet("categories")}
          className={`pb-2 ${onglet === "categories" ? "border-b-2 border-brown-600 font-semibold" : ""}`}
        >
          🗂 {t("admin.categories")}
        </button>
      </div>

      {onglet === "utilisateurs" ? <GestionUtilisateurs /> : <GestionCategories />}
    </div>
  );
}
