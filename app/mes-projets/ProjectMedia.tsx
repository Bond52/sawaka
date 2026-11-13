"use client";

import { useEffect, useState } from "react";
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
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_GALLERY = 8;

function localImageIssue(file: File): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "UNSUPPORTED_IMAGE_TYPE";
  if (file.size > MAX_BYTES) return "IMAGE_TOO_LARGE";
  return null;
}

const dropClass =
  "relative mt-3 flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/40 bg-card px-4 py-8 text-center";

const overlayInput = "absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0";

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
    <section
      className="rounded-2xl border border-border bg-secondary p-5 sm:p-8"
      aria-labelledby="project-media-heading"
      data-testid="project-media"
    >
      <div className="flex gap-4 border-b border-border pb-5">
        <span className="pt-1 text-sm font-semibold text-primary">03</span>
        <div>
          <h2 id="project-media-heading" className="font-display text-2xl text-foreground">
            {t("myProjects.sections.imagesTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("myProjects.sections.imagesText")}</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="project-cover" className="text-sm font-medium">
              {t("myProjects.media.cover")}
            </label>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("myProjects.media.recommended")}</span>
          </div>
          <label htmlFor="project-cover" className={dropClass}>
            {project.coverImage ? (
              <img
                src={project.coverImage.url}
                alt={t("myProjects.media.coverAlt")}
                data-testid="project-cover-preview"
                className="mb-3 h-32 w-full rounded-xl object-cover"
              />
            ) : (
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg text-primary" aria-hidden="true">
                ↑
              </span>
            )}
            <span className="text-sm font-medium text-primary">
              {project.coverImage ? t("myProjects.media.replace") : t("myProjects.media.dropCover")}
            </span>
            <span className="mt-1 text-sm text-foreground">{t("myProjects.media.dropBrowse")}</span>
            <span className="mt-2 text-xs text-muted-foreground">{t("myProjects.media.formats")}</span>
            <input
              id="project-cover"
              data-testid="project-cover-input"
              type="file"
              accept={ACCEPT}
              disabled={pending}
              className={overlayInput}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void upload(file, (chosen) => uploadProjectCover(project.id, chosen));
              }}
            />
          </label>
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
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="project-image" className="text-sm font-medium">
              {t("myProjects.media.gallery")}
            </label>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("myProjects.media.optional")}</span>
          </div>
          <label htmlFor="project-image" className={dropClass}>
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg text-primary" aria-hidden="true">
              +
            </span>
            <span className="text-sm font-medium text-foreground">{t("myProjects.media.dropGallery")}</span>
            <span className="mt-2 text-xs text-muted-foreground">{t("myProjects.media.formats")}</span>
            <input
              id="project-image"
              data-testid="project-image-input"
              type="file"
              accept={ACCEPT}
              disabled={pending}
              className={overlayInput}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void upload(file, (chosen) => addOwnedProjectImage(project.id, chosen));
              }}
            />
          </label>
          {project.images.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t("myProjects.media.optional")}</p>
          ) : null}
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
      </div>
      {pending ? (
        <p role="status" className="mt-3 text-sm text-muted-foreground">{t("myProjects.media.uploading")}</p>
      ) : null}
      {error ? (
        <p role="alert" data-testid="project-media-error" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function PendingProjectMedia({
  cover,
  gallery,
  onCover,
  onGallery,
}: {
  cover: File | null;
  gallery: File[];
  onCover: (file: File | null) => void;
  onGallery: (files: File[]) => void;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  useEffect(() => {
    if (!cover) {
      setCoverUrl("");
      return;
    }
    const url = URL.createObjectURL(cover);
    setCoverUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  const accept = (file: File | undefined) => {
    if (!file) return null;
    const issue = localImageIssue(file);
    if (issue) {
      setError(messageFor(t, issue));
      return null;
    }
    setError("");
    return file;
  };

  return (
    <section
      className="rounded-2xl border border-border bg-secondary p-5 sm:p-8"
      aria-labelledby="project-media-heading"
      data-testid="project-media"
    >
      <div className="flex gap-4 border-b border-border pb-5">
        <span className="pt-1 text-sm font-semibold text-primary">03</span>
        <div>
          <h2 id="project-media-heading" className="font-display text-2xl text-foreground">
            {t("myProjects.sections.imagesTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("myProjects.sections.imagesText")}</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="project-cover" className="text-sm font-medium">{t("myProjects.media.cover")}</label>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("myProjects.media.recommended")}</span>
          </div>
          <label htmlFor="project-cover" className={dropClass}>
            {coverUrl ? (
              <img src={coverUrl} alt={t("myProjects.media.coverAlt")} data-testid="project-cover-preview" className="mb-3 h-32 w-full rounded-xl object-cover" />
            ) : (
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg text-primary" aria-hidden="true">↑</span>
            )}
            <span className="text-sm font-medium text-primary">{cover ? t("myProjects.media.replace") : t("myProjects.media.dropCover")}</span>
            <span className="mt-1 text-sm text-foreground">{t("myProjects.media.dropBrowse")}</span>
            <span className="mt-2 text-xs text-muted-foreground">{t("myProjects.media.formats")}</span>
            <input
              id="project-cover"
              data-testid="project-cover-input"
              type="file"
              accept={ACCEPT}
              className={overlayInput}
              onChange={(event) => {
                const file = accept(event.target.files?.[0]);
                event.target.value = "";
                if (file) onCover(file);
              }}
            />
          </label>
          {cover ? (
            <button type="button" data-testid="project-cover-remove" className={`mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-primary ${focusRing}`} onClick={() => onCover(null)}>
              {t("myProjects.media.removeCover")}
            </button>
          ) : null}
        </div>
        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="project-image" className="text-sm font-medium">{t("myProjects.media.gallery")}</label>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("myProjects.media.optional")}</span>
          </div>
          <label htmlFor="project-image" className={dropClass}>
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg text-primary" aria-hidden="true">+</span>
            <span className="text-sm font-medium text-foreground">{t("myProjects.media.dropGallery")}</span>
            <span className="mt-2 text-xs text-muted-foreground">{t("myProjects.media.formats")}</span>
            <input
              id="project-image"
              data-testid="project-image-input"
              type="file"
              accept={ACCEPT}
              className={overlayInput}
              onChange={(event) => {
                const file = accept(event.target.files?.[0]);
                event.target.value = "";
                if (!file) return;
                if (gallery.length >= MAX_GALLERY) {
                  setError(messageFor(t, "IMAGE_LIMIT"));
                  return;
                }
                onGallery([...gallery, file]);
              }}
            />
          </label>
          {gallery.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t("myProjects.media.optional")}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {gallery.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    className={`inline-flex min-h-[44px] items-center text-primary ${focusRing}`}
                    onClick={() => onGallery(gallery.filter((_, item) => item !== index))}
                  >
                    {t("myProjects.media.removeImage")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {error ? (
        <p role="alert" data-testid="project-media-error" className="mt-3 text-sm text-destructive">{error}</p>
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
        className={`mt-2 block w-full rounded-xl border border-dashed border-primary/40 bg-card px-3 py-4 text-sm ${focusRing}`}
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
