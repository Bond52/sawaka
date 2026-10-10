"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGrid, List, Plus, Search, Upload } from "lucide-react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { listContributorDomains, taxonomyLabel, type TaxonomyItem } from "../../lib/apiContributors";
import {
  filterPortfolioRealizations,
  loadOwnerPortfolio,
  type OwnerPortfolio,
  type PortfolioRealization,
  type RealizationStatus,
} from "../../lib/portfolioRealizations";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function ImportLink({ label, testId }: { label: string; testId: string }) {
  return (
    <Link
      href="/realizations/import"
      data-testid={testId}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ${focusRing}`}
    >
      <Upload className="h-4 w-4" aria-hidden />
      {label}
    </Link>
  );
}

function UnavailableButton({
  label,
  unavailable,
  testId,
  variant,
}: {
  label: string;
  unavailable: string;
  testId: string;
  variant: "primary" | "secondary";
}) {
  const className =
    variant === "primary"
      ? "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-70"
      : "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground opacity-70";

  return (
    <button
      type="button"
      data-testid={testId}
      className={`${className} cursor-not-allowed ${focusRing}`}
      aria-disabled="true"
      title={unavailable}
      onClick={(event) => event.preventDefault()}
    >
      {variant === "primary" ? (
        <Upload className="h-4 w-4" aria-hidden />
      ) : (
        <Plus className="h-4 w-4" aria-hidden />
      )}
      {label}
    </button>
  );
}

function RealizationCard({
  item,
  selected,
  onToggle,
  layout,
}: {
  item: PortfolioRealization;
  selected: boolean;
  onToggle: (id: string) => void;
  layout: "grid" | "list";
}) {
  const { t, locale } = useTranslation();
  const unavailable = t("dashboard.actionUnavailable");
  const completed = item.completedAt
    ? new Date(item.completedAt).toLocaleDateString(locale === "fr" ? "fr" : "en", {
        month: "short",
        year: "numeric",
      })
    : "";

  return (
    <article
      data-testid="portfolio-card"
      className={`overflow-hidden rounded-xl border bg-card ${
        selected ? "border-primary" : "border-border"
      } ${layout === "list" ? "flex flex-col sm:flex-row" : ""}`}
    >
      <div
        className={`relative bg-secondary bg-cover bg-center ${
          layout === "list" ? "h-36 sm:h-auto sm:w-40" : "aspect-[4/3]"
        }`}
        style={item.coverUrl ? { backgroundImage: `url("${item.coverUrl}")` } : undefined}
        role="img"
        aria-label={item.title}
      >
        <label className="absolute left-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md bg-card shadow-sm">
          <input
            type="checkbox"
            className={`h-4 w-4 accent-primary ${focusRing}`}
            checked={selected}
            aria-label={t("portfolio.selectItem", { title: item.title })}
            onChange={() => onToggle(item.id)}
          />
        </label>
        <span className="absolute bottom-3 right-3 rounded-full bg-foreground/80 px-2 py-1 text-xs text-card">
          {t("portfolio.imageCount", { count: item.imageCount })}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="text-sm text-foreground">
          <span
            className={`mr-2 inline-block h-2 w-2 rounded-full ${
              item.status === "published" ? "bg-emerald-600" : "bg-amber-700"
            }`}
            aria-hidden
          />
          {item.status === "published"
            ? t("portfolio.statusPublished")
            : t("portfolio.statusDraft")}
        </p>
        <h2 className="text-lg font-semibold text-foreground">{item.title}</h2>
        <p className="text-sm text-muted-foreground">
          {[item.categoryLabel, completed].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-auto flex gap-2">
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-sm text-foreground ${focusRing}`}
            aria-disabled="true"
            title={unavailable}
            onClick={(event) => event.preventDefault()}
          >
            {t("portfolio.edit")}
          </button>
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-sm text-foreground ${focusRing}`}
            aria-disabled="true"
            title={unavailable}
            onClick={(event) => event.preventDefault()}
          >
            {t("portfolio.preview")}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function VendorArticlesPage() {
  const { t, locale } = useTranslation();
  const unavailable = t("dashboard.actionUnavailable");
  const [portfolio, setPortfolio] = useState<OwnerPortfolio>({ available: false });
  const [domains, setDomains] = useState<TaxonomyItem[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | RealizationStatus>("");
  const [domainId, setDomainId] = useState("");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadOwnerPortfolio().then((result) => {
      if (!cancelled) setPortfolio(result);
    });
    listContributorDomains()
      .then((result) => {
        if (!cancelled && result.ok) setDomains(result.domains);
      })
      .catch(() => {
        if (!cancelled) setDomains([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const items = portfolio.available ? portfolio.items : [];
    return filterPortfolioRealizations(items, { query, status, domainId });
  }, [portfolio, query, status, domainId]);
  const filtersActive = query.trim() !== "" || status !== "" || domainId !== "";
  const selectedCount = selectedIds.length;

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  }

  return (
    <div className="wrap py-8" data-testid="portfolio-management">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <h1 className="font-display text-3xl text-foreground lg:text-4xl">
          {t("portfolio.title")}
        </h1>
        <div className="flex flex-col gap-2 sm:flex-row">
          <UnavailableButton
            label={t("portfolio.add")}
            unavailable={unavailable}
            testId="portfolio-add"
            variant="secondary"
          />
          <ImportLink label={t("portfolio.importMultiple")} testId="portfolio-import" />
        </div>
      </div>
      <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{t("portfolio.subtitle")}</p>

      <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="portfolio-search" className="sr-only">
            {t("portfolio.searchLabel")}
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            id="portfolio-search"
            data-testid="portfolio-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("portfolio.searchPlaceholder")}
            className={`h-11 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm ${focusRing}`}
          />
        </div>
        <label className="sr-only" htmlFor="portfolio-status">
          {t("portfolio.statusLabel")}
        </label>
        <select
          id="portfolio-status"
          data-testid="portfolio-status"
          value={status}
          onChange={(event) => setStatus(event.target.value as "" | RealizationStatus)}
          className={`h-11 rounded-lg border border-border bg-card px-3 text-sm ${focusRing}`}
        >
          <option value="">{t("portfolio.statusAll")}</option>
          <option value="published">{t("portfolio.statusPublished")}</option>
          <option value="draft">{t("portfolio.statusDraft")}</option>
        </select>
        <label className="sr-only" htmlFor="portfolio-category">
          {t("portfolio.categoryLabel")}
        </label>
        <select
          id="portfolio-category"
          data-testid="portfolio-category"
          value={domainId}
          onChange={(event) => setDomainId(event.target.value)}
          className={`h-11 rounded-lg border border-border bg-card px-3 text-sm ${focusRing}`}
        >
          <option value="">{t("portfolio.categoryAll")}</option>
          {domains.map((domain) => (
            <option key={domain.id} value={domain.id}>
              {taxonomyLabel(domain, locale)}
            </option>
          ))}
        </select>
        <div
          role="group"
          aria-label={t("portfolio.viewLabel")}
          className="flex h-11 shrink-0 overflow-hidden rounded-lg border border-border bg-card"
        >
          <button
            type="button"
            data-testid="portfolio-view-grid"
            aria-pressed={layout === "grid"}
            className={`inline-flex w-11 items-center justify-center ${focusRing} ${
              layout === "grid" ? "bg-primary text-primary-foreground" : "text-foreground"
            }`}
            onClick={() => setLayout("grid")}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
            <span className="sr-only">{t("portfolio.viewGrid")}</span>
          </button>
          <button
            type="button"
            data-testid="portfolio-view-list"
            aria-pressed={layout === "list"}
            className={`inline-flex w-11 items-center justify-center ${focusRing} ${
              layout === "list" ? "bg-primary text-primary-foreground" : "text-foreground"
            }`}
            onClick={() => setLayout("list")}
          >
            <List className="h-4 w-4" aria-hidden />
            <span className="sr-only">{t("portfolio.viewList")}</span>
          </button>
        </div>
      </div>

      {selectedCount > 0 ? (
        <div
          data-testid="portfolio-selection-toolbar"
          className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-sm text-card"
        >
          <span>
            {t(selectedCount === 1 ? "portfolio.selectedOne" : "portfolio.selectedMany", {
              count: selectedCount,
            })}
          </span>
          {(["publish", "archive", "changeCategory", "associateProject"] as const).map((action) => (
            <button
              key={action}
              type="button"
              className={`rounded-md px-2 py-1 text-card/80 ${focusRing}`}
              aria-disabled="true"
              title={unavailable}
              onClick={(event) => event.preventDefault()}
            >
              {t(`portfolio.${action}`)}
            </button>
          ))}
          <button
            type="button"
            data-testid="portfolio-clear-selection"
            className={`ml-auto rounded-md px-2 py-1 ${focusRing}`}
            onClick={() => setSelectedIds([])}
          >
            {t("portfolio.clearSelection")}
          </button>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div
          data-testid={filtersActive && portfolio.available ? "portfolio-no-results" : "portfolio-empty"}
          className="mt-8 rounded-xl border border-border bg-card px-6 py-12 text-center"
        >
          <p className="text-base text-foreground">
            {filtersActive && portfolio.available ? t("portfolio.noResults") : t("portfolio.empty")}
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <UnavailableButton
              label={t("portfolio.add")}
              unavailable={unavailable}
              testId="portfolio-empty-add"
              variant="secondary"
            />
            <ImportLink label={t("portfolio.importMultiple")} testId="portfolio-empty-import" />
          </div>
        </div>
      ) : (
        <div
          data-testid="portfolio-results"
          className={
            layout === "grid"
              ? "mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
              : "mt-8 flex flex-col gap-4"
          }
        >
          {visible.map((item) => (
            <RealizationCard
              key={item.id}
              item={item}
              layout={layout}
              selected={selectedIds.includes(item.id)}
              onToggle={toggleSelected}
            />
          ))}
        </div>
      )}
    </div>
  );
}
