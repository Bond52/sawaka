"use client";

import { useState } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import FournisseursPage from "@/app/fournisseurs/page";
import ArtisansPage from "@/app/artisans/page";

export default function ReseauPage() {
  const { t } = useTranslation();
  const [networkType, setNetworkType] = useState<
    "fournisseur" | "artisan"
  >("fournisseur");

  return (
    <div className="wrap py-6">
      <div className="flex justify-end mb-6">
        <select
          value={networkType}
          onChange={(e) =>
            setNetworkType(e.target.value as "fournisseur" | "artisan")
          }
          className="
            w-56
            px-4 py-3
            rounded-lg
            border border-sawaka-300
            bg-white
            text-base
            cursor-pointer
            focus:outline-none
            focus:ring-2 focus:ring-sawaka-300
          "
        >
          <option value="fournisseur">{t("network.suppliers")}</option>
          <option value="artisan">{t("network.artisans")}</option>
        </select>
      </div>

      <div>
        {networkType === "fournisseur" ? (
          <FournisseursPage />
        ) : (
          <ArtisansPage />
        )}
      </div>
    </div>
  );
}
