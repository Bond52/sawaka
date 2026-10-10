"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { listPublicArticles } from "../lib/apiSeller";
import Link from "next/link";
import { siteConfig } from "../config/siteConfig";

interface Article {
  _id: string;
  title: string;
  description?: string;
  price: number;
  createdAt?: string;
  images?: string[];
}

export default function NouveautesPage() {
  const { t } = useTranslation();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchNouveautes = async () => {
      try {
        setLoading(true);
        const allArticles = await listPublicArticles();

        let filtered: Article[] = [];

        if (siteConfig.nouveautes.useLimitMode) {
          filtered = allArticles
            .sort(
              (a, b) =>
                new Date(b.createdAt ?? 0).getTime() -
                new Date(a.createdAt ?? 0).getTime()
            )
            .slice(0, siteConfig.nouveautes.limit);
        } else {
          const now = new Date();
          const cutoff = new Date(
            now.getTime() -
              (siteConfig.nouveautes.recentDays * 24 * 60 * 60 * 1000 +
                siteConfig.nouveautes.recentHours * 60 * 60 * 1000)
          );
          filtered = allArticles.filter(
            (a) => new Date(a.createdAt ?? 0) >= cutoff
          );
        }

        setArticles(filtered);
      } catch (err) {
        console.error("Erreur chargement nouveautés :", err);
        setError(t("news.loadError"));
      } finally {
        setLoading(false);
      }
    };
    fetchNouveautes();
  }, [t]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-sawaka-700">
        🆕 {t("news.title")}
      </h1>

      {error && (
        <div className="p-3 mb-4 bg-red-50 text-red-700 border border-red-300 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <p>{t("news.loading")}</p>
      ) : articles.length === 0 ? (
        <p>{t("news.empty")}</p>
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

                <div className="text-sawaka-600 font-medium">
                  {a.price.toLocaleString()} {t("common.fcfa")}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
