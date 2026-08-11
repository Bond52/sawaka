"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  listPublicSuppliers,
  type PublicSupplier,
} from "@/app/lib/apiSuppliers";
import { isSupplierCategory } from "@/app/lib/supplierCategories";
import { useDebouncedValue } from "@/app/lib/useDebouncedValue";
import SupplierCard from "@/app/components/suppliers/SupplierCard";
import SupplierSearch from "@/app/components/suppliers/SupplierSearch";
import SupplierRetrievalError from "@/app/components/suppliers/SupplierRetrievalError";

const SEARCH_DEBOUNCE_MS = 300;

function parseCategoryParam(value: string | null): string {
  if (!value) return "all";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "all") return "all";
  return isSupplierCategory(trimmed) ? trimmed : "all";
}

function buildDirectoryQuery(search: string, category: string): string {
  const params = new URLSearchParams();
  const trimmedSearch = search.trim();
  if (trimmedSearch) params.set("search", trimmedSearch);
  if (category && category !== "all") params.set("category", category);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function SupplierDirectoryContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlSearch = (searchParams.get("search") ?? "").trim();
  const urlCategory = parseCategoryParam(searchParams.get("category"));

  const [searchInput, setSearchInput] = useState(urlSearch);
  const debouncedSearchInput = useDebouncedValue(
    searchInput,
    SEARCH_DEBOUNCE_MS
  );
  const trimmedDebouncedSearch = debouncedSearchInput.trim();

  const [suppliers, setSuppliers] = useState<PublicSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Keep the input aligned when URL changes (back/forward, clear, deep link).
  useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);

  // Persist debounced search in the URL without flooding history.
  // Skip stale debounced values when the input has already changed (e.g. clear).
  useEffect(() => {
    if (trimmedDebouncedSearch === urlSearch) return;
    if (searchInput.trim() !== trimmedDebouncedSearch) return;
    router.replace(
      `${pathname}${buildDirectoryQuery(trimmedDebouncedSearch, urlCategory)}`,
      { scroll: false }
    );
  }, [
    trimmedDebouncedSearch,
    urlSearch,
    urlCategory,
    pathname,
    router,
    searchInput,
  ]);

  const setCategory = useCallback(
    (nextCategory: string) => {
      const normalized = parseCategoryParam(nextCategory);
      router.replace(
        `${pathname}${buildDirectoryQuery(searchInput, normalized)}`,
        { scroll: false }
      );
    },
    [pathname, router, searchInput]
  );

  const clearFilters = useCallback(() => {
    setSearchInput("");
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await listPublicSuppliers({
        search: urlSearch || undefined,
        category: urlCategory !== "all" ? urlCategory : undefined,
      });
      setSuppliers(data);
    } catch (err) {
      console.error("Erreur fournisseurs :", err);
      setSuppliers([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [urlSearch, urlCategory]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  return (
    <div data-testid="supplier-directory-page">
      <div className="border-b border-border bg-card">
        <div className="wrap py-8 lg:py-12">
          <h1
            className="font-display text-3xl text-foreground lg:text-4xl"
            data-testid="supplier-directory-title"
          >
            {t("suppliers.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {t("suppliers.subtitle")}
          </p>
        </div>
      </div>

      <div className="wrap py-8">
        <SupplierSearch
          search={searchInput}
          category={urlCategory}
          onSearchChange={setSearchInput}
          onCategoryChange={setCategory}
          onClear={clearFilters}
        />

        {loading ? (
          <p
            className="text-lg text-muted-foreground"
            data-testid="supplier-directory-loading"
            role="status"
            aria-live="polite"
          >
            {t("suppliers.loading")}
          </p>
        ) : error ? (
          <SupplierRetrievalError
            testId="supplier-directory-error"
            message={
              urlSearch || urlCategory !== "all"
                ? t("suppliers.searchLoadError")
                : t("suppliers.loadError")
            }
            onRetry={() => {
              void loadSuppliers();
            }}
            retryLabel={t("suppliers.retry")}
          />
        ) : suppliers.length === 0 ? (
          <p
            className="mt-6 text-center text-muted-foreground"
            data-testid="supplier-directory-empty"
          >
            {urlSearch || urlCategory !== "all"
              ? t("suppliers.noResults")
              : t("suppliers.empty")}
          </p>
        ) : (
          <div
            className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            data-testid="supplier-directory-list"
          >
            {suppliers.map((supplier) => (
              <SupplierCard
                key={supplier.id}
                id={supplier.id}
                name={supplier.name}
                categories={supplier.categories}
                city={supplier.city}
                country={supplier.country}
                resources={supplier.resources}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SupplierDirectoryFallback() {
  const { t } = useTranslation();
  return (
    <div data-testid="supplier-directory-page">
      <div className="wrap py-12">
        <p
          className="text-lg text-muted-foreground"
          data-testid="supplier-directory-loading"
          role="status"
        >
          {t("suppliers.loading")}
        </p>
      </div>
    </div>
  );
}

export default function FournisseursPage() {
  return (
    <Suspense fallback={<SupplierDirectoryFallback />}>
      <SupplierDirectoryContent />
    </Suspense>
  );
}
