"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { listPublicProjects, type PublicProject } from "@/app/lib/projects";
import {
  projectCategoryLabel,
  projectCountryLabel,
} from "@/app/lib/projectReferenceData";

export default function FeaturedProjects() {
  const { t, locale } = useTranslation();
  const [projects, setProjects] = useState<PublicProject[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    listPublicProjects().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setPhase("error");
        return;
      }
      setProjects(result.projects.slice(0, 3));
      setPhase("ready");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section data-testid="featured-projects">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-sawaka-800">{t("home.featuredProjects")}</h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            {t("home.featuredProjectsSubtitle")}
          </p>
        </div>
        <Link
          href="/projets"
          className="shrink-0 self-start rounded-lg border border-orange-500 px-4 py-2 text-sm font-medium text-orange-600 transition hover:bg-orange-50"
        >
          {t("home.seeAll")}
        </Link>
      </div>

      {phase === "loading" ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : null}

      {phase === "error" ? (
        <p role="alert" className="text-sm text-foreground">
          {t("projects.loadError")}
        </p>
      ) : null}

      {phase === "ready" && projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("projects.empty")}</p>
      ) : null}

      {phase === "ready" && projects.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const place = [project.city, projectCountryLabel(project.country, locale)]
              .filter(Boolean)
              .join(", ");
            return (
              <div
                key={project.id}
                className="overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="h-44 overflow-hidden bg-cream-100">
                  {project.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={project.coverImage.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 p-4">
                  <p className="mb-1 truncate text-xs uppercase text-orange-500">
                    {projectCategoryLabel(project.category, locale) || t("projects.uncategorized")}
                  </p>
                  <h3 className="mb-2 line-clamp-2 break-words font-semibold text-sawaka-800">
                    {project.title.trim() || t("projects.untitled")}
                  </h3>
                  {place ? <p className="mb-3 text-xs text-sawaka-500">{place}</p> : null}
                  <Link
                    href={`/projets/${project.id}`}
                    className="text-sm text-orange-600 hover:underline"
                  >
                    {t("home.seeProject")}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
