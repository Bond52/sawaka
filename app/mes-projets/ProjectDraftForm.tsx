"use client";

import { FormEvent, ReactNode, useEffect, useState, type ChangeEvent } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  missingPublicationFields,
  PROJECT_FIELD_LIMITS,
  PUBLICATION_FIELDS,
  type ProjectDraftInput,
  type ProjectFailure,
} from "@/app/lib/projects";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const controlClass = `w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground ${focusRing}`;

const EMPTY_DRAFT: ProjectDraftInput = {
  title: "",
  summary: "",
  description: "",
  objective: "",
  category: "",
  country: "",
  city: "",
};

type FieldName = keyof ProjectDraftInput;

const REQUIRED = new Set<string>(PUBLICATION_FIELDS);

const FIELDS: Array<{ name: FieldName; multiline?: boolean }> = [
  { name: "title" },
  { name: "summary" },
  { name: "description", multiline: true },
  { name: "objective", multiline: true },
  { name: "category" },
  { name: "country" },
  { name: "city" },
];

type ProjectDraftFormProps = {
  initial?: ProjectDraftInput;
  heading: string;
  lifecycle?: "new" | "draft" | "published";
  dirtyExtra?: boolean;
  children?: ReactNode;
  onSubmit: (input: ProjectDraftInput) => Promise<ProjectFailure | { ok: true }>;
  onPublish?: (input: ProjectDraftInput) => Promise<ProjectFailure | { ok: true }>;
};

export function emptyProjectDraft(): ProjectDraftInput {
  return { ...EMPTY_DRAFT };
}

export function draftFromProject(project: ProjectDraftInput): ProjectDraftInput {
  return {
    title: project.title,
    summary: project.summary,
    description: project.description,
    objective: project.objective,
    category: project.category,
    country: project.country,
    city: project.city,
  };
}

function messageFor(t: (key: string) => string, code: string): string {
  const messageKey = code === "PUBLICATION_INCOMPLETE" ? "myProjects.fieldRequired" : `myProjects.errors.${code}`;
  const translated = t(messageKey);
  return translated.startsWith("myProjects.") ? t("myProjects.errors.SERVER_ERROR") : translated;
}

export default function ProjectDraftForm({
  initial,
  heading,
  lifecycle = "new",
  dirtyExtra = false,
  children,
  onSubmit,
  onPublish,
}: ProjectDraftFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<ProjectDraftInput>(initial || EMPTY_DRAFT);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState("");
  const [saved, setSaved] = useState(false);
  const [published, setPublished] = useState(false);
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty && !dirtyExtra) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty, dirtyExtra]);

  const setField = (name: FieldName, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    setSaved(false);
    setPublished(false);
    setDirty(true);
  };

  const lengthErrors = (input: ProjectDraftInput) => {
    const localErrors: Partial<Record<FieldName, string>> = {};
    for (const field of FIELDS) {
      if (input[field.name].trim().length > PROJECT_FIELD_LIMITS[field.name]) {
        localErrors[field.name] = t("myProjects.errors.FIELD_TOO_LONG");
      }
    }
    return localErrors;
  };

  const applyResult = (result: ProjectFailure | { ok: true }, success: "saved" | "published") => {
    if (result.ok === false) {
      const readable = messageFor(t, result.code);
      if (result.fields) {
        const next: Partial<Record<FieldName, string>> = {};
        for (const field of result.fields) {
          if (field in PROJECT_FIELD_LIMITS) next[field as FieldName] = readable;
        }
        setFieldErrors(next);
      }
      setFormError(result.code === "PUBLICATION_INCOMPLETE" ? t("myProjects.errors.PUBLICATION_INCOMPLETE") : readable);
      return;
    }
    setDirty(false);
    setSaved(success === "saved");
    setPublished(success === "published");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setFormError("");
    setSaved(false);
    setPublished(false);
    const localErrors = lengthErrors(values);
    setFieldErrors(localErrors);
    if (Object.keys(localErrors).length > 0) return;
    setBusy("save");
    const result = await onSubmit(values);
    setBusy(null);
    applyResult(result, "saved");
  };

  const handlePublish = async () => {
    if (!onPublish || busy) return;
    setFormError("");
    setSaved(false);
    setPublished(false);
    const localErrors = lengthErrors(values);
    for (const field of missingPublicationFields(values)) {
      localErrors[field] = t("myProjects.fieldRequired");
    }
    setFieldErrors(localErrors);
    if (Object.keys(localErrors).length > 0) {
      setFormError(t("myProjects.errors.PUBLICATION_INCOMPLETE"));
      return;
    }
    setBusy("publish");
    const result = await onPublish(values);
    setBusy(null);
    applyResult(result, "published");
  };

  const stateLabel = busy === "publish"
    ? t("myProjects.publishing")
    : busy === "save"
      ? t("myProjects.saving")
      : published
        ? t("myProjects.published")
        : saved
          ? t("myProjects.saved")
          : dirty || dirtyExtra
            ? t("myProjects.unsaved")
            : lifecycle === "published"
              ? t("myProjects.statusPublished")
              : lifecycle === "draft"
                ? t("myProjects.statusDraft")
                : "";

  const renderField = (field: { name: FieldName; multiline?: boolean }) => {
    const error = fieldErrors[field.name];
    const errorId = `project-${field.name}-error`;
    const counterId = `project-${field.name}-count`;
    const inputId = `project-${field.name}`;
    const describedBy = [error ? errorId : "", counterId].filter(Boolean).join(" ") || undefined;
    const shared = {
      id: inputId,
      name: field.name,
      value: values[field.name],
      maxLength: PROJECT_FIELD_LIMITS[field.name],
      "aria-invalid": Boolean(error),
      "aria-required": REQUIRED.has(field.name),
      "aria-describedby": describedBy,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setField(field.name, event.target.value),
      className: controlClass,
    };
    return (
      <div key={field.name} className="min-w-0">
        <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-foreground">
          {t(`myProjects.fields.${field.name}`)}
          {REQUIRED.has(field.name) ? (
            <span className="text-primary" aria-hidden="true">
              {" "}
              *
            </span>
          ) : null}
        </label>
        {field.multiline ? (
          <textarea {...shared} rows={field.name === "description" ? 6 : 4} data-testid={`project-field-${field.name}`} />
        ) : (
          <input {...shared} type="text" data-testid={`project-field-${field.name}`} />
        )}
        <div className="mt-1 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {field.name === "summary" && !error ? (
              <p className="text-sm text-muted-foreground">{t("myProjects.summaryHint")}</p>
            ) : null}
            {error ? (
              <p id={errorId} role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <p id={counterId} className="shrink-0 text-xs text-muted-foreground">
            {t("myProjects.characterCount", {
              count: values[field.name].length,
              max: PROJECT_FIELD_LIMITS[field.name],
            })}
          </p>
        </div>
      </div>
    );
  };

  const actions = (placement: "top" | "bottom") => (
    <div className={`flex flex-col gap-2 sm:flex-row ${placement === "bottom" ? "mt-8" : ""}`}>
      <button
        type="submit"
        form="project-draft-form"
        data-testid={placement === "top" ? "project-save" : "project-save-bottom"}
        disabled={busy !== null}
        className={`inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70 ${focusRing}`}
      >
        {busy === "save" ? t("myProjects.saving") : t("myProjects.saveDraft")}
      </button>
      {onPublish ? (
        <button
          type="button"
          data-testid={placement === "top" ? "project-publish" : "project-publish-bottom"}
          disabled={busy !== null}
          onClick={() => void handlePublish()}
          className={`inline-flex min-h-[44px] items-center justify-center rounded-xl border border-primary bg-card px-4 py-2 text-sm font-medium text-primary disabled:cursor-not-allowed disabled:opacity-70 ${focusRing}`}
        >
          {busy === "publish" ? t("myProjects.publishing") : t("myProjects.publishProject")}
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-3xl text-foreground lg:text-4xl">{heading}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("myProjects.draftHint")}</p>
          {stateLabel ? (
            <p className="mt-2 text-sm text-foreground" data-testid="project-editor-state">
              {stateLabel}
            </p>
          ) : null}
        </div>
        {actions("top")}
      </div>

      <form id="project-draft-form" className="mt-6" onSubmit={handleSubmit} data-testid="project-draft-form" noValidate>
        <section
          aria-labelledby="project-information-heading"
          data-testid="project-section-information"
          className="rounded-2xl border border-border bg-secondary p-5 sm:p-8"
        >
          <div className="flex gap-4 border-b border-border pb-5">
            <span className="pt-1 text-sm font-semibold text-primary">01</span>
            <div>
              <h2 id="project-information-heading" className="font-display text-2xl text-foreground">
                {t("myProjects.sections.informationTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("myProjects.sections.informationText")}</p>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            {FIELDS.filter((field) => field.name !== "country" && field.name !== "city").map((field) =>
              renderField(field)
            )}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {renderField({ name: "country" })}
              {renderField({ name: "city" })}
            </div>
          </div>
        </section>

        {formError ? (
          <p role="alert" data-testid="project-form-error" className="mt-4 text-sm text-destructive">
            {formError}
          </p>
        ) : null}
        {saved ? (
          <p role="status" data-testid="project-save-status" className="mt-4 text-sm text-foreground">
            {t("myProjects.saved")}
          </p>
        ) : null}
        {published ? (
          <p role="status" data-testid="project-publish-status" className="mt-4 text-sm text-foreground">
            {t("myProjects.published")}
          </p>
        ) : null}
      </form>

      <div className="mt-6 space-y-6">{children}</div>
      {actions("bottom")}
    </div>
  );
}
