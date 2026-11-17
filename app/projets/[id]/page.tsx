"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  getPublicProject,
  PROJECT_UPLOAD_ERROR_KEY,
  projectProgress,
  type PublicProject,
} from "@/app/lib/projects";
import {
  projectCategoryLabel,
  projectCountryLabel,
} from "@/app/lib/projectReferenceData";
import ProjectComments from "../ProjectComments";
import ProjectStatusBadge from "../ProjectStatusBadge";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function ProjetDetailPage() {
  const { t, locale } = useTranslation();
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<PublicProject | null>(null);
  const [viewerCanModerate, setViewerCanModerate] = useState(false);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [uploadError, setUploadError] = useState("");
  const [openNeeds, setOpenNeeds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    setPhase("loading");
    getPublicProject(params.id).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setPhase("error");
        return;
      }
      const uploadCode = sessionStorage.getItem(PROJECT_UPLOAD_ERROR_KEY);
      if (uploadCode) {
        sessionStorage.removeItem(PROJECT_UPLOAD_ERROR_KEY);
        setUploadError(uploadCode);
      }
      setProject(result.project);
      setViewerCanModerate(result.viewerCanModerate);
      setPhase("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (phase === "loading") {
    return (
      <div className="wrap py-12" data-testid="public-project-loading">
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  if (phase === "error" || !project) {
    return (
      <div className="wrap py-12" data-testid="public-project-error">
        <p role="alert" className="text-base text-foreground">
          {t("projects.detailUnavailable")}
        </p>
        <Link
          href="/projets"
          className={`mt-4 inline-flex min-h-[44px] items-center text-sm font-medium text-primary ${focusRing}`}
        >
          {t("projects.backToList")}
        </Link>
      </div>
    );
  }

  const progress = projectProgress(project.stages);
  const place = [project.city, projectCountryLabel(project.country, locale)].filter(Boolean).join(", ");
  const stages = [...project.stages].sort((a, b) => a.position - b.position);

  return (
    <div className="wrap py-8 sm:py-12" data-testid="public-project-detail">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/projets"
          className={`inline-flex min-h-[44px] items-center text-sm font-medium text-primary ${focusRing}`}
          data-testid="public-project-back"
        >
          {t("projects.backToList")}
        </Link>
        <Link
          href="/mes-projets"
          className={`ml-4 inline-flex min-h-[44px] items-center text-sm font-medium text-muted-foreground ${focusRing}`}
          data-testid="public-project-my-projects"
        >
          {t("navigation.myProjects")}
        </Link>

        {uploadError ? (
          <p role="alert" data-testid="project-upload-error" className="mt-4 text-sm text-destructive">
            {t(`myProjects.errors.${uploadError}`)}{" "}
            <Link
              href={`/mes-projets/${project.id}/modifier`}
              className={`font-medium underline underline-offset-4 ${focusRing}`}
            >
              {t("projects.fixMedia")}
            </Link>
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <p className="text-xs uppercase tracking-wide text-sawaka-500">
            {projectCategoryLabel(project.category, locale) || t("projects.uncategorized")}
          </p>
          <ProjectStatusBadge status={project.discoveryStatus} testId="public-project-status" />
        </div>
        <h1 className="mt-2 break-words text-3xl font-bold text-sawaka-800 md:text-4xl">
          {project.title.trim() || t("projects.untitled")}
        </h1>
        {place ? <p className="mt-2 text-sm text-sawaka-600">{place}</p> : null}
        <p className="mt-2 text-sm text-muted-foreground" data-testid="public-project-progress">
          {progress.available
            ? t("myProjects.progressValue", { percent: progress.percent ?? 0 })
            : t("myProjects.progressUnavailable")}
        </p>

        {project.coverImage ? (
          <div className="mt-8 overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={project.coverImage.url}
              alt={t("myProjects.media.coverAlt")}
              className="max-h-[28rem] w-full object-cover"
            />
          </div>
        ) : null}

        {project.summary.trim() ? (
          <p className="mt-8 text-base text-sawaka-700">{project.summary}</p>
        ) : null}

        <section className="mt-8" aria-labelledby="public-project-about">
          <h2 id="public-project-about" className="text-xl font-semibold text-sawaka-800">
            {t("projects.about")}
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sawaka-700">{project.description}</p>
        </section>

        <section className="mt-8" aria-labelledby="public-project-objective">
          <h2 id="public-project-objective" className="text-xl font-semibold text-sawaka-800">
            {t("myProjects.fields.objective")}
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sawaka-700">{project.objective}</p>
        </section>

        {project.images.length > 0 ? (
          <section className="mt-8" aria-labelledby="public-project-gallery">
            <h2 id="public-project-gallery" className="text-xl font-semibold text-sawaka-800">
              {t("myProjects.media.gallery")}
            </h2>
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {project.images.map((image) => (
                <li key={image.id} className="overflow-hidden rounded-xl border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt="" className="h-48 w-full object-cover" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-8" aria-labelledby="public-project-stages">
          <h2 id="public-project-stages" className="text-xl font-semibold text-sawaka-800">
            {t("projects.steps")}
          </h2>
          {stages.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t("myProjects.stages.empty")}</p>
          ) : (
            <ol className="mt-4 space-y-4">
              {stages.map((stage, index) => (
                <li
                  key={stage.id}
                  className="rounded-xl border border-border bg-card p-4"
                  data-testid={`public-stage-${stage.id}`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {t("projects.stepPrefix", { n: index + 1 })}
                  </p>
                  <h3 className="mt-1 break-words text-lg font-medium text-foreground">{stage.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(`myProjects.stages.statuses.${stage.status}`)}
                  </p>
                  {stage.description.trim() ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-sawaka-700">{stage.description}</p>
                  ) : null}
                  {stage.needs.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {stage.needs.map((need) => {
                        const open = Boolean(openNeeds[need.id]);
                        return (
                          <li key={need.id} className="rounded-lg bg-secondary px-3 py-2 text-sm">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="font-medium text-foreground">{need.title}</p>
                                <p className="text-muted-foreground">
                                  {t(`myProjects.needs.kinds.${need.kind}`)} ·{" "}
                                  {t(`myProjects.needs.statuses.${need.status}`)}
                                </p>
                                {need.description.trim() ? (
                                  <p className="mt-1 text-sawaka-700">{need.description}</p>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                data-testid={`need-comments-toggle-${need.id}`}
                                className={`inline-flex min-h-[44px] shrink-0 items-center text-sm font-medium text-primary ${focusRing}`}
                                aria-expanded={open}
                                onClick={() =>
                                  setOpenNeeds((current) => ({ ...current, [need.id]: !open }))
                                }
                              >
                                {open
                                  ? t("projects.comments.hideNeed")
                                  : t("projects.comments.showNeed")}
                              </button>
                            </div>
                            {open ? (
                              <ProjectComments
                                projectId={project.id}
                                commentAccess={project.commentAccess}
                                needId={need.id}
                                canModerate={viewerCanModerate}
                              />
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="mt-10 border-t border-border pt-8" aria-labelledby="public-project-comments">
          <h2 id="public-project-comments" className="text-xl font-semibold text-sawaka-800">
            {t("projects.comments.title")}
          </h2>
          <ProjectComments
            projectId={project.id}
            commentAccess={project.commentAccess}
            canModerate={viewerCanModerate}
          />
        </section>
      </div>
    </div>
  );
}
