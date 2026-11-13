"use client";

import { FormEvent, useState, type ChangeEvent } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  PROJECT_FIELD_LIMITS,
  type ProjectDraftInput,
  type ProjectFailure,
} from "@/app/lib/projects";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
  onSubmit: (input: ProjectDraftInput) => Promise<ProjectFailure | { ok: true }>;
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

export default function ProjectDraftForm({
  initial,
  heading,
  onSubmit,
}: ProjectDraftFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<ProjectDraftInput>(initial || EMPTY_DRAFT);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const setField = (name: FieldName, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    setSaved(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");
    setSaved(false);

    const localErrors: Partial<Record<FieldName, string>> = {};
    for (const field of FIELDS) {
      if (values[field.name].trim().length > PROJECT_FIELD_LIMITS[field.name]) {
        localErrors[field.name] = t("myProjects.errors.FIELD_TOO_LONG");
      }
    }
    setFieldErrors(localErrors);
    if (Object.keys(localErrors).length > 0) return;

    setPending(true);
    const result = await onSubmit(values);
    setPending(false);
    if (result.ok === false) {
      const message = t(`myProjects.errors.${result.code}`);
      const readable = message.startsWith("myProjects.errors.")
        ? t("myProjects.errors.SERVER_ERROR")
        : message;
      if (result.fields) {
        const next: Partial<Record<FieldName, string>> = {};
        for (const field of result.fields) {
          if (field in PROJECT_FIELD_LIMITS) {
            next[field as FieldName] = readable;
          }
        }
        setFieldErrors(next);
      }
      setFormError(readable);
      return;
    }
    setSaved(true);
  };

  return (
    <form
      className="mt-8 max-w-3xl space-y-5"
      onSubmit={handleSubmit}
      data-testid="project-draft-form"
      noValidate
    >
      <h1 className="font-display text-3xl text-foreground lg:text-4xl">{heading}</h1>
      <p className="text-sm text-muted-foreground">{t("myProjects.draftHint")}</p>

      {FIELDS.map((field) => {
        const error = fieldErrors[field.name];
        const errorId = `project-${field.name}-error`;
        const inputId = `project-${field.name}`;
        const shared = {
          id: inputId,
          name: field.name,
          value: values[field.name],
          maxLength: PROJECT_FIELD_LIMITS[field.name],
          "aria-invalid": Boolean(error),
          "aria-describedby": error ? errorId : undefined,
          onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setField(field.name, event.target.value),
          className: `w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground ${focusRing}`,
        };
        return (
          <div key={field.name}>
            <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-foreground">
              {t(`myProjects.fields.${field.name}`)}
            </label>
            {field.multiline ? (
              <textarea
                {...shared}
                rows={field.name === "description" ? 6 : 4}
                data-testid={`project-field-${field.name}`}
              />
            ) : (
              <input
                {...shared}
                type="text"
                data-testid={`project-field-${field.name}`}
              />
            )}
            {error ? (
              <p id={errorId} role="alert" className="mt-1 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}

      {formError ? (
        <p role="alert" data-testid="project-form-error" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      {saved ? (
        <p role="status" data-testid="project-save-status" className="text-sm text-foreground">
          {t("myProjects.saved")}
        </p>
      ) : null}

      <button
        type="submit"
        data-testid="project-save"
        disabled={pending}
        className={`inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70 ${focusRing}`}
      >
        {pending ? t("myProjects.saving") : t("myProjects.saveDraft")}
      </button>
    </form>
  );
}
