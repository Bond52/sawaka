"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  getOwnedProject,
  publishOwnedProject,
  PROJECT_UPLOAD_ERROR_KEY,
  SAVED_PROJECT_STORAGE_KEY,
  updateProjectDraft,
  type OwnedProject,
  type ProjectDraftInput,
} from "@/app/lib/projects";
import ProjectDraftForm, { draftFromProject } from "../../ProjectDraftForm";
import ProjectMedia from "../../ProjectMedia";
import ProjectStages from "../../ProjectStages";
import { useRequireMember } from "../../useRequireMember";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function EditProjectPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const ready = useRequireMember();
  const [project, setProject] = useState<OwnedProject | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [justSaved, setJustSaved] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    if (!ready || !params.id) return;
    let cancelled = false;
    setPhase("loading");
    getOwnedProject(params.id).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setPhase("error");
        return;
      }
      const savedId = sessionStorage.getItem(SAVED_PROJECT_STORAGE_KEY);
      if (savedId === result.project.id) {
        sessionStorage.removeItem(SAVED_PROJECT_STORAGE_KEY);
        setJustSaved(true);
      }
      const uploadCode = sessionStorage.getItem(PROJECT_UPLOAD_ERROR_KEY);
      if (uploadCode) {
        sessionStorage.removeItem(PROJECT_UPLOAD_ERROR_KEY);
        setUploadError(uploadCode);
      }
      setProject(result.project);
      setPhase("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [params.id, ready]);

  if (!ready || phase === "loading") {
    return (
      <div className="wrap py-8" data-testid="project-edit-loading">
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  if (phase === "error" || !project) {
    return (
      <div className="wrap py-8" data-testid="project-edit-error">
        <p role="alert" className="text-base text-foreground">{t("myProjects.loadError")}</p>
        <Link href="/mes-projets" className={`mt-4 inline-flex min-h-[44px] items-center text-sm font-medium text-primary ${focusRing}`}>
          {t("myProjects.back")}
        </Link>
      </div>
    );
  }

  return (
    <div className="wrap py-8" data-testid="project-edit">
      <Link
        href="/mes-projets"
        className={`inline-flex min-h-[44px] items-center text-sm font-medium text-primary ${focusRing}`}
        data-testid="project-back"
      >
        {t("myProjects.back")}
      </Link>
      {justSaved ? (
        <p role="status" data-testid="project-save-status" className="mt-4 text-sm text-foreground">
          {t("myProjects.saved")}
        </p>
      ) : null}
      {uploadError ? (
        <p role="alert" data-testid="project-upload-error" className="mt-4 text-sm text-destructive">
          {t(`myProjects.errors.${uploadError}`)}
        </p>
      ) : null}
      <ProjectDraftForm
        initial={draftFromProject(project)}
        heading={t("myProjects.editTitle")}
        lifecycle={project.status}
        onSubmit={async (input: ProjectDraftInput) => {
          const result = await updateProjectDraft(project.id, input);
          if (!result.ok) return result;
          setProject(result.project);
          setJustSaved(false);
          return { ok: true };
        }}
        onPublish={
          project.status === "draft"
            ? async (input: ProjectDraftInput) => {
                const result = await publishOwnedProject(project.id, input);
                if (!result.ok) return result;
                setProject(result.project);
                setJustSaved(false);
                return { ok: true };
              }
            : undefined
        }
      >
        <ProjectStages project={project} onChange={setProject} />
        <ProjectMedia project={project} onChange={setProject} />
      </ProjectDraftForm>
    </div>
  );
}
