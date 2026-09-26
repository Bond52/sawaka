"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { listPublicArticles } from "../lib/apiSeller";

interface Article {
  _id: string;
  title: string;
  description?: string;
  price: number;
  images?: string[];
  status?: string;
  auction?: {
    isActive?: boolean;
    highestBid?: number;
    endDate?: string;
  };
}

export default function EncheresPage() {
  const { t } = useTranslation();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchEncheres = async () => {
      try {
        setLoading(true);
        setError("");
        const allArticles = await listPublicArticles();
        const encheres = allArticles.filter((a) => a.status === "auction");
        setArticles(encheres);
      } catch (err) {
        console.error("Erreur chargement enchères :", err);
        setError(t("auctions.loadError"));
      } finally {
        setLoading(false);
      }
    };
    fetchEncheres();
  }, [t]);

  const formatTimeLeft = (endDate?: string) => {
    if (!endDate) return t("auctions.inProgress");
    const now = new Date().getTime();
    const end = new Date(endDate).getTime();
    const diff = end - now;
    if (diff <= 0) return t("auctions.ended");
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return t("auctions.timeRemaining", { hours, minutes });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-sawaka-900 mb-6 flex items-center gap-2">
        🏆 <span>{t("auctions.title")}</span>
      </h1>

      {loading ? (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-sawaka-600 mx-auto"></div>
          <p className="mt-4 text-sawaka-700">{t("auctions.loading")}</p>
        </div>
      ) : error ? (
        <p className="text-red-600 text-center py-8">{error}</p>
      ) : articles.length === 0 ? (
        <p className="text-sawaka-600 text-center py-8">
          {t("auctions.empty")}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {articles.map((article) => (
            <div
              key={article._id}
              className="border rounded-2xl shadow-sm hover:shadow-lg transition bg-white flex flex-col"
            >
              <div className="relative">
                <img
                  src={article.images?.[0] || "/placeholder.png"}
                  alt={article.title}
                  className="w-full h-56 object-cover rounded-t-2xl"
                />
                <div className="absolute top-2 left-2 bg-sawaka-600 text-white text-xs px-3 py-1 rounded-full">
                  {t("auctions.bid")}
                </div>
              </div>

              <div className="p-4 flex flex-col flex-1">
                <h2 className="font-semibold text-sawaka-900 text-lg mb-2 line-clamp-2">
                  {article.title}
                </h2>

                <p className="text-sawaka-600 text-sm flex-1 mb-3 line-clamp-3">
                  {article.description || t("products.noDescription")}
                </p>

                <div className="bg-cream-100 rounded-lg p-3 text-sm mb-3">
                  <p className="font-medium text-sawaka-800">
                    {t("auctions.currentOffer")}{" "}
                    <span className="text-green-700 font-bold">
                      {(article.auction?.highestBid ?? article.price).toLocaleString()} {t("common.fcfa")}
                    </span>
                  </p>
                  <p className="text-sawaka-600 mt-1">
                    ⏰ {formatTimeLeft(article.auction?.endDate)}
                  </p>
                </div>

                <Link
                  href={`/produits/${article._id}`}
                  className="btn-primary text-center mt-auto"
                >
                  {t("auctions.seeProduct")}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
