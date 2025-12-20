"use client";

import { useState } from "react";
import FournisseursPage from "@/app/fournisseurs/page";
import ArtisansPage from "@/app/artisans/page";

export default function ReseauPage() {
  const [networkType, setNetworkType] = useState<
    "fournisseur" | "artisan"
  >("fournisseur");

  return (
    <div className="wrap py-6">

      {/* BARRE HAUTE : SELECTEUR */}
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
          <option value="fournisseur">Fournisseurs</option>
          <option value="artisan">Artisans</option>
        </select>
      </div>

      {/* CONTENU */}
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
