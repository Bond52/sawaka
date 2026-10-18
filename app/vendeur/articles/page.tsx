"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LayoutGrid, List, Plus, Search, Upload } from "lucide-react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { listContributorDomains, taxonomyLabel, type TaxonomyItem } from "../../lib/apiContributors";
import { readStoredUser } from "../../lib/authUser";
import {
  deleteOwnedRealization,
  filterPortfolioRealizations,
  loadOwnerPortfolio,
  moveOwnedRealizationToDraft,
  publishOwnedRealization,
  type PortfolioRealization,
  type RealizationStatus,
} from "../../lib/portfolioRealizations";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Phase = "loading" | "ready" | "error" | "signed-out";

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

function categoryName(item: PortfolioRealization, domains: TaxonomyItem[], locale: string): string {
  if (!item.domainId) return "";
  const domain = domains.find((entry) => entry.id === item.domainId);
  return domain ? taxonomyLabel(domain, locale) : "";
}

function formatCompletedOn(value: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale === "fr" ? "fr" : "en", {
    month: "short",
    year: "numeric",
  });
}

function RealizationCard({
  item,
  category,
  selected,
  busy,
  onToggle,
  onPublish,
  onMoveToDraft,
  onDelete,
  layout,
}: {
  item: PortfolioRealization;
  category: string;
  selected: boolean;
  busy: boolean;
  onToggle: (id: string) => void;
  onPublish: (id: string) => void;
  onMoveToDraft: (id: string) => void;
  onDelete: (id: string, trigger: HTMLButtonElement) => void;
  layout: "grid" | "list";
}) {
  const { t, locale } = useTranslation();
  const unavailable = t("dashboard.actionUnavailable");
  const title = item.title.trim();
  const description = item.description.trim();
  const label = title || category || description || t("portfolio.itemLabel", { number: item.sequence });
  const completed = item.completedOn ? formatCompletedOn(item.completedOn, locale) : "";
  const showDescription = Boolean(category && description);

  return (
    <article
      data-testid="portfolio-card"
      data-status={item.status}
      className={`overflow-hidden rounded-xl border bg-card ${
        selected ? "border-primary" : "border-border"
      } ${layout === "list" ? "flex flex-col sm:flex-row" : ""}`}
    >
      <div
        className={`relative overflow-hidden bg-secondary bg-cover bg-center ${
          layout === "list" ? "h-36 shrink-0 sm:h-auto sm:w-40 sm:self-stretch" : "aspect-[4/3]"
        }`}
        style={item.imageUrl ? { backgroundImage: `url("${item.imageUrl}")` } : undefined}
        role="img"
        aria-label={label}
      >
        <label className="absolute left-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md bg-card shadow-sm">
          <input
            type="checkbox"
            className={`h-4 w-4 accent-primary ${focusRing}`}
            checked={selected}
            aria-label={t("portfolio.selectItem", { label })}
            onChange={() => onToggle(item.id)}
          />
        </label>
        <span className="absolute bottom-3 right-3 rounded-full bg-foreground/80 px-2 py-1 text-xs text-card">
          {t(item.imageCount === 1 ? "portfolio.imageCountOne" : "portfolio.imageCount", {
            count: item.imageCount,
          })}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
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
        <h2 className="break-words text-lg font-semibold text-foreground">
          {title
            ? title
            : category || (description ? <span className="line-clamp-3">{description}</span> : label)}
        </h2>
        {title && (category || description || completed) ? (
          <p className="break-words text-sm text-muted-foreground">
            {category || null}
            {category && (description || completed) ? " · " : null}
            {description ? <span className="line-clamp-3">{description}</span> : null}
            {description && completed ? " · " : null}
            {completed}
          </p>
        ) : null}
        {!title && (showDescription || completed) ? (
          <p className="break-words text-sm text-muted-foreground">
            {showDescription ? <span className="line-clamp-3">{description}</span> : null}
            {showDescription && completed ? " · " : null}
            {completed}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-2">
          {item.status === "draft" ? (
            <button
              type="button"
              data-testid="portfolio-publish"
              disabled={busy}
              className={`min-h-[44px] rounded-md px-2 py-1 text-sm font-medium text-foreground ${focusRing} disabled:cursor-not-allowed disabled:opacity-60`}
              onClick={() => onPublish(item.id)}
            >
              {t("portfolio.publish")}
            </button>
          ) : (
            <button
              type="button"
              data-testid="portfolio-move-draft"
              disabled={busy}
              className={`min-h-[44px] rounded-md px-2 py-1 text-sm font-medium text-foreground ${focusRing} disabled:cursor-not-allowed disabled:opacity-60`}
              onClick={() => onMoveToDraft(item.id)}
            >
              {t("portfolio.moveToDraft")}
            </button>
          )}
          <button
            type="button"
            data-testid="portfolio-delete"
            disabled={busy}
            className={`min-h-[44px] rounded-md px-2 py-1 text-sm font-medium text-destructive ${focusRing} disabled:cursor-not-allowed disabled:opacity-60`}
            onClick={(event) => onDelete(item.id, event.currentTarget)}
          >
            {t("portfolio.delete")}
          </button>
          <button
            type="button"
            className={`min-h-[44px] rounded-md px-2 py-1 text-sm text-foreground ${focusRing}`}
            aria-disabled="true"
            title={unavailable}
            onClick={(event) => event.preventDefault()}
          >
            {t("portfolio.edit")}
          </button>
          <button
            type="button"
            className={`min-h-[44px] rounded-md px-2 py-1 text-sm text-foreground ${focusRing}`}
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
  const [phase, setPhase] = useState<Phase>("loading");
  const [items, setItems] = useState<PortfolioRealization[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const [domains, setDomains] = useState<TaxonomyItem[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | RealizationStatus>("");
  const [domainId, setDomainId] = useState("");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState("");
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const lockRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const user = readStoredUser();
    if (!user) {
      setPhase("signed-out");
      setItems([]);
    } else {
      setPhase("loading");
      loadOwnerPortfolio().then((result) => {
        if (cancelled) return;
        if ("items" in result) {
          setItems(result.items);
          setPhase("ready");
          return;
        }
        setItems([]);
        setPhase(result.status === 401 ? "signed-out" : "error");
      });
    }
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
  }, [reloadToken]);

  const labelFor = useMemo(
    () => (item: PortfolioRealization) => categoryName(item, domains, locale),
    [domains, locale]
  );

  const visible = useMemo(
    () => filterPortfolioRealizations(items, { query, status, domainId }, labelFor),
    [items, query, status, domainId, labelFor]
  );
  const selectedCount = selectedIds.length;
  const selectedItems = items.filter((item) => selectedIds.includes(item.id));
  const selectedDraftCount = selectedItems.filter((item) => item.status === "draft").length;
  const selectedPublishedCount = selectedItems.filter((item) => item.status === "published").length;

  function countText(count: number, oneKey: string, manyKey: string): string {
    if (count <= 0) return "";
    return t(count === 1 ? oneKey : manyKey, { count });
  }

  function transitionError(code: string): string {
    if (code === "NOT_READY") return t("portfolio.notReady");
    if (code === "ALREADY_PUBLISHED") return t("portfolio.alreadyPublished");
    if (code === "ALREADY_DRAFT") return t("portfolio.alreadyDraft");
    if (code === "NOT_FOUND") return t("portfolio.notFound");
    return t("portfolio.transitionFailed");
  }

  function closeDeleteDialog() {
    if (lockRef.current) return;
    setPendingDeleteId(null);
    setDialogError("");
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!pendingDeleteId) return;
    cancelRef.current?.focus();
  }, [pendingDeleteId]);

  useEffect(() => {
    if (!pendingDeleteId) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (lockRef.current) return;
        event.preventDefault();
        setPendingDeleteId(null);
        setDialogError("");
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pendingDeleteId]);

  async function applyTransition(kind: "publish" | "draft", ids: string[]) {
    if (busy || ids.length === 0) return;
    setBusy(true);
    setNotice("");
    setActionError("");
    const chosen = items.filter((item) => ids.includes(item.id));
    const applicable = chosen.filter((item) =>
      kind === "publish" ? item.status === "draft" : item.status === "published"
    );
    const skipped = chosen.length - applicable.length;
    let changed = 0;
    let failure = "";
    for (const item of applicable) {
      const result =
        kind === "publish"
          ? await publishOwnedRealization(item.id)
          : await moveOwnedRealizationToDraft(item.id);
      if ("code" in result) {
        failure = transitionError(result.code);
        if (result.code === "ALREADY_PUBLISHED" || result.code === "ALREADY_DRAFT" || result.code === "NOT_FOUND") {
          setReloadToken((current) => current + 1);
        }
        break;
      }
      if ("item" in result) {
        setItems((current) => current.map((row) => (row.id === result.item.id ? result.item : row)));
        changed += 1;
      }
    }
    const changedText = countText(
      changed,
      kind === "publish" ? "portfolio.publishedOne" : "portfolio.draftedOne",
      kind === "publish" ? "portfolio.publishedMany" : "portfolio.draftedMany"
    );
    const skippedText = countText(skipped, "portfolio.skippedOne", "portfolio.skippedMany");
    setNotice([changedText, skippedText].filter(Boolean).join(" "));
    setActionError(failure);
    setBusy(false);
  }

  async function confirmDelete() {
    if (!pendingDeleteId || lockRef.current) return;
    lockRef.current = true;
    setBusy(true);
    setDialogError("");
    const id = pendingDeleteId;
    const result = await deleteOwnedRealization(id);
    lockRef.current = false;
    setBusy(false);
    if ("code" in result) {
      if (result.code === "NOT_FOUND") {
        setPendingDeleteId(null);
        setReloadToken((current) => current + 1);
        setActionError(t("portfolio.notFound"));
        triggerRef.current?.focus();
        return;
      }
      setDialogError(result.code === "IMAGE_CLEANUP_FAILED" ? t("portfolio.cleanupFailed") : t("portfolio.deleteFailed"));
      return;
    }
    setItems((current) => current.filter((item) => item.id !== id));
    setSelectedIds((current) => current.filter((value) => value !== id));
    setPendingDeleteId(null);
    setNotice(t("portfolio.deleted"));
    setActionError("");
    triggerRef.current?.focus();
  }

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
          <button
            type="button"
            data-testid="portfolio-bulk-publish"
            disabled={busy || selectedDraftCount === 0}
            className={`min-h-[44px] rounded-md px-2 py-1 text-card ${focusRing} disabled:cursor-not-allowed disabled:opacity-50`}
            onClick={() => applyTransition("publish", selectedIds)}
          >
            {t("portfolio.publish")}
          </button>
          <button
            type="button"
            data-testid="portfolio-bulk-draft"
            disabled={busy || selectedPublishedCount === 0}
            className={`min-h-[44px] rounded-md px-2 py-1 text-card ${focusRing} disabled:cursor-not-allowed disabled:opacity-50`}
            onClick={() => applyTransition("draft", selectedIds)}
          >
            {t("portfolio.moveToDraft")}
          </button>
          {(["changeCategory", "associateProject"] as const).map((action) => (
            <button
              key={action}
              type="button"
              className={`min-h-[44px] rounded-md px-2 py-1 text-card/80 ${focusRing}`}
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

      {notice ? (
        <p role="status" data-testid="portfolio-lifecycle-status" className="mt-4 text-sm text-foreground">
          {notice}
        </p>
      ) : null}
      {actionError ? (
        <p role="alert" data-testid="portfolio-lifecycle-error" className="mt-4 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {phase === "loading" ? (
        <p
          data-testid="portfolio-loading"
          role="status"
          aria-live="polite"
          className="mt-8 text-sm text-muted-foreground"
        >
          {t("portfolio.loading")}
        </p>
      ) : null}

      {phase === "error" ? (
        <div
          data-testid="portfolio-error"
          role="alert"
          className="mt-8 rounded-xl border border-border bg-card px-6 py-12 text-center"
        >
          <p className="text-base text-foreground">{t("portfolio.loadError")}</p>
          <button
            type="button"
            data-testid="portfolio-retry"
            className={`mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ${focusRing}`}
            onClick={() => setReloadToken((current) => current + 1)}
          >
            {t("portfolio.retry")}
          </button>
        </div>
      ) : null}

      {phase === "signed-out" ? (
        <div
          data-testid="portfolio-signed-out"
          className="mt-8 rounded-xl border border-border bg-card px-6 py-12 text-center"
        >
          <p className="text-base text-foreground">{t("portfolio.signedOut")}</p>
          <Link
            href="/login?redirect=/vendeur/articles"
            data-testid="portfolio-sign-in"
            className={`mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ${focusRing}`}
          >
            {t("portfolio.signIn")}
          </Link>
        </div>
      ) : null}

      {phase === "ready" && items.length === 0 ? (
        <div
          data-testid="portfolio-empty"
          className="mt-8 rounded-xl border border-border bg-card px-6 py-12 text-center"
        >
          <p className="text-base text-foreground">{t("portfolio.empty")}</p>
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
      ) : null}

      {phase === "ready" && items.length > 0 && visible.length === 0 ? (
        <div
          data-testid="portfolio-no-results"
          className="mt-8 rounded-xl border border-border bg-card px-6 py-12 text-center"
        >
          <p className="text-base text-foreground">{t("portfolio.noResults")}</p>
        </div>
      ) : null}

      {phase === "ready" && visible.length > 0 ? (
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
              category={labelFor(item)}
              layout={layout}
              busy={busy}
              selected={selectedIds.includes(item.id)}
              onToggle={toggleSelected}
              onPublish={(id) => applyTransition("publish", [id])}
              onMoveToDraft={(id) => applyTransition("draft", [id])}
              onDelete={(id, trigger) => {
                triggerRef.current = trigger;
                setDialogError("");
                setPendingDeleteId(id);
              }}
            />
          ))}
        </div>
      ) : null}

      {pendingDeleteId ? (
        <div
          className="dialog-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDeleteDialog();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="portfolio-delete-title"
            aria-describedby="portfolio-delete-warning"
            data-testid="portfolio-delete-dialog"
            className="dialog-panel max-h-[85vh] overflow-y-auto"
          >
            <h2 id="portfolio-delete-title" className="dialog-title">
              {t("portfolio.deleteTitle")}
            </h2>
            <p id="portfolio-delete-warning" className="dialog-description">
              {t("portfolio.deleteWarning")}
            </p>
            {dialogError ? (
              <p role="alert" className="field-error mt-3" data-testid="portfolio-delete-error">
                {dialogError}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                ref={cancelRef}
                type="button"
                data-testid="portfolio-delete-cancel"
                disabled={busy}
                onClick={closeDeleteDialog}
                className="btn btn-outline"
              >
                {t("portfolio.cancel")}
              </button>
              <button
                type="button"
                data-testid="portfolio-delete-confirm"
                disabled={busy}
                onClick={confirmDelete}
                className="btn btn-destructive"
              >
                {busy ? t("portfolio.deleting") : t("portfolio.confirmDelete")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
