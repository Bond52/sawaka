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
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
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
            className="field !bg-card py-3 pl-12 pr-4"
          />
        </label>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClear}
            data-testid="supplier-directory-clear"
            className="btn btn-outline shrink-0 gap-1.5"
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
          className={selected === "all" ? "chip chip-active" : "chip"}
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
              className={isActive ? "chip chip-active" : "chip"}
            >
              {t(`suppliers.categoryOptions.${opt.value}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
