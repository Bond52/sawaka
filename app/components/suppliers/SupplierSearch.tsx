"use client";

import { Search, X } from "lucide-react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { SUPPLIER_CATEGORY_OPTIONS } from "@/app/lib/supplierCategories";

export type SupplierSearchProps = {
  search: string;
  category: string;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onClear: () => void;
};

const chipBase =
  "rounded-full px-3.5 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-sawaka-500 focus-visible:ring-offset-2";
const chipActive = `${chipBase} bg-sawaka-600 text-white shadow-sm`;
const chipInactive = `${chipBase} border border-cream-300 bg-white text-sawaka-700 hover:border-sawaka-300`;

export default function SupplierSearch({
  search,
  category,
  onSearchChange,
  onCategoryChange,
  onClear,
}: SupplierSearchProps) {
  const { t } = useTranslation();
  const selected = category || "all";
  const hasActiveFilters = Boolean(search.trim()) || selected !== "all";

  return (
    <div className="mb-8 space-y-4" data-testid="supplier-search">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">{t("suppliers.searchPlaceholder")}</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-sawaka-400"
            aria-hidden
            strokeWidth={2}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("suppliers.searchPlaceholder")}
            data-testid="supplier-directory-search"
            autoComplete="off"
            enterKeyHint="search"
            className="w-full rounded-xl border border-cream-400 bg-white py-3 pl-11 pr-4 text-sawaka-800 placeholder:text-sawaka-400 focus:border-sawaka-400 focus:outline-none focus:ring-2 focus:ring-sawaka-500"
          />
        </label>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClear}
            data-testid="supplier-directory-clear"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-cream-300 bg-white px-4 py-3 text-sm font-medium text-sawaka-700 hover:border-sawaka-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sawaka-500 focus-visible:ring-offset-2"
          >
            <X className="h-4 w-4" aria-hidden strokeWidth={2} />
            {t("suppliers.clearFilters")}
          </button>
        )}
      </div>

      <div
        role="group"
        aria-label={t("suppliers.categoriesAria")}
        className="flex flex-wrap gap-2"
        data-testid="supplier-directory-categories"
      >
        <button
          type="button"
          data-testid="supplier-filter-all"
          aria-pressed={selected === "all"}
          onClick={() => onCategoryChange("all")}
          className={selected === "all" ? chipActive : chipInactive}
        >
          {t("suppliers.filterAll")}
        </button>

        {SUPPLIER_CATEGORY_OPTIONS.map((opt) => {
          const isActive = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              data-testid={`supplier-filter-${opt.value}`}
              aria-pressed={isActive}
              onClick={() => onCategoryChange(opt.value)}
              className={isActive ? chipActive : chipInactive}
            >
              {t(`suppliers.categoryOptions.${opt.value}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
