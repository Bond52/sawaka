"use client";

import { FormEvent, useState } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  createProjectStage,
  reorderProjectStages,
  updateProjectStage,
  type OwnedProject,
  type ProjectStage,
  type StageStatus,
} from "@/app/lib/projects";
import ProjectNeeds from "./ProjectNeeds";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const STATUSES: StageStatus[] = [
  "not_started",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
];

type ProjectStagesProps = {
  project: OwnedProject;
  onChange: (project: OwnedProject) => void;
};

export default function ProjectStages({ project, onChange }: ProjectStagesProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const stages = [...project.stages].sort((a, b) => a.position - b.position);

  const apply = (result: Awaited<ReturnType<typeof createProjectStage>>) => {
    if (result.ok === false) {
      const message = t(`myProjects.errors.${result.code}`);
      setError(message.startsWith("myProjects.errors.") ? t("myProjects.errors.SERVER_ERROR") : message);
      return;
    }
    setError("");
    onChange(result.project);
  };

  const addStage = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError(t("myProjects.errors.STAGE_TITLE_REQUIRED"));
      return;
    }
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
    setPending(true);
    const result = await updateProjectStage(project.id, stage.id, {
      title: patch.title ?? stage.title,
      description: patch.description ?? stage.description,
      status: patch.status ?? stage.status,
      blockerExplanation: patch.blockerExplanation ?? stage.blockerExplanation,
    });
    setPending(false);
    apply(result);
  };

  const move = async (index: number, direction: -1 | 1) => {
    const next = stages.map((stage) => stage.id);
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [id] = next.splice(index, 1);
    next.splice(target, 0, id);
    setPending(true);
    const result = await reorderProjectStages(project.id, next);
    setPending(false);
    apply(result);
  };

  return (
    <section className="mt-10 max-w-3xl" aria-labelledby="project-stages-heading" data-testid="project-stages">
      <h2 id="project-stages-heading" className="font-display text-2xl text-foreground">
        {t("myProjects.stages.title")}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("myProjects.stages.hint")}</p>

      {stages.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground" data-testid="project-stages-empty">
          {t("myProjects.stages.empty")}
        </p>
      ) : (
        <ol className="mt-4 space-y-4" data-testid="project-stage-list">
          {stages.map((stage, index) => (
            <li key={stage.id} className="rounded-xl border border-border bg-card p-4" data-testid={`project-stage-${stage.id}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-sm font-medium" htmlFor={`stage-title-${stage.id}`}>
                    {t("myProjects.stages.stageTitle")}
                  </label>
                  <input
                    id={`stage-title-${stage.id}`}
                    defaultValue={stage.title}
                    data-testid={`stage-title-${stage.id}`}
                    className={`w-full rounded-lg border border-border bg-background px-3 py-2 text-sm ${focusRing}`}
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
                    className={`h-11 rounded-lg border border-border bg-background px-3 text-sm ${focusRing}`}
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
                  className={`w-full rounded-lg border border-border bg-background px-3 py-2 text-sm ${focusRing}`}
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
                    className={`w-full rounded-lg border border-border bg-background px-3 py-2 text-sm ${focusRing}`}
                    onBlur={(event) => {
                      if (event.target.value !== stage.blockerExplanation) {
                        void saveStage(stage, { blockerExplanation: event.target.value });
                      }
                    }}
                  />
                </div>
              ) : null}
              <ProjectNeeds projectId={project.id} stage={stage} onChange={onChange} />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className={`min-h-[44px] rounded-lg border border-border px-3 text-sm ${focusRing}`}
                  data-testid={`stage-up-${stage.id}`}
                  disabled={pending || index === 0}
                  onClick={() => void move(index, -1)}
                >
                  {t("myProjects.stages.moveUp")}
                </button>
                <button
                  type="button"
                  className={`min-h-[44px] rounded-lg border border-border px-3 text-sm ${focusRing}`}
                  data-testid={`stage-down-${stage.id}`}
                  disabled={pending || index === stages.length - 1}
                  onClick={() => void move(index, 1)}
                >
                  {t("myProjects.stages.moveDown")}
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <form className="mt-6 space-y-3" onSubmit={addStage} data-testid="project-stage-form">
        <div>
          <label htmlFor="new-stage-title" className="mb-1 block text-sm font-medium">
            {t("myProjects.stages.stageTitle")}
          </label>
          <input
            id="new-stage-title"
            data-testid="new-stage-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={`w-full rounded-lg border border-border bg-card px-3 py-2 text-sm ${focusRing}`}
          />
        </div>
        <div>
          <label htmlFor="new-stage-description" className="mb-1 block text-sm font-medium">
            {t("myProjects.stages.stageDescription")}
          </label>
          <textarea
            id="new-stage-description"
            data-testid="new-stage-description"
            value={description}
            rows={3}
            onChange={(event) => setDescription(event.target.value)}
            className={`w-full rounded-lg border border-border bg-card px-3 py-2 text-sm ${focusRing}`}
          />
        </div>
        {error ? (
          <p role="alert" data-testid="project-stage-error" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          data-testid="project-stage-add"
          disabled={pending}
          className={`inline-flex min-h-[44px] items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-70 ${focusRing}`}
        >
          {t("myProjects.stages.add")}
        </button>
      </form>
    </section>
  );
}
