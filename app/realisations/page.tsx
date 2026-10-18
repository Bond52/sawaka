"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import {
  listContributorDomains,
  taxonomyLabel,
  type TaxonomyItem,
} from "@/app/lib/apiContributors";
import { loadPublishedRealizations } from "@/app/lib/publishedRealizations";
import {
  formatCompletedOn,
  type PublicRealization,
} from "@/app/lib/publicRealizations";
import { useDebouncedValue } from "@/app/lib/useDebouncedValue";
import { useTranslation } from "@/src/i18n/I18nProvider";

/**
 * Public browsing of published realizations.
 * Drafts stay on /vendeur/articles. A detail page is a follow-up:
 * Task — View Realization Details. Cards are not links.
 */
type Phase = "loading" | "empty" | "no-results" | "error" | "ready";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function domainLabel(
  item: PublicRealization,
  domains: TaxonomyItem[],
  locale: string
): string {
  if (!item.domainId) return "";
  const domain = domains.find((entry) => entry.id === item.domainId);
  return domain ? taxonomyLabel(domain, locale) : "";
}

function RealizationCard({
  item,
  category,
}: {
  item: PublicRealization;
  category: string;
}) {
  const { t, locale } = useTranslation();
  const description = item.description.trim();
  const completed = item.completedOn ? formatCompletedOn(item.completedOn, locale) : "";
  const preview = item.imageUrls[0] ?? "";
  const count = item.imageUrls.length;

  return (
    <article
      className="min-w-0 overflow-hidden rounded-xl border border-border bg-card"
      data-testid="published-realization"
    >
      {preview ? (
        <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
          {/* Contributor photo URLs are not covered by a next/image remote pattern. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={t(
              count === 1
                ? "contributorProfile.realizationsPhotoAltOne"
                : "contributorProfile.realizationsPhotoAlt",
              { count }
            )}
            className="h-full w-full object-cover"
            data-testid="published-realization-image"
          />
          {count > 0 ? (
            <p className="absolute bottom-3 right-3 rounded-full bg-foreground/80 px-2 py-1 text-xs text-card">
              <span data-testid="published-realization-count">
                {t(
                  count === 1
                    ? "contributorProfile.realizationsImageCountOne"
                    : "contributorProfile.realizationsImageCount",
                  { count }
                )}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="flex min-w-0 flex-col gap-2 p-4">
        {category ? (
          <p
            className="text-sm font-medium text-primary"
            data-testid="published-realization-domain"
          >
            {category}
          </p>
        ) : null}
        {description ? (
          <p
            className="break-words text-sm text-foreground"
            data-testid="published-realization-description"
          >
            {description}
          </p>
        ) : null}
        {completed ? (
          <p className="text-sm text-muted-foreground">
            <time
              dateTime={item.completedOn || undefined}
              data-testid="published-realization-date"
            >
              {t("contributorProfile.realizationsCompleted", { date: completed })}
            </time>
          </p>
        ) : null}
      </div>
    </article>
  );
}

export default function PublishedRealizationsPage() {
  const { t, locale } = useTranslation();
  const [phase, setPhase] = useState<Phase>("loading");
  const [items, setItems] = useState<PublicRealization[]>([]);
  const [domains, setDomains] = useState<TaxonomyItem[]>([]);
  const [query, setQuery] = useState("");
  const [domainId, setDomainId] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const debouncedQuery = useDebouncedValue(query, 300);

  useEffect(() => {
    let cancelled = false;
    listContributorDomains().then((taxonomy) => {
      if (!cancelled && taxonomy.ok) setDomains(taxonomy.domains);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setPhase("loading");
    loadPublishedRealizations(
      { q: debouncedQuery, domainId },
      controller.signal
    ).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setItems([]);
        setPhase("error");
        return;
      }
      setItems(result.items);
      const filtered = Boolean(debouncedQuery.trim() || domainId);
      if (result.items.length === 0) setPhase(filtered ? "no-results" : "empty");
      else setPhase("ready");
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [debouncedQuery, domainId, reloadToken]);

  return (
    <div className="wrap py-8" data-testid="published-realizations">
      <h1
        id="published-realizations-heading"
        className="font-display text-3xl text-foreground lg:text-4xl"
      >
        {t("navigation.market")}
      </h1>
      <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
        {t("publishedRealizations.intro")}
      </p>

      <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <label
            htmlFor="published-realizations-search"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            {t("portfolio.searchLabel")}
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              id="published-realizations-search"
              data-testid="published-realizations-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("publishedRealizations.searchPlaceholder")}
              className={`h-11 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm ${focusRing}`}
            />
          </div>
        </div>
        <div className="min-w-0 md:w-64">
          <label
            htmlFor="published-realizations-category"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            {t("portfolio.categoryLabel")}
          </label>
          <select
            id="published-realizations-category"
            data-testid="published-realizations-category"
            value={domainId}
            onChange={(event) => setDomainId(event.target.value)}
            className={`h-11 w-full rounded-lg border border-border bg-card px-3 text-sm ${focusRing}`}
          >
            <option value="">{t("portfolio.categoryAll")}</option>
            {domains.map((domain) => (
              <option key={domain.id} value={domain.id}>
                {taxonomyLabel(domain, locale)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-8" aria-busy={phase === "loading"}>
        {phase === "loading" ? (
          <p
            role="status"
            className="text-sm text-muted-foreground"
            data-testid="published-realizations-loading"
          >
            {t("contributorProfile.realizationsLoading")}
          </p>
        ) : null}

        {phase === "error" ? (
          <div role="alert" data-testid="published-realizations-error">
            <p className="text-sm text-destructive">
              {t("contributorProfile.realizationsError")}
            </p>
            <button
              type="button"
              className={`mt-3 inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-medium text-foreground ${focusRing}`}
              data-testid="published-realizations-retry"
              onClick={() => setReloadToken((value) => value + 1)}
            >
              {t("contributorProfile.realizationsRetry")}
            </button>
          </div>
        ) : null}

        {phase === "empty" ? (
          <p
            role="status"
            className="text-sm text-muted-foreground"
            data-testid="published-realizations-empty"
          >
            {t("contributorProfile.realizationsEmpty")}
          </p>
        ) : null}

        {phase === "no-results" ? (
          <p
            role="status"
            className="text-sm text-muted-foreground"
            data-testid="published-realizations-no-results"
          >
            {t("portfolio.noResults")}
          </p>
        ) : null}

        {phase === "ready" ? (
          <ul
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
            aria-labelledby="published-realizations-heading"
            data-testid="published-realizations-list"
          >
            {items.map((item) => (
              <li key={item.id} className="min-w-0">
                <RealizationCard
                  item={item}
                  category={domainLabel(item, domains, locale)}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
