"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/src/i18n/I18nProvider";
import PublicPageHeader from "@/app/components/PublicPageHeader";
import {
  listPublicProjects,
  projectProgress,
  type PublicProject,
} from "@/app/lib/projects";
import {
  projectCategoryLabel,
  projectCountryLabel,
} from "@/app/lib/projectReferenceData";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function ProjetsEnCoursPage() {
  const { t, locale } = useTranslation();
  const [projects, setProjects] = useState<PublicProject[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    listPublicProjects().then((result) => {
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
  }, []);

  return (
    <div data-testid="public-projects">
      <PublicPageHeader>
        <h1 className="text-3xl font-bold text-sawaka-800">{t("projects.explore")}</h1>
        <p className="mt-2 text-sawaka-600">{t("projects.subtitle")}</p>
      </PublicPageHeader>

      <div className="wrap py-8">
        {phase === "loading" ? (
          <p role="status" className="text-sm text-muted-foreground" data-testid="public-projects-loading">
            {t("common.loading")}
          </p>
        ) : null}

        {phase === "error" ? (
          <div
            role="alert"
            data-testid="public-projects-error"
            className="rounded-xl border border-border bg-card px-6 py-12 text-center"
          >
            <p className="text-base text-foreground">{t("projects.loadError")}</p>
          </div>
        ) : null}

        {phase === "ready" && projects.length === 0 ? (
          <div
            data-testid="public-projects-empty"
            className="rounded-xl border border-border bg-card px-6 py-12 text-center"
          >
            <p className="text-base text-foreground">{t("projects.empty")}</p>
          </div>
        ) : null}

        {phase === "ready" && projects.length > 0 ? (
          <ul
            data-testid="public-projects-list"
            className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
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
                    <p className="truncate text-xs uppercase tracking-wide text-sawaka-500">
                      {projectCategoryLabel(project.category, locale) || t("projects.uncategorized")}
                    </p>
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
        ) : null}
      </div>
    </div>
  );
}
