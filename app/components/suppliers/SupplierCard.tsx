"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  formatSupplierCityCountry,
  optionalStringList,
  optionalText,
} from "@/app/lib/supplierDisplay";

export type SupplierCardProps = {
  id: string;
  name: string;
  categories: string[];
  city?: string;
  country?: string;
  resources?: string[];
};

export function supplierProfilePath(id: string): string {
  return `/fournisseurs/${encodeURIComponent(id)}`;
}

export default function SupplierCard({
  id,
  name,
  categories,
  city,
  country,
  resources,
}: SupplierCardProps) {
  const { t } = useTranslation();

  const displayName = optionalText(name) ?? "";
  const safeCategories = optionalStringList(categories);
  const safeResources = optionalStringList(resources);
  const location = formatSupplierCityCountry(city, country);
  const href = supplierProfilePath(id);
  const profileAria = t("suppliers.cardProfileAria", {
    name: displayName || t("suppliers.title"),
  });

  return (
    <Link
      href={href}
      data-testid="supplier-card"
      data-supplier-id={id}
      aria-label={profileAria}
      className="group block rounded-xl border border-cream-300 bg-white p-5 shadow-sm transition-all hover:border-sawaka-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sawaka-500 focus-visible:ring-offset-2"
    >
      {safeCategories.length > 0 && (
        <div
          className="mb-3 flex flex-wrap gap-2"
          data-testid="supplier-card-categories"
        >
          {safeCategories.map((category) => {
            const labelKey = `suppliers.categoryOptions.${category}`;
            const label = t(labelKey);
            const display =
              label === labelKey ? category.replace(/_/g, " ") : label;
            return (
              <span
                key={category}
                className="inline-flex rounded-full bg-cream-100 px-2.5 py-1 text-xs font-medium text-sawaka-700"
              >
                {display}
              </span>
            );
          })}
        </div>
      )}

      <h2
        className="text-xl font-bold text-sawaka-800 group-hover:text-sawaka-700"
        data-testid="supplier-card-name"
      >
        {displayName}
      </h2>

      {location && (
        <p
          className="mt-3 flex items-start gap-1.5 text-sm text-sawaka-600"
          data-testid="supplier-card-location"
        >
          <MapPin
            className="mt-0.5 h-4 w-4 shrink-0 text-sawaka-500"
            aria-hidden
            strokeWidth={2}
          />
          <span>{location}</span>
        </p>
      )}

      {safeResources.length > 0 && (
        <div className="mt-4" data-testid="supplier-card-resources">
          <p className="mb-2 text-sm font-medium text-sawaka-700">
            {t("suppliers.productsLabel")}
          </p>
          <div className="flex flex-wrap gap-2">
            {safeResources.map((resource) => (
              <span
                key={resource}
                className="inline-flex rounded-md border border-cream-300 bg-cream-50 px-2 py-1 text-xs text-sawaka-700"
              >
                {resource}
              </span>
            ))}
          </div>
        </div>
      )}
    </Link>
  );
}
