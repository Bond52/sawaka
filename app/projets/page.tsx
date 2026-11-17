"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Filter } from "lucide-react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import PublicPageHeader from "@/app/components/PublicPageHeader";
import ProjectStatusBadge from "@/app/projets/ProjectStatusBadge";
import {
  listPublicProjects,
  projectProgress,
  type DiscoveryStatus,
  type NeedKind,
  type NeedStatus,
  type PublicDirectoryQuery,
  type PublicProject,
  type StageStatus,
} from "@/app/lib/projects";
import {
  PROJECT_CATEGORY_OPTIONS,
  PROJECT_COUNTRY_OPTIONS,
  projectCategoryLabel,
  projectCountryLabel,
} from "@/app/lib/projectReferenceData";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const STAGE_STATUSES: StageStatus[] = [
  "not_started",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
];
const NEED_KINDS: NeedKind[] = ["skill", "service", "resource", "assistance"];
const NEED_STATUSES: NeedStatus[] = ["open", "blocked"];
/** Proposed is reserved until moderator-approved AI proposals exist. */
const DISCOVERY_STATUSES: Exclude<DiscoveryStatus, "proposed">[] = [
  "in_progress",
  "blocked",
  "completed",
  "not_started",
];

const EMPTY_FILTERS: PublicDirectoryQuery = {
  q: "",
  category: "",
  country: "",
  city: "",
  stageStatus: "",
  needKind: "",
  needStatus: "",
  discoveryStatus: "",
  page: 1,
};

function readFilters(params: { get(name: string): string | null }): PublicDirectoryQuery {
  return {
    q: params.get("q") || "",
    category: params.get("category") || "",
    country: params.get("country") || "",
    city: params.get("city") || "",
    stageStatus: (params.get("stageStatus") as StageStatus) || "",
    needKind: (params.get("needKind") as NeedKind) || "",
    needStatus: (params.get("needStatus") as NeedStatus) || "",
    discoveryStatus: (params.get("discoveryStatus") as DiscoveryStatus) || "",
    page: Math.max(1, Number(params.get("page") || "1") || 1),
  };
}

function ProjetsEnCoursPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const [draft, setDraft] = useState<PublicDirectoryQuery>(filters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [projects, setProjects] = useState<PublicProject[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setPhase("loading");
      listPublicProjects({ ...filters, limit: 24 }).then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setPhase("error");
          return;
        }
        setProjects(result.projects);
        setTotal(result.total);
        setTotalPages(result.totalPages);
        setPhase("ready");
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [filters]);

  const pushFilters = (next: PublicDirectoryQuery) => {
    const params = new URLSearchParams();
    if (next.q?.trim()) params.set("q", next.q.trim());
    if (next.category) params.set("category", next.category);
    if (next.country) params.set("country", next.country);
    if (next.city?.trim()) params.set("city", next.city.trim());
    if (next.stageStatus) params.set("stageStatus", next.stageStatus);
    if (next.needKind) params.set("needKind", next.needKind);
    if (next.needStatus) params.set("needStatus", next.needStatus);
    if (next.discoveryStatus) params.set("discoveryStatus", next.discoveryStatus);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  const activeChips = [
    filters.q?.trim() ? `${t("projects.search.label")}: ${filters.q.trim()}` : "",
    filters.category ? projectCategoryLabel(filters.category, locale) : "",
    filters.country ? projectCountryLabel(filters.country, locale) : "",
    filters.city?.trim() ? `${t("projects.filters.city")}: ${filters.city.trim()}` : "",
    filters.discoveryStatus
      ? t(`projects.discoveryStatus.${filters.discoveryStatus}`)
      : "",
    filters.stageStatus ? t(`myProjects.stages.statuses.${filters.stageStatus}`) : "",
    filters.needKind ? t(`myProjects.needs.kinds.${filters.needKind}`) : "",
    filters.needStatus ? t(`myProjects.needs.statuses.${filters.needStatus}`) : "",
  ].filter(Boolean);
  const panelFilterCount = [
    filters.category,
    filters.country,
    filters.city?.trim(),
    filters.discoveryStatus,
    filters.stageStatus,
    filters.needKind,
    filters.needStatus,
  ].filter(Boolean).length;

  return (
    <div data-testid="public-projects">
      <PublicPageHeader>
        <h1 className="text-3xl font-bold text-sawaka-800">{t("projects.explore")}</h1>
        <p className="mt-2 text-sawaka-600">{t("projects.subtitle")}</p>
      </PublicPageHeader>

      <div className="wrap py-8">
        <form
          className="rounded-2xl border border-border bg-card p-4 sm:p-5"
          data-testid="project-directory-filters"
          onSubmit={(event) => {
            event.preventDefault();
            pushFilters({ ...draft, page: 1 });
          }}
        >
          <label htmlFor="project-search" className="block text-sm font-medium text-foreground">
            {t("projects.search.label")}
          </label>
          <input
            id="project-search"
            data-testid="project-search"
            value={draft.q || ""}
            className={`mt-2 w-full min-h-[44px] rounded-xl border border-border px-4 py-2 ${focusRing}`}
            placeholder={t("projects.search.placeholder")}
            onChange={(event) => setDraft((current) => ({ ...current, q: event.target.value }))}
          />

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              data-testid="project-filters-toggle"
              aria-expanded={filtersOpen}
              aria-controls="project-filters-panel"
              className={`inline-flex min-h-[44px] items-center justify-between gap-2 rounded-xl border border-border px-4 text-sm font-medium ${focusRing}`}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <span className="inline-flex items-center gap-2">
                <Filter className="h-4 w-4" aria-hidden strokeWidth={2} />
                {t("projects.filters.toggle")}
                {panelFilterCount > 0 ? (
                  <span
                    data-testid="project-filters-count"
                    className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground"
                  >
                    {panelFilterCount}
                  </span>
                ) : null}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`}
                aria-hidden
                strokeWidth={2}
              />
            </button>
            <button
              type="submit"
              data-testid="project-filters-apply"
              className={`inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground ${focusRing}`}
            >
              {t("projects.filters.apply")}
            </button>
            {activeChips.length > 0 ? (
              <button
                type="button"
                data-testid="project-filters-reset"
                className={`inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border px-4 text-sm ${focusRing}`}
                onClick={() => {
                  setDraft(EMPTY_FILTERS);
                  pushFilters(EMPTY_FILTERS);
                }}
              >
                {t("projects.filters.reset")}
              </button>
            ) : null}
          </div>

          {filtersOpen ? (
            <div
              id="project-filters-panel"
              data-testid="project-filters-panel"
              className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              <div>
                <label htmlFor="filter-category" className="mb-1 block text-sm font-medium">
                  {t("projects.filters.category")}
                </label>
                <select
                  id="filter-category"
                  data-testid="filter-category"
                  value={draft.category || ""}
                  className={`h-11 w-full rounded-xl border border-border bg-card px-3 text-sm ${focusRing}`}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, category: event.target.value }))
                  }
                >
                  <option value="">{t("projects.filters.any")}</option>
                  {PROJECT_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {locale === "fr" ? option.nameFR : option.nameEN}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="filter-country" className="mb-1 block text-sm font-medium">
                  {t("projects.filters.country")}
                </label>
                <select
                  id="filter-country"
                  data-testid="filter-country"
                  value={draft.country || ""}
                  className={`h-11 w-full rounded-xl border border-border bg-card px-3 text-sm ${focusRing}`}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, country: event.target.value }))
                  }
                >
                  <option value="">{t("projects.filters.any")}</option>
                  {PROJECT_COUNTRY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {locale === "fr" ? option.nameFR : option.nameEN}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="filter-city" className="mb-1 block text-sm font-medium">
                  {t("projects.filters.city")}
                </label>
                <input
                  id="filter-city"
                  data-testid="filter-city"
                  value={draft.city || ""}
                  className={`h-11 w-full rounded-xl border border-border px-3 text-sm ${focusRing}`}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, city: event.target.value }))
                  }
                />
              </div>
              <div>
                <label htmlFor="filter-discovery-status" className="mb-1 block text-sm font-medium">
                  {t("projects.filters.discoveryStatus")}
                </label>
                <select
                  id="filter-discovery-status"
                  data-testid="filter-discovery-status"
                  value={draft.discoveryStatus || ""}
                  className={`h-11 w-full rounded-xl border border-border bg-card px-3 text-sm ${focusRing}`}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      discoveryStatus: event.target.value as DiscoveryStatus | "",
                    }))
                  }
                >
                  <option value="">{t("projects.filters.any")}</option>
                  {DISCOVERY_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {t(`projects.discoveryStatus.${status}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="filter-stage-status" className="mb-1 block text-sm font-medium">
                  {t("projects.filters.stageStatus")}
                </label>
                <select
                  id="filter-stage-status"
                  data-testid="filter-stage-status"
                  value={draft.stageStatus || ""}
                  className={`h-11 w-full rounded-xl border border-border bg-card px-3 text-sm ${focusRing}`}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      stageStatus: event.target.value as StageStatus | "",
                    }))
                  }
                >
                  <option value="">{t("projects.filters.any")}</option>
                  {STAGE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {t(`myProjects.stages.statuses.${status}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="filter-need-kind" className="mb-1 block text-sm font-medium">
                  {t("projects.filters.needKind")}
                </label>
                <select
                  id="filter-need-kind"
                  data-testid="filter-need-kind"
                  value={draft.needKind || ""}
                  className={`h-11 w-full rounded-xl border border-border bg-card px-3 text-sm ${focusRing}`}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      needKind: event.target.value as NeedKind | "",
                    }))
                  }
                >
                  <option value="">{t("projects.filters.any")}</option>
                  {NEED_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {t(`myProjects.needs.kinds.${kind}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="filter-need-status" className="mb-1 block text-sm font-medium">
                  {t("projects.filters.needStatus")}
                </label>
                <select
                  id="filter-need-status"
                  data-testid="filter-need-status"
                  value={draft.needStatus || ""}
                  className={`h-11 w-full rounded-xl border border-border bg-card px-3 text-sm ${focusRing}`}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      needStatus: event.target.value as NeedStatus | "",
                    }))
                  }
                >
                  <option value="">{t("projects.filters.any")}</option>
                  {NEED_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {t(`myProjects.needs.statuses.${status}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          {activeChips.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2" data-testid="project-active-filters">
              {activeChips.map((chip) => (
                <li
                  key={chip}
                  className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground"
                >
                  {chip}
                </li>
              ))}
            </ul>
          ) : null}
        </form>

        {phase === "loading" ? (
          <p role="status" className="mt-6 text-sm text-muted-foreground" data-testid="public-projects-loading">
            {t("common.loading")}
          </p>
        ) : null}

        {phase === "error" ? (
          <div
            role="alert"
            data-testid="public-projects-error"
            className="mt-6 rounded-xl border border-border bg-card px-6 py-12 text-center"
          >
            <p className="text-base text-foreground">{t("projects.loadError")}</p>
          </div>
        ) : null}

        {phase === "ready" && projects.length === 0 ? (
          <div
            data-testid="public-projects-empty"
            className="mt-6 rounded-xl border border-border bg-card px-6 py-12 text-center"
          >
            <p className="text-base text-foreground">
              {activeChips.length > 0 ? t("projects.search.empty") : t("projects.empty")}
            </p>
          </div>
        ) : null}

        {phase === "ready" && projects.length > 0 ? (
          <>
            <p className="mt-6 text-sm text-muted-foreground" data-testid="public-projects-count">
              {t("projects.search.results", { count: total })}
            </p>
            <ul
              data-testid="public-projects-list"
              className="mx-auto mt-4 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {projects.map((project) => {
                const progress = projectProgress(project.stages);
                const place = [project.city, projectCountryLabel(project.country, locale)]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <li
                    key={project.id}
                    className="overflow-hidden rounded-xl border border-border bg-card"
                    data-testid={`public-project-card-${project.id}`}
                  >
                    <div className="h-44 overflow-hidden bg-cream-100">
                      {project.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={project.coverImage.url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
                          {t("projects.noCover")}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-xs uppercase tracking-wide text-sawaka-500">
                          {projectCategoryLabel(project.category, locale) || t("projects.uncategorized")}
                        </p>
                        <ProjectStatusBadge status={project.discoveryStatus} />
                      </div>
                      <h2 className="mt-1 break-words font-semibold text-sawaka-800">
                        {project.title.trim() || t("projects.untitled")}
                      </h2>
                      {project.summary.trim() ? (
                        <p className="mt-2 line-clamp-3 text-sm text-sawaka-600">{project.summary}</p>
                      ) : null}
                      {place ? <p className="mt-2 text-xs text-sawaka-500">{place}</p> : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {progress.available
                          ? t("myProjects.progressValue", { percent: progress.percent ?? 0 })
                          : t("myProjects.progressUnavailable")}
                      </p>
                      <Link
                        href={`/projets/${project.id}`}
                        data-testid={`public-project-link-${project.id}`}
                        className={`mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-sawaka-600 underline-offset-4 hover:text-sawaka-800 hover:underline ${focusRing}`}
                      >
                        {t("projects.seeProject")}
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
            {totalPages > 1 ? (
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={(filters.page || 1) <= 1}
                  className={`inline-flex min-h-[44px] items-center rounded-lg border border-border px-3 text-sm disabled:opacity-50 ${focusRing}`}
                  onClick={() => pushFilters({ ...filters, page: Math.max(1, (filters.page || 1) - 1) })}
                >
                  {t("projects.filters.prev")}
                </button>
                <span className="text-sm text-muted-foreground">
                  {t("projects.filters.page", { page: filters.page || 1, total: totalPages })}
                </span>
                <button
                  type="button"
                  disabled={(filters.page || 1) >= totalPages}
                  className={`inline-flex min-h-[44px] items-center rounded-lg border border-border px-3 text-sm disabled:opacity-50 ${focusRing}`}
                  onClick={() =>
                    pushFilters({ ...filters, page: Math.min(totalPages, (filters.page || 1) + 1) })
                  }
                >
                  {t("projects.filters.next")}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}


export default function ProjetsPage() {
  return (
    <Suspense
      fallback={
        <div className="wrap py-8" data-testid="public-projects-loading">
          <p className="text-sm text-muted-foreground">…</p>
        </div>
      }
    >
      <ProjetsEnCoursPage />
    </Suspense>
  );
}
