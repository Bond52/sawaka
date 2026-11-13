"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  addOwnedProjectImage,
  createOwnedProject,
  pendingContentIssue,
  PROJECT_UPLOAD_ERROR_KEY,
  SAVED_PROJECT_STORAGE_KEY,
  uploadProjectCover,
  uploadStageImage,
  type PendingStage,
  type ProjectDraftInput,
  type ProjectStage,
} from "@/app/lib/projects";
import ProjectDraftForm from "../ProjectDraftForm";
import { PendingProjectMedia } from "../ProjectMedia";
import ProjectStages from "../ProjectStages";
import { useRequireMember } from "../useRequireMember";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function NewProjectPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const ready = useRequireMember();
  const [stages, setStages] = useState<PendingStage[]>([]);
  const [stageFiles, setStageFiles] = useState<Record<string, File[]>>({});
  const [cover, setCover] = useState<File | null>(null);
  const [gallery, setGallery] = useState<File[]>([]);

  if (!ready) {
    return (
      <div className="wrap py-8">
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  const uploadQueued = async (projectId: string, createdStages: ProjectStage[]) => {
    if (cover) {
      const result = await uploadProjectCover(projectId, cover);
      if (result.ok === false) return result.code;
    }
    for (const file of gallery) {
      const result = await addOwnedProjectImage(projectId, file);
      if (result.ok === false) return result.code;
    }
    for (let index = 0; index < stages.length; index += 1) {
      const files = stageFiles[stages[index].id] || [];
      const stageId = createdStages[index]?.id;
      if (!stageId) continue;
      for (const file of files) {
        const result = await uploadStageImage(projectId, stageId, file);
        if (result.ok === false) return result.code;
      }
    }
    return null;
  };

  const persist = async (input: ProjectDraftInput, publish: boolean) => {
    const issue = pendingContentIssue(stages);
    if (issue) return { ok: false as const, status: 400, code: issue };
    const result = await createOwnedProject(input, { publish, stages });
    if (!result.ok) return result;
    const uploadError = await uploadQueued(result.project.id, result.project.stages);
    if (!publish) sessionStorage.setItem(SAVED_PROJECT_STORAGE_KEY, result.project.id);
    if (uploadError) sessionStorage.setItem(PROJECT_UPLOAD_ERROR_KEY, uploadError);
    router.replace(`/mes-projets/${result.project.id}/modifier`);
    return { ok: true as const };
  };

  return (
    <div className="wrap py-8" data-testid="project-create">
      <Link
        href="/mes-projets"
        className={`inline-flex min-h-[44px] items-center text-sm font-medium text-primary ${focusRing}`}
      >
        {t("myProjects.back")}
      </Link>
      <ProjectDraftForm
        heading={t("myProjects.create")}
        lifecycle="new"
        dirtyExtra={stages.length > 0 || cover !== null || gallery.length > 0}
        onSubmit={(input) => persist(input, false)}
        onPublish={(input) => persist(input, true)}
      >
        <ProjectStages
          pendingStages={stages}
          onPendingStages={setStages}
          pendingFiles={stageFiles}
          onPendingFiles={setStageFiles}
        />
        <PendingProjectMedia cover={cover} gallery={gallery} onCover={setCover} onGallery={setGallery} />
      </ProjectDraftForm>
    </div>
  );
}
