"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listPublicArticles, Article } from "@/app/lib/apiSeller";
import { useTranslation } from "@/src/i18n/I18nProvider";

export default function FeaturedProducts() {
  const { t } = useTranslation();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    listPublicArticles()
      .then((data) => {
        const latest = [...data]
          .sort(
            (a, b) =>
              new Date(b.createdAt ?? 0).getTime() -
              new Date(a.createdAt ?? 0).getTime()
          )
          .slice(0, 4);
        setArticles(latest);
      })
      .catch((err) => {
        console.error("Featured products load error", err);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="wrap py-16">
      <div className="flex items-center justify-between mb-10">
        <h2 className="text-2xl font-bold text-sawaka-800">
          {t("home.featuredProducts")}
        </h2>
        <Link
          href="/produits"
          className="text-orange-500 border border-orange-500 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-50 transition"
        >
          {t("home.seeAll")}
        </Link>
      </div>

      {loading && (
        <div className="text-center py-12 text-sawaka-600">
          {t("home.loadingProducts")}
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-12 text-red-600">
          {t("home.productsLoadError")}
        </div>
      )}

      {!loading && !error && articles.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {articles.map((article) => (
            <div
              key={article._id}
              className="bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition"
            >
              <div className="h-48 bg-cream-100 overflow-hidden">
                {article.images && article.images.length > 0 ? (
                  <img
                    src={article.images[0]}
                    alt={article.title}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl text-sawaka-300">
                    📦
                  </div>
                )}
              </div>
              <div className="p-4 space-y-2">
                <h3 className="font-semibold text-sawaka-800 line-clamp-1">
                  {article.title}
                </h3>
                {article.description && (
                  <p className="text-sm text-sawaka-600 line-clamp-2">
                    {article.description}
                  </p>
                )}
                <div className="text-orange-600 font-semibold">
                  {article.price.toLocaleString()} {t("common.fcfa")}
                </div>
                <Link
                  href={`/produits/${article._id}`}
                  className="inline-block text-sm text-sawaka-600 hover:text-sawaka-800 underline mt-2"
                >
                  {t("home.seeProduct")}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
