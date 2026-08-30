"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useTranslation } from "@/src/i18n/I18nProvider";

const API =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "https://ecommerce-web-avec-tailwind.onrender.com";

interface Artisan {
  _id: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  createdAt?: string;
  isSeller?: boolean;
  roles?: string[];
  commerceName?: string;
  city?: string;
  province?: string;
}

export default function ArtisansPage() {
  const { t } = useTranslation();
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchArtisans = async () => {
      try {
        const res = await fetch(`${API}/api/artisans`, {
          cache: "no-store",
        });
        const data = await res.json();

        const filtered = data.filter(
          (a: Artisan) => a.isSeller === true || a.roles?.includes("vendeur")
        );

        setArtisans(filtered);
      } catch (error) {
        console.error("Erreur lors du chargement :", error);
      } finally {
        setLoading(false);
      }
    };

    fetchArtisans();
  }, []);

  const filteredArtisans = useMemo(() => {
    return artisans.filter((a) => {
      const displayName =
        a.commerceName ||
        `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim() ||
        a.username ||
        "";

      return (
        displayName.toLowerCase().includes(search.toLowerCase()) ||
        (a.city ?? "").toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [artisans, search]);

  if (loading) {
    return (
      <div className="wrap py-12">
        <p className="text-sawaka-600 text-lg">
          {t("artisans.loading")}
        </p>
      </div>
    );
  }

  return (
    <div className="wrap py-12">
      <h1 className="text-3xl font-bold text-sawaka-700 mb-4">
        {t("artisans.title")}
      </h1>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <input
          type="text"
          placeholder={t("artisans.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-1/2 px-4 py-2 border border-cream-400 rounded-lg focus:ring-2 focus:ring-sawaka-500"
        />
      </div>

      {filteredArtisans.length === 0 ? (
        <p className="text-center text-gray-500 mt-6">
          {t("artisans.empty")}
        </p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
          {filteredArtisans.map((artisan) => {
            const displayName =
              artisan.commerceName ||
              `${artisan.firstName ?? ""} ${artisan.lastName ?? ""}`.trim() ||
              artisan.username;

            return (
              <Link
                key={artisan._id}
                href={`/artisans/${artisan._id}?from=reseau`}
                className="bg-white border border-cream-300 rounded-lg p-6 shadow-sm hover:shadow-md transition-all block"
              >
                <div className="flex justify-center mb-4">
                  <img
                    src={
                      artisan.avatarUrl ||
                      "https://via.placeholder.com/300x300?text=Artisan"
                    }
                    alt={t("artisans.imageAlt")}
                    className="w-40 h-40 object-cover rounded-lg border border-cream-300"
                  />
                </div>

                <h2 className="text-xl font-bold text-sawaka-700 mb-1">
                  {displayName}
                </h2>

                <p className="text-sawaka-600 text-sm mb-2">
                  {artisan.email || t("artisans.emailUnavailable")}
                </p>

                <p className="text-sawaka-500 text-sm">
                  {t("artisans.registeredSince")}{" "}
                  {artisan.createdAt
                    ? new Date(artisan.createdAt).toLocaleDateString()
                    : t("common.na")}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
