"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { listOwnedProjects, projectProgress, type OwnedProject } from "@/app/lib/projects";
import {
  projectCategoryLabel,
  projectCountryLabel,
} from "@/app/lib/projectReferenceData";
import { useRequireMember } from "./useRequireMember";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function MyProjectsPage() {
  const { t, locale } = useTranslation();
  const ready = useRequireMember();
  const [projects, setProjects] = useState<OwnedProject[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setPhase("loading");
    listOwnedProjects().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setPhase("error");
        return;
      }
      setProjects(result.projects);
      setPhase("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  if (!ready) {
    return (
      <div className="wrap py-8" data-testid="my-projects-loading">
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="wrap py-8" data-testid="my-projects">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-3xl text-foreground lg:text-4xl">{t("myProjects.title")}</h1>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{t("myProjects.subtitle")}</p>
        </div>
        <Link
          href="/mes-projets/nouveau"
          data-testid="my-projects-create"
          className={`inline-flex min-h-[44px] w-full shrink-0 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground sm:w-auto ${focusRing}`}
        >
          {t("myProjects.create")}
        </Link>
      </div>

      {phase === "loading" ? (
        <p role="status" className="mt-8 text-sm text-muted-foreground" data-testid="my-projects-loading">
          {t("common.loading")}
        </p>
      ) : null}

      {phase === "error" ? (
        <div
          role="alert"
          data-testid="my-projects-error"
          className="mt-8 rounded-xl border border-border bg-card px-6 py-12 text-center"
        >
          <p className="text-base text-foreground">{t("myProjects.loadError")}</p>
        </div>
      ) : null}

      {phase === "ready" && projects.length === 0 ? (
        <div
          data-testid="my-projects-empty"
          className="mt-8 rounded-xl border border-border bg-card px-6 py-12 text-center"
        >
          <p className="text-base text-foreground">{t("myProjects.empty")}</p>
          <Link
            href="/mes-projets/nouveau"
            className={`mt-4 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ${focusRing}`}
          >
            {t("myProjects.create")}
          </Link>
        </div>
      ) : null}

      {phase === "ready" && projects.length > 0 ? (
        <ul data-testid="my-projects-list" className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {projects.map((project) => {
            const title = project.title.trim() || t("myProjects.untitled");
            const progress = projectProgress(project.stages);
            const published = project.status === "published";
            const place = [project.city, projectCountryLabel(project.country, locale)]
              .filter(Boolean)
              .join(", ");
            return (
              <li
                key={project.id}
                className={`min-w-0 overflow-hidden rounded-xl border bg-card p-4 sm:p-5 ${
                  published ? "border-emerald-200" : "border-border border-dashed"
                }`}
                data-testid={`my-projects-card-${project.id}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={`inline-flex min-h-[28px] items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                      published
                        ? "bg-emerald-100 text-emerald-900"
                        : "bg-amber-100 text-amber-900"
                    }`}
                    data-testid={`my-projects-status-${project.id}`}
                  >
                    {published ? t("myProjects.statusPublished") : t("myProjects.statusDraft")}
                  </p>
                  {project.category ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {projectCategoryLabel(project.category, locale)}
                    </p>
                  ) : null}
                </div>
                <h2 className="mt-3 break-words font-display text-xl text-foreground">{title}</h2>
                {project.summary.trim() ? (
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{project.summary}</p>
                ) : null}
                <p className="mt-2 text-sm text-muted-foreground" data-testid={`my-projects-progress-${project.id}`}>
                  {progress.available
                    ? t("myProjects.progressValue", { percent: progress.percent ?? 0 })
                    : t("myProjects.progressUnavailable")}
                </p>
                {place ? <p className="mt-1 text-sm text-muted-foreground">{place}</p> : null}
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  {published ? (
                    <Link
                      href={`/projets/${project.id}`}
                      data-testid={`my-projects-view-${project.id}`}
                      className={`inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-foreground ${focusRing}`}
                    >
                      {t("myProjects.view")}
                    </Link>
                  ) : null}
                  <Link
                    href={`/mes-projets/${project.id}/modifier`}
                    data-testid={`my-projects-edit-${project.id}`}
                    className={`inline-flex min-h-[44px] items-center justify-center rounded-lg border border-primary px-4 text-sm font-medium text-primary ${focusRing}`}
                  >
                    {t("myProjects.edit")}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
