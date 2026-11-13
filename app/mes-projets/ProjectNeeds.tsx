"use client";

import { FormEvent, useState } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  createProjectNeed,
  removeProjectNeed,
  updateProjectNeed,
  type NeedKind,
  type NeedStatus,
  type OwnedProject,
  type ProjectNeed,
  type ProjectStage,
} from "@/app/lib/projects";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const KINDS: NeedKind[] = ["skill", "service", "resource", "assistance"];
const STATUSES: NeedStatus[] = ["open", "blocked", "fulfilled", "cancelled"];

type ProjectNeedsProps = {
  projectId: string;
  stage: ProjectStage;
  onChange: (project: OwnedProject) => void;
};

function errorMessage(
  t: (key: string) => string,
  code: string
): string {
  const message = t(`myProjects.errors.${code}`);
  return message.startsWith("myProjects.errors.") ? t("myProjects.errors.SERVER_ERROR") : message;
}

export default function ProjectNeeds({ projectId, stage, onChange }: ProjectNeedsProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<NeedKind | "">("");
  const [status, setStatus] = useState<NeedStatus>("open");
  const [blockerExplanation, setBlockerExplanation] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const apply = (result: Awaited<ReturnType<typeof createProjectNeed>>) => {
    if (result.ok === false) {
      setError(errorMessage(t, result.code));
      return;
    }
    setError("");
    onChange(result.project);
  };

  const addNeed = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError(t("myProjects.errors.NEED_TITLE_REQUIRED"));
      return;
    }
    if (!kind) {
      setError(t("myProjects.errors.NEED_KIND_REQUIRED"));
      return;
    }
    if (status === "blocked" && blockerExplanation.trim().length === 0) {
      setError(t("myProjects.errors.BLOCKER_EXPLANATION_REQUIRED"));
      return;
    }
    setPending(true);
    const result = await createProjectNeed(projectId, stage.id, {
      title,
      description,
      kind,
      status,
      blockerExplanation: status === "blocked" ? blockerExplanation : "",
    });
    setPending(false);
    if (result.ok) {
      setTitle("");
      setDescription("");
      setKind("");
      setStatus("open");
      setBlockerExplanation("");
    }
    apply(result);
  };

  return (
    <div className="mt-4 border-t border-border pt-4" data-testid={`project-needs-${stage.id}`}>
      <h3 className="text-base font-medium text-foreground">{t("myProjects.needs.title")}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{t("myProjects.needs.hint")}</p>
      {stage.needs.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground" data-testid={`project-needs-empty-${stage.id}`}>
          {t("myProjects.needs.empty")}
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {stage.needs.map((need) => (
            <NeedRow
              key={need.id}
              projectId={projectId}
              stageId={stage.id}
              need={need}
              pending={pending}
              setPending={setPending}
              onApply={apply}
            />
          ))}
        </ul>
      )}
      <form className="mt-4 space-y-3" onSubmit={addNeed} data-testid={`project-need-form-${stage.id}`}>
        <div>
          <label htmlFor={`new-need-title-${stage.id}`} className="mb-1 block text-sm font-medium">
            {t("myProjects.needs.needTitle")}
          </label>
          <input
            id={`new-need-title-${stage.id}`}
            data-testid={`new-need-title-${stage.id}`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={`w-full rounded-lg border border-border bg-background px-3 py-2 text-sm ${focusRing}`}
          />
        </div>
        <div>
          <label htmlFor={`new-need-description-${stage.id}`} className="mb-1 block text-sm font-medium">
            {t("myProjects.needs.needDescription")}
          </label>
          <textarea
            id={`new-need-description-${stage.id}`}
            data-testid={`new-need-description-${stage.id}`}
            value={description}
            rows={2}
            onChange={(event) => setDescription(event.target.value)}
            className={`w-full rounded-lg border border-border bg-background px-3 py-2 text-sm ${focusRing}`}
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label htmlFor={`new-need-kind-${stage.id}`} className="mb-1 block text-sm font-medium">
              {t("myProjects.needs.kind")}
            </label>
            <select
              id={`new-need-kind-${stage.id}`}
              data-testid={`new-need-kind-${stage.id}`}
              value={kind}
              onChange={(event) => setKind(event.target.value as NeedKind | "")}
              className={`h-11 w-full rounded-lg border border-border bg-background px-3 text-sm ${focusRing}`}
            >
              <option value="">{t("myProjects.needs.chooseKind")}</option>
              {KINDS.map((item) => (
                <option key={item} value={item}>
                  {t(`myProjects.needs.kinds.${item}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor={`new-need-status-${stage.id}`} className="mb-1 block text-sm font-medium">
              {t("myProjects.needs.status")}
            </label>
            <select
              id={`new-need-status-${stage.id}`}
              data-testid={`new-need-status-${stage.id}`}
              value={status}
              onChange={(event) => setStatus(event.target.value as NeedStatus)}
              className={`h-11 w-full rounded-lg border border-border bg-background px-3 text-sm ${focusRing}`}
            >
              {STATUSES.map((item) => (
                <option key={item} value={item}>
                  {t(`myProjects.needs.statuses.${item}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {status === "blocked" ? (
          <div>
            <label htmlFor={`new-need-blocker-${stage.id}`} className="mb-1 block text-sm font-medium">
              {t("myProjects.needs.blocker")}
            </label>
            <textarea
              id={`new-need-blocker-${stage.id}`}
              data-testid={`new-need-blocker-${stage.id}`}
              value={blockerExplanation}
              rows={2}
              aria-invalid={error === t("myProjects.errors.BLOCKER_EXPLANATION_REQUIRED")}
              onChange={(event) => setBlockerExplanation(event.target.value)}
              className={`w-full rounded-lg border border-border bg-background px-3 py-2 text-sm ${focusRing}`}
            />
          </div>
        ) : null}
        {error ? (
          <p role="alert" data-testid={`project-need-error-${stage.id}`} className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          data-testid={`project-need-add-${stage.id}`}
          disabled={pending}
          className={`inline-flex min-h-[44px] items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-70 ${focusRing}`}
        >
          {t("myProjects.needs.add")}
        </button>
      </form>
    </div>
  );
}

function NeedRow({
  projectId,
  stageId,
  need,
  pending,
  setPending,
  onApply,
}: {
  projectId: string;
  stageId: string;
  need: ProjectNeed;
  pending: boolean;
  setPending: (value: boolean) => void;
  onApply: (result: Awaited<ReturnType<typeof updateProjectNeed>>) => void;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<NeedStatus>(need.status);
  const [blocker, setBlocker] = useState(need.blockerExplanation);
  const [confirming, setConfirming] = useState(false);
  const [rowError, setRowError] = useState("");

  const save = async (patch: Partial<ProjectNeed>) => {
    const nextStatus = patch.status ?? status;
    const nextBlocker = patch.blockerExplanation ?? blocker;
    if (nextStatus === "blocked" && nextBlocker.trim().length === 0) {
      setStatus("blocked");
      setRowError(t("myProjects.errors.BLOCKER_EXPLANATION_REQUIRED"));
      return;
    }
    setPending(true);
    const result = await updateProjectNeed(projectId, stageId, need.id, {
      title: patch.title ?? need.title,
      description: patch.description ?? need.description,
      kind: patch.kind ?? need.kind,
      status: nextStatus,
      blockerExplanation: nextStatus === "blocked" ? nextBlocker : "",
    });
    setPending(false);
    if (result.ok === false) {
      setRowError(errorMessage(t, result.code));
      return;
    }
    setRowError("");
    setStatus(result.project.stages.flatMap((stage) => stage.needs).find((item) => item.id === need.id)?.status ?? nextStatus);
    onApply(result);
  };

  const remove = async () => {
    setPending(true);
    const result = await removeProjectNeed(projectId, stageId, need.id);
    setPending(false);
    onApply(result);
  };

  return (
    <li className="rounded-lg border border-border p-3" data-testid={`project-need-${need.id}`}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-sm font-medium" htmlFor={`need-title-${need.id}`}>
            {t("myProjects.needs.needTitle")}
          </label>
          <input
            id={`need-title-${need.id}`}
            data-testid={`need-title-${need.id}`}
            defaultValue={need.title}
            className={`w-full rounded-lg border border-border bg-background px-3 py-2 text-sm ${focusRing}`}
            onBlur={(event) => {
              if (event.target.value.trim() !== need.title) void save({ title: event.target.value });
            }}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor={`need-kind-${need.id}`}>
            {t("myProjects.needs.kind")}
          </label>
          <select
            id={`need-kind-${need.id}`}
            data-testid={`need-kind-${need.id}`}
            value={need.kind}
            className={`h-11 rounded-lg border border-border bg-background px-3 text-sm ${focusRing}`}
            onChange={(event) => void save({ kind: event.target.value as NeedKind })}
          >
            {KINDS.map((item) => (
              <option key={item} value={item}>
                {t(`myProjects.needs.kinds.${item}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor={`need-status-${need.id}`}>
            {t("myProjects.needs.status")}
          </label>
          <select
            id={`need-status-${need.id}`}
            data-testid={`need-status-${need.id}`}
            value={status}
            className={`h-11 rounded-lg border border-border bg-background px-3 text-sm ${focusRing}`}
            onChange={(event) => {
              const next = event.target.value as NeedStatus;
              setStatus(next);
              void save({ status: next, blockerExplanation: blocker });
            }}
          >
            {STATUSES.map((item) => (
              <option key={item} value={item}>
                {t(`myProjects.needs.statuses.${item}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3">
        <label className="mb-1 block text-sm font-medium" htmlFor={`need-description-${need.id}`}>
          {t("myProjects.needs.needDescription")}
        </label>
        <textarea
          id={`need-description-${need.id}`}
          data-testid={`need-description-${need.id}`}
          defaultValue={need.description}
          rows={2}
          className={`w-full rounded-lg border border-border bg-background px-3 py-2 text-sm ${focusRing}`}
          onBlur={(event) => {
            if (event.target.value !== need.description) void save({ description: event.target.value });
          }}
        />
      </div>
      {status === "blocked" ? (
        <div className="mt-3">
          <label className="mb-1 block text-sm font-medium" htmlFor={`need-blocker-${need.id}`}>
            {t("myProjects.needs.blocker")}
          </label>
          <textarea
            id={`need-blocker-${need.id}`}
            data-testid={`need-blocker-${need.id}`}
            value={blocker}
            rows={2}
            aria-invalid={rowError === t("myProjects.errors.BLOCKER_EXPLANATION_REQUIRED")}
            className={`w-full rounded-lg border border-border bg-background px-3 py-2 text-sm ${focusRing}`}
            onChange={(event) => setBlocker(event.target.value)}
            onBlur={() => {
              if (blocker.trim() !== need.blockerExplanation || need.status !== "blocked") {
                void save({ status: "blocked", blockerExplanation: blocker });
              }
            }}
          />
        </div>
      ) : null}
      {rowError ? (
        <p role="alert" data-testid={`need-error-${need.id}`} className="mt-2 text-sm text-destructive">
          {rowError}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {confirming ? (
          <>
            <button
              type="button"
              data-testid={`need-remove-confirm-${need.id}`}
              disabled={pending}
              className={`inline-flex min-h-[44px] items-center rounded-lg bg-destructive px-3 text-sm font-medium text-destructive-foreground ${focusRing}`}
              onClick={() => void remove()}
            >
              {t("myProjects.needs.confirmRemove")}
            </button>
            <button
              type="button"
              data-testid={`need-remove-cancel-${need.id}`}
              className={`inline-flex min-h-[44px] items-center rounded-lg border border-border px-3 text-sm ${focusRing}`}
              onClick={() => setConfirming(false)}
            >
              {t("myProjects.needs.cancelRemove")}
            </button>
          </>
        ) : (
          <button
            type="button"
            data-testid={`need-remove-${need.id}`}
            disabled={pending}
            className={`inline-flex min-h-[44px] items-center rounded-lg border border-border px-3 text-sm ${focusRing}`}
            onClick={() => setConfirming(true)}
          >
            {t("myProjects.needs.remove")}
          </button>
        )}
      </div>
    </li>
  );
}
