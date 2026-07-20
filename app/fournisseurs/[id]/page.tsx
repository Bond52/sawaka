"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  getPublicSupplier,
  type PublicSupplier,
} from "@/app/lib/apiSuppliers";
import {
  optionalStringList,
  optionalText,
} from "@/app/lib/supplierDisplay";
import ContactSupplier from "@/app/components/suppliers/ContactSupplier";
import SupplierRetrievalError from "@/app/components/suppliers/SupplierRetrievalError";

const MAX_VISIBLE_TAGS = 4;

function categoryLabel(
  category: string,
  t: (key: string) => string
): string {
  const key = `suppliers.categoryOptions.${category}`;
  const label = t(key);
  return label === key ? category.replace(/_/g, " ") : label;
}

export default function SupplierProfilePage() {
  const { t } = useTranslation();
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";

  const [supplier, setSupplier] = useState<PublicSupplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"not_found" | "load_error" | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const retry = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) {
        setError("not_found");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await getPublicSupplier(id);
        if (cancelled) return;
        if (!data) {
          setSupplier(null);
          setError("not_found");
        } else {
          setSupplier(data);
        }
      } catch (err) {
        console.error("Erreur profil fournisseur :", err);
        if (!cancelled) {
          setSupplier(null);
          setError("load_error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, reloadToken]);

  if (loading) {
    return (
      <div className="wrap py-12" data-testid="supplier-profile-loading">
        <p className="text-lg text-sawaka-600" role="status" aria-live="polite">
          {t("suppliers.profileLoading")}
        </p>
      </div>
    );
  }

  if (error === "load_error") {
    return (
      <div className="wrap py-12" data-testid="supplier-profile-error">
        <SupplierRetrievalError
          testId="supplier-profile-error-banner"
          message={t("suppliers.profileLoadError")}
          onRetry={retry}
          retryLabel={t("suppliers.retry")}
        />
        <Link
          href="/fournisseurs"
          data-testid="supplier-profile-back"
          className="mt-4 inline-flex items-center gap-1.5 text-sawaka-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sawaka-500"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden strokeWidth={2} />
          {t("suppliers.backToDirectory")}
        </Link>
      </div>
    );
  }

  if (error === "not_found" || !supplier) {
    return (
      <div className="wrap py-12" data-testid="supplier-profile-not-found">
        <p className="text-sawaka-700">{t("suppliers.profileNotFound")}</p>
        <Link
          href="/fournisseurs"
          data-testid="supplier-profile-back"
          className="mt-4 inline-flex items-center gap-1.5 text-sawaka-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sawaka-500"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden strokeWidth={2} />
          {t("suppliers.backToDirectory")}
        </Link>
      </div>
    );
  }

  const displayName = optionalText(supplier.name) ?? "";
  const categories = optionalStringList(supplier.categories);
  const primaryCategory = categories[0];
  const resourceTags = optionalStringList(supplier.resources);
  const secondaryTags = [
    ...categories.slice(1).map((c) => categoryLabel(c, t)),
    ...resourceTags,
  ];
  const visibleTags = secondaryTags.slice(0, MAX_VISIBLE_TAGS);
  const overflowCount = Math.max(0, secondaryTags.length - visibleTags.length);

  return (
    <div className="wrap py-10 md:py-12" data-testid="supplier-profile-page">
      <Link
        href="/fournisseurs"
        data-testid="supplier-profile-back"
        className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-sawaka-600 hover:text-sawaka-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sawaka-500"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden strokeWidth={2} />
        {t("suppliers.backToDirectory")}
      </Link>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start lg:gap-12">
        <div>
          {primaryCategory && (
            <p
              className="mb-3"
              data-testid="supplier-profile-primary-category"
            >
              <span className="inline-flex rounded-full bg-cream-100 px-3 py-1 text-xs font-medium text-sawaka-700">
                {categoryLabel(primaryCategory, t)}
              </span>
            </p>
          )}

          <h1
            className="text-3xl font-bold text-sawaka-900 md:text-4xl"
            data-testid="supplier-profile-name"
          >
            {displayName}
          </h1>

          {(visibleTags.length > 0 || overflowCount > 0) && (
            <div
              className="mt-4 flex flex-wrap gap-2"
              data-testid="supplier-profile-categories"
              aria-label={t("suppliers.categoriesAria")}
            >
              {visibleTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex rounded-full bg-sawaka-100 px-2.5 py-1 text-xs font-medium text-sawaka-800"
                >
                  {tag}
                </span>
              ))}
              {overflowCount > 0 && (
                <span className="inline-flex rounded-full bg-sawaka-100 px-2.5 py-1 text-xs font-medium text-sawaka-700">
                  +{overflowCount}
                </span>
              )}
            </div>
          )}
        </div>

        <ContactSupplier
          variant="panel"
          supplierName={displayName}
          publicEmail={supplier.publicEmail}
          phone={supplier.phone}
          website={supplier.website}
          city={supplier.city}
          region={supplier.region}
          country={supplier.country}
          address={supplier.address}
          postalCode={supplier.postalCode}
        />
      </div>
    </div>
  );
}
