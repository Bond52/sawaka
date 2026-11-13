"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { listOwnedProjects, projectProgress, type OwnedProject } from "@/app/lib/projects";
import { useRequireMember } from "./useRequireMember";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function MyProjectsPage() {
  const { t } = useTranslation();
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
        <h1 className="font-display text-3xl text-foreground lg:text-4xl">{t("myProjects.title")}</h1>
        <Link
          href="/mes-projets/nouveau"
          data-testid="my-projects-create"
          className={`inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ${focusRing}`}
        >
          {t("myProjects.create")}
        </Link>
      </div>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{t("myProjects.subtitle")}</p>

      {phase === "loading" ? (
        <p role="status" className="mt-8 text-sm text-muted-foreground" data-testid="my-projects-loading">
          {t("common.loading")}
        </p>
      ) : null}

      {phase === "error" ? (
        <div role="alert" data-testid="my-projects-error" className="mt-8 rounded-xl border border-border bg-card px-6 py-12 text-center">
          <p className="text-base text-foreground">{t("myProjects.loadError")}</p>
        </div>
      ) : null}

      {phase === "ready" && projects.length === 0 ? (
        <div data-testid="my-projects-empty" className="mt-8 rounded-xl border border-border bg-card px-6 py-12 text-center">
          <p className="text-base text-foreground">{t("myProjects.empty")}</p>
        </div>
      ) : null}

      {phase === "ready" && projects.length > 0 ? (
        <ul data-testid="my-projects-list" className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {projects.map((project) => {
            const title = project.title.trim() || t("myProjects.untitled");
            const progress = projectProgress(project.stages);
            return (
              <li key={project.id} className="rounded-xl border border-border bg-card p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {project.status === "published"
                    ? t("myProjects.statusPublished")
                    : t("myProjects.statusDraft")}
                </p>
                <h2 className="mt-2 break-words font-display text-xl text-foreground">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground" data-testid={`my-projects-progress-${project.id}`}>
                  {progress.available
                    ? t("myProjects.progressValue", { percent: progress.percent ?? 0 })
                    : t("myProjects.progressUnavailable")}
                </p>
                {project.city || project.country ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[project.city, project.country].filter(Boolean).join(", ")}
                  </p>
                ) : null}
                <Link
                  href={`/mes-projets/${project.id}/modifier`}
                  data-testid={`my-projects-edit-${project.id}`}
                  className={`mt-4 inline-flex min-h-[44px] items-center text-sm font-medium text-primary underline-offset-4 hover:underline ${focusRing}`}
                >
                  {t("myProjects.edit")}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
