"use client";

import { useState } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  addOwnedProjectImage,
  removeOwnedProjectImage,
  removeProjectCover,
  removeStageImage,
  uploadProjectCover,
  uploadStageImage,
  type OwnedProject,
  type ProjectImage,
} from "@/app/lib/projects";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const ACCEPT = "image/jpeg,image/png,image/webp";

function messageFor(t: (key: string) => string, code: string): string {
  const message = t(`myProjects.errors.${code}`);
  return message.startsWith("myProjects.errors.") ? t("myProjects.errors.SERVER_ERROR") : message;
}

function ImageList({
  images,
  pending,
  onRemove,
  removeLabel,
}: {
  images: ProjectImage[];
  pending: boolean;
  onRemove: (imageId: string) => void;
  removeLabel: string;
}) {
  if (images.length === 0) return null;
  return (
    <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {images.map((image) => (
        <li key={image.id} className="space-y-2" data-testid={`project-image-${image.id}`}>
          <img src={image.url} alt="" className="h-28 w-full rounded-lg object-cover" />
          <button
            type="button"
            disabled={pending}
            data-testid={`project-image-remove-${image.id}`}
            className={`inline-flex min-h-[44px] items-center text-sm font-medium text-primary ${focusRing}`}
            onClick={() => onRemove(image.id)}
          >
            {removeLabel}
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function ProjectMedia({
  project,
  onChange,
}: {
  project: OwnedProject;
  onChange: (project: OwnedProject) => void;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const apply = (result: Awaited<ReturnType<typeof uploadProjectCover>>) => {
    if (result.ok === false) {
      setError(messageFor(t, result.code));
      return;
    }
    setError("");
    onChange(result.project);
  };

  const upload = async (file: File | undefined, action: (file: File) => Promise<Awaited<ReturnType<typeof uploadProjectCover>>>) => {
    if (!file) return;
    setPending(true);
    const result = await action(file);
    setPending(false);
    apply(result);
  };

  return (
    <section className="mt-10 max-w-3xl" aria-labelledby="project-media-heading" data-testid="project-media">
      <h2 id="project-media-heading" className="font-display text-2xl text-foreground">
        {t("myProjects.media.title")}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("myProjects.media.hint")}</p>
      <div className="mt-4">
        <label htmlFor="project-cover" className="mb-1 block text-sm font-medium">
          {t("myProjects.media.cover")}
        </label>
        {project.coverImage ? (
          <img
            src={project.coverImage.url}
            alt={t("myProjects.media.coverAlt")}
            data-testid="project-cover-preview"
            className="mb-3 h-40 w-full max-w-md rounded-xl object-cover"
          />
        ) : null}
        <input
          id="project-cover"
          data-testid="project-cover-input"
          type="file"
          accept={ACCEPT}
          disabled={pending}
          className={`block w-full text-sm ${focusRing}`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void upload(file, (chosen) => uploadProjectCover(project.id, chosen));
          }}
        />
        {project.coverImage ? (
          <button
            type="button"
            data-testid="project-cover-remove"
            disabled={pending}
            className={`mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-primary ${focusRing}`}
            onClick={() => {
              setPending(true);
              void removeProjectCover(project.id).then((result) => {
                setPending(false);
                apply(result);
              });
            }}
          >
            {t("myProjects.media.removeCover")}
          </button>
        ) : null}
      </div>
      <div className="mt-6">
        <label htmlFor="project-image" className="mb-1 block text-sm font-medium">
          {t("myProjects.media.projectImages")}
        </label>
        <input
          id="project-image"
          data-testid="project-image-input"
          type="file"
          accept={ACCEPT}
          disabled={pending}
          className={`block w-full text-sm ${focusRing}`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void upload(file, (chosen) => addOwnedProjectImage(project.id, chosen));
          }}
        />
        <ImageList
          images={project.images}
          pending={pending}
          removeLabel={t("myProjects.media.removeImage")}
          onRemove={(imageId) => {
            setPending(true);
            void removeOwnedProjectImage(project.id, imageId).then((result) => {
              setPending(false);
              apply(result);
            });
          }}
        />
      </div>
      {error ? (
        <p role="alert" data-testid="project-media-error" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function StageImages({
  projectId,
  stageId,
  images,
  onChange,
}: {
  projectId: string;
  stageId: string;
  images: ProjectImage[];
  onChange: (project: OwnedProject) => void;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const apply = (result: Awaited<ReturnType<typeof uploadStageImage>>) => {
    if (result.ok === false) {
      setError(messageFor(t, result.code));
      return;
    }
    setError("");
    onChange(result.project);
  };

  return (
    <div className="mt-4" data-testid={`stage-images-${stageId}`}>
      <label htmlFor={`stage-image-${stageId}`} className="mb-1 block text-sm font-medium">
        {t("myProjects.media.stageImages")}
      </label>
      <input
        id={`stage-image-${stageId}`}
        data-testid={`stage-image-${stageId}`}
        type="file"
        accept={ACCEPT}
        disabled={pending}
        className={`block w-full text-sm ${focusRing}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setPending(true);
          void uploadStageImage(projectId, stageId, file).then((result) => {
            setPending(false);
            apply(result);
          });
        }}
      />
      <ImageList
        images={images}
        pending={pending}
        removeLabel={t("myProjects.media.removeImage")}
        onRemove={(imageId) => {
          setPending(true);
          void removeStageImage(projectId, stageId, imageId).then((result) => {
            setPending(false);
            apply(result);
          });
        }}
      />
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
