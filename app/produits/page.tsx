"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { listPublicArticles } from "../lib/apiSeller";
import type { Article } from "../lib/apiSeller";

const ITEMS_PER_PAGE = 12;

export default function ProduitsPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category");

  /* -------------------------------------------------------------
     FETCH ARTICLES
  -------------------------------------------------------------- */
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await listPublicArticles();

        // 🔎 Filtrage par catégorie (si présente)
        let filtered = data;
        if (categoryParam) {
          const normalized = categoryParam.toLowerCase();
          filtered = data.filter((a: Article) =>
            a.categories?.some((c) =>
              c.toLowerCase().includes(normalized)
            )
          );
        }

        setArticles(filtered);
        setPage(1); // reset pagination lors du changement de catégorie
      } catch (err) {
        console.error("❌ Erreur chargement articles :", err);
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, [categoryParam]);

  /* -------------------------------------------------------------
     PAGINATION
  -------------------------------------------------------------- */
  const totalPages = Math.ceil(articles.length / ITEMS_PER_PAGE);
  const paginatedArticles = articles.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  /* -------------------------------------------------------------
     RENDER
  -------------------------------------------------------------- */
  return (
    <div className="max-w-7xl mx-auto px-4 py-10">

      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-sawaka-800"></div>
          <p className="mt-4 text-sawaka-600">
            Chargement des produits...
          </p>
        </div>
      ) : error ? (
        <p className="text-center text-red-500">{error}</p>
      ) : articles.length === 0 ? (
        <p className="text-center text-sawaka-600">
          Aucun article trouvé dans cette catégorie.
        </p>
      ) : (
        <>
          {/* 🖼️ GRILLE PRODUITS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {paginatedArticles.map((a) => (
              <Link href={`/produits/${a._id}`} key={a._id}>
                <div className="group bg-white rounded-2xl border border-cream-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer">
                  <div className="relative aspect-square bg-cream-100 overflow-hidden">
                    <img
                      src={a.images?.[0] || "/placeholder.png"}
                      alt={a.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  <div className="p-5">
                    <h2 className="text-xl font-bold text-sawaka-800 mb-1 group-hover:text-sawaka-600 transition-colors">
                      {a.title}
                    </h2>

                    <p className="text-sawaka-600 text-sm mb-3 line-clamp-2">
                      {a.description || "Article artisanal unique"}
                    </p>

                    <span className="text-2xl font-semibold text-sawaka-800">
                      {a.price?.toLocaleString()}{" "}
                      <span className="text-sm">FCFA</span>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* 📄 PAGINATION */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-10 space-x-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  onClick={() => setPage(num)}
                  className={`px-4 py-2 rounded-md border transition ${
                    page === num
                      ? "bg-sawaka-800 text-white"
                      : "bg-white text-sawaka-800 hover:bg-cream-200"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
