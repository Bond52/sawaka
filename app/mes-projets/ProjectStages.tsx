"use client";

import { FormEvent, useState } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  createPendingId,
  createProjectStage,
  projectProgress,
  removeProjectStage,
  reorderProjectStages,
  updateProjectStage,
  type OwnedProject,
  type PendingStage,
  type ProjectStage,
  type StageStatus,
} from "@/app/lib/projects";
import ProjectNeeds from "./ProjectNeeds";
import { StageImages } from "./ProjectMedia";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const controlClass = `w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground ${focusRing}`;

const STATUSES: StageStatus[] = [
  "not_started",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
];

const STATUS_CLASS: Record<StageStatus, string> = {
  not_started: "bg-muted text-foreground",
  in_progress: "bg-amber-100 text-amber-900",
  blocked: "bg-red-100 text-red-800",
  completed: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-muted text-muted-foreground",
};

type ProjectStagesProps = {
  project?: OwnedProject;
  onChange?: (project: OwnedProject) => void;
  pendingStages?: PendingStage[];
  onPendingStages?: (stages: PendingStage[]) => void;
  pendingFiles?: Record<string, File[]>;
  onPendingFiles?: (files: Record<string, File[]>) => void;
};

function asProjectStage(stage: PendingStage, position: number): ProjectStage {
  return {
    id: stage.id,
    title: stage.title,
    description: stage.description,
    position,
    status: stage.status,
    blockerExplanation: stage.blockerExplanation,
    needs: stage.needs,
    images: [],
  };
}

export default function ProjectStages({
  project,
  onChange,
  pendingStages,
  onPendingStages,
  pendingFiles,
  onPendingFiles,
}: ProjectStagesProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const isLocal = pendingStages !== undefined;
  const stages: ProjectStage[] = isLocal
    ? (pendingStages || []).map(asProjectStage)
    : [...(project?.stages || [])].sort((a, b) => a.position - b.position);
  const progress = projectProgress(stages);

  const apply = (result: Awaited<ReturnType<typeof createProjectStage>>) => {
    if (result.ok === false) {
      const message = t(`myProjects.errors.${result.code}`);
      setError(message.startsWith("myProjects.errors.") ? t("myProjects.errors.SERVER_ERROR") : message);
      return;
    }
    setError("");
    onChange?.(result.project);
  };

  const replacePending = (next: PendingStage[]) => {
    onPendingStages?.(next);
    setError("");
  };

  const addStage = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError(t("myProjects.errors.STAGE_TITLE_REQUIRED"));
      return;
    }
    if (isLocal) {
      replacePending([
        ...(pendingStages || []),
        {
          id: createPendingId(),
          title: title.trim(),
          description: description.trim(),
          status: "not_started",
          blockerExplanation: "",
          needs: [],
        },
      ]);
      setTitle("");
      setDescription("");
      return;
    }
    if (!project) return;
    setPending(true);
    const result = await createProjectStage(project.id, {
      title,
      description,
      status: "not_started",
      blockerExplanation: "",
    });
    setPending(false);
    if (result.ok) {
      setTitle("");
      setDescription("");
    }
    apply(result);
  };

  const saveStage = async (stage: ProjectStage, patch: Partial<ProjectStage>) => {
    const next = {
      title: patch.title ?? stage.title,
      description: patch.description ?? stage.description,
      status: patch.status ?? stage.status,
      blockerExplanation: patch.blockerExplanation ?? stage.blockerExplanation,
    };
    if (isLocal) {
      replacePending(
        (pendingStages || []).map((item) =>
          item.id === stage.id ? { ...item, ...next, needs: item.needs } : item
        )
      );
      return;
    }
    if (!project) return;
    setPending(true);
    const result = await updateProjectStage(project.id, stage.id, next);
    setPending(false);
    apply(result);
  };

  const remove = async (stage: ProjectStage) => {
    if (isLocal) {
      if (stage.needs.length > 0) {
        setError(t("myProjects.errors.STAGE_HAS_NEEDS"));
        setConfirmingId(null);
        return;
      }
      replacePending((pendingStages || []).filter((item) => item.id !== stage.id));
      setConfirmingId(null);
      return;
    }
    if (!project) return;
    setPending(true);
    const result = await removeProjectStage(project.id, stage.id);
    setPending(false);
    setConfirmingId(null);
    apply(result);
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= stages.length) return;
    if (isLocal) {
      const next = [...(pendingStages || [])];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      replacePending(next);
      return;
    }
    if (!project) return;
    const next = stages.map((stage) => stage.id);
    const [id] = next.splice(index, 1);
    next.splice(target, 0, id);
    setPending(true);
    const result = await reorderProjectStages(project.id, next);
    setPending(false);
    apply(result);
  };

  return (
    <section
      className="rounded-2xl border border-border bg-secondary p-5 sm:p-8"
      aria-labelledby="project-stages-heading"
      data-testid="project-stages"
    >
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <span className="pt-1 text-sm font-semibold text-primary">02</span>
          <div className="min-w-0">
            <h2 id="project-stages-heading" className="font-display text-2xl text-foreground">
              {t("myProjects.sections.stagesTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("myProjects.sections.stagesText")}</p>
            <p className="mt-2 text-sm text-muted-foreground" data-testid="project-progress">
              {progress.available
                ? t("myProjects.progressValue", { percent: progress.percent ?? 0 })
                : t("myProjects.progressUnavailable")}
            </p>
          </div>
        </div>
        <button
          type="submit"
          form="project-stage-form"
          data-testid="project-stage-add"
          disabled={pending}
          className={`inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl border border-primary bg-card px-4 text-sm font-medium text-primary disabled:opacity-70 ${focusRing}`}
        >
          + {t("myProjects.stages.add")}
        </button>
      </div>

      <form id="project-stage-form" className="mt-5 space-y-3" onSubmit={addStage} data-testid="project-stage-form">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="new-stage-title" className="mb-1 block text-sm font-medium">
              {t("myProjects.stages.stageTitle")}
            </label>
            <input
              id="new-stage-title"
              data-testid="new-stage-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={controlClass}
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="new-stage-description" className="mb-1 block text-sm font-medium">
              {t("myProjects.stages.stageDescription")}
            </label>
            <textarea
              id="new-stage-description"
              data-testid="new-stage-description"
              value={description}
              rows={2}
              onChange={(event) => setDescription(event.target.value)}
              className={controlClass}
            />
          </div>
        </div>
        {error ? (
          <p role="alert" data-testid="project-stage-error" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </form>

      {stages.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground" data-testid="project-stages-empty">
          {t("myProjects.stages.empty")}
        </p>
      ) : (
        <ol className="mt-5 space-y-4" data-testid="project-stage-list">
          {stages.map((stage, index) => {
            const open = !collapsed[stage.id];
            const panelId = `stage-panel-${stage.id}`;
            return (
              <li key={stage.id} className="rounded-xl border border-border bg-card" data-testid={`project-stage-${stage.id}`}>
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border text-sm ${focusRing}`}
                      data-testid={`stage-up-${stage.id}`}
                      aria-label={t("myProjects.stages.moveUp")}
                      disabled={pending || index === 0}
                      onClick={() => void move(index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border text-sm ${focusRing}`}
                      data-testid={`stage-down-${stage.id}`}
                      aria-label={t("myProjects.stages.moveDown")}
                      disabled={pending || index === stages.length - 1}
                      onClick={() => void move(index, 1)}
                    >
                      ↓
                    </button>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{stage.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {stage.needs.length === 1
                        ? t("myProjects.stages.needOne")
                        : t("myProjects.stages.needMany", { count: stage.needs.length })}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${STATUS_CLASS[stage.status]}`}>
                    <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
                    {t(`myProjects.stages.statuses.${stage.status}`)}
                  </span>
                  <button
                    type="button"
                    className={`inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm ${focusRing}`}
                    data-testid={`stage-toggle-${stage.id}`}
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setCollapsed((current) => ({ ...current, [stage.id]: open }))}
                  >
                    {open ? t("myProjects.stages.collapse") : t("myProjects.stages.expand")}
                  </button>
                </div>
                {open ? (
                  <div id={panelId} className="border-t border-border px-4 pb-4 pt-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="min-w-0">
                        <label className="mb-1 block text-sm font-medium" htmlFor={`stage-title-${stage.id}`}>
                          {t("myProjects.stages.stageTitle")}
                        </label>
                        <input
                          id={`stage-title-${stage.id}`}
                          defaultValue={stage.title}
                          data-testid={`stage-title-${stage.id}`}
                          className={controlClass}
                          onBlur={(event) => {
                            if (event.target.value.trim() !== stage.title) {
                              void saveStage(stage, { title: event.target.value });
                            }
                          }}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium" htmlFor={`stage-status-${stage.id}`}>
                          {t("myProjects.stages.status")}
                        </label>
                        <select
                          id={`stage-status-${stage.id}`}
                          data-testid={`stage-status-${stage.id}`}
                          value={stage.status}
                          className={`h-12 w-full rounded-xl border border-border bg-card px-3 text-sm ${focusRing}`}
                          onChange={(event) => void saveStage(stage, { status: event.target.value as StageStatus })}
                        >
                          {STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {t(`myProjects.stages.statuses.${status}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="mb-1 block text-sm font-medium" htmlFor={`stage-description-${stage.id}`}>
                        {t("myProjects.stages.stageDescription")}
                      </label>
                      <textarea
                        id={`stage-description-${stage.id}`}
                        data-testid={`stage-description-${stage.id}`}
                        defaultValue={stage.description}
                        rows={3}
                        className={controlClass}
                        onBlur={(event) => {
                          if (event.target.value !== stage.description) {
                            void saveStage(stage, { description: event.target.value });
                          }
                        }}
                      />
                    </div>
                    {stage.status === "blocked" ? (
                      <div className="mt-3">
                        <label className="mb-1 block text-sm font-medium" htmlFor={`stage-blocker-${stage.id}`}>
                          {t("myProjects.stages.blocker")}
                        </label>
                        <textarea
                          id={`stage-blocker-${stage.id}`}
                          data-testid={`stage-blocker-${stage.id}`}
                          defaultValue={stage.blockerExplanation}
                          rows={3}
                          className={controlClass}
                          onBlur={(event) => {
                            if (event.target.value !== stage.blockerExplanation) {
                              void saveStage(stage, { blockerExplanation: event.target.value });
                            }
                          }}
                        />
                      </div>
                    ) : null}
                    <ProjectNeeds
                      projectId={project?.id || ""}
                      stage={stage}
                      onChange={onChange}
                      onPendingStage={
                        isLocal
                          ? (next) =>
                              replacePending(
                                (pendingStages || []).map((item) =>
                                  item.id === next.id
                                    ? {
                                        id: item.id,
                                        title: next.title,
                                        description: next.description,
                                        status: next.status,
                                        blockerExplanation: next.blockerExplanation,
                                        needs: next.needs,
                                      }
                                    : item
                                )
                              )
                          : undefined
                      }
                    />
                    {project ? (
                      <StageImages projectId={project.id} stageId={stage.id} images={stage.images} onChange={onChange || (() => undefined)} />
                    ) : (
                      <div className="mt-4">
                        <label htmlFor={`pending-stage-image-${stage.id}`} className="mb-1 block text-sm font-medium">
                          {t("myProjects.media.stageImages")}
                        </label>
                        <input
                          id={`pending-stage-image-${stage.id}`}
                          data-testid={`pending-stage-image-${stage.id}`}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className={`block w-full text-sm ${focusRing}`}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (!file || !onPendingFiles) return;
                            onPendingFiles({
                              ...(pendingFiles || {}),
                              [stage.id]: [...(pendingFiles?.[stage.id] || []), file],
                            });
                          }}
                        />
                        <p className="mt-1 text-xs text-muted-foreground">{t("myProjects.media.formats")}</p>
                      </div>
                    )}
                    <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                      {confirmingId === stage.id ? (
                        <div role="alertdialog" aria-labelledby={`stage-remove-heading-${stage.id}`} className="flex flex-col gap-2">
                          <p id={`stage-remove-heading-${stage.id}`} className="text-sm text-foreground">
                            {t("myProjects.stages.confirmRemove")}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              data-testid={`stage-remove-confirm-${stage.id}`}
                              disabled={pending}
                              className={`inline-flex min-h-[44px] items-center rounded-lg bg-destructive px-3 text-sm font-medium text-destructive-foreground ${focusRing}`}
                              onClick={() => void remove(stage)}
                            >
                              {t("myProjects.stages.confirmAction")}
                            </button>
                            <button
                              type="button"
                              data-testid={`stage-remove-cancel-${stage.id}`}
                              className={`inline-flex min-h-[44px] items-center rounded-lg border border-border px-3 text-sm ${focusRing}`}
                              onClick={() => setConfirmingId(null)}
                            >
                              {t("myProjects.stages.cancelRemove")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          data-testid={`stage-remove-${stage.id}`}
                          disabled={pending}
                          className={`inline-flex min-h-[44px] items-center text-sm font-medium text-destructive ${focusRing}`}
                          onClick={() => setConfirmingId(stage.id)}
                        >
                          {t("myProjects.stages.delete")}
                        </button>
                      )}
                      <button
                        type="button"
                        className={`inline-flex min-h-[44px] items-center text-sm text-foreground ${focusRing}`}
                        onClick={() => setCollapsed((current) => ({ ...current, [stage.id]: true }))}
                      >
                        {t("myProjects.stages.collapse")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
