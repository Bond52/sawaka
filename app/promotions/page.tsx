"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { listPublicArticles } from "../lib/apiSeller";
import Link from "next/link";

interface Article {
  _id: string;
  title: string;
  description?: string;
  price: number;
  images?: string[];
  promotion?: {
    isActive: boolean;
    discountPercent: number;
    newPrice: number;
  };
}

export default function PromotionsPage() {
  const { t } = useTranslation();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPromotions = async () => {
      try {
        setLoading(true);
        const allArticles = await listPublicArticles();
        const promos = allArticles.filter(
          (a) => a.promotion?.isActive === true
        );
        setArticles(promos);
      } catch (err) {
        console.error("Erreur chargement promotions :", err);
        setError(t("promotions.loadError"));
      } finally {
        setLoading(false);
      }
    };
    fetchPromotions();
  }, [t]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-sawaka-700">
        💸 {t("promotions.title")}
      </h1>

      {error && (
        <div className="p-3 mb-4 bg-red-50 text-red-700 border border-red-300 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <p>{t("promotions.loading")}</p>
      ) : articles.length === 0 ? (
        <p>{t("promotions.empty")}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {articles.map((a) => (
            <Link
              key={a._id}
              href={`/produits/${a._id}`}
              className="border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all bg-white block"
            >
              <img
                src={a.images?.[0] || "/images/placeholder.png"}
                alt={a.title}
                className="w-full h-48 object-cover"
              />

              <div className="p-4">
                <h3 className="font-semibold text-lg mb-1">{a.title}</h3>

                {a.promotion?.isActive && (
                  <div className="mb-2">
                    <span className="text-sawaka-600 font-semibold">
                      {a.promotion.newPrice.toLocaleString()} {t("common.fcfa")}
                    </span>
                    <span className="ml-2 text-sm line-through text-gray-500">
                      {a.price.toLocaleString()} {t("common.fcfa")}
                    </span>
                    <span className="ml-2 text-xs text-white bg-sawaka-500 px-2 py-1 rounded-full">
                      -{a.promotion.discountPercent}%
                    </span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
