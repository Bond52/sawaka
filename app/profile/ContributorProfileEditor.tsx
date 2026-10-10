"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  removeOwnContributorPhoto,
  updateOwnContributor,
  uploadOwnContributorPhoto,
  type ContributorProfileDetail,
} from "@/app/lib/apiContributors";
import {
  fieldElementId,
  firstInvalidField,
  validateContributorForm,
  type ContributorFieldErrors,
} from "@/app/lib/contributorValidation";
import {
  ContributorProfileFields,
  useContributorProfileFields,
} from "@/app/contributor/ContributorProfileFields";
import ContributorAvatar from "./ContributorAvatar";

/** Same 2 MB ceiling as the API. No shared project-wide image limit exists. */
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type Props = {
  profile: ContributorProfileDetail;
  onSaved: (profile: ContributorProfileDetail) => void;
  onDraftPersisted: (profile: ContributorProfileDetail) => void;
  onCancel: () => void;
};

function clientPhotoIssue(file: File): string | null {
  const type = file.type === "image/jpg" ? "image/jpeg" : file.type;
  if (!PHOTO_TYPES.has(type)) return "UNSUPPORTED_IMAGE_TYPE";
  if (file.size > PHOTO_MAX_BYTES) return "IMAGE_TOO_LARGE";
  return null;
}

export default function ContributorProfileEditor({
  profile,
  onSaved,
  onDraftPersisted,
  onCancel,
}: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [fieldErrors, setFieldErrors] = useState<ContributorFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const profileFields = useContributorProfileFields(fieldErrors, setFieldErrors);

  useEffect(() => {
    profileFields.seedFromProfile(profile);
    // Seed once when Edit Mode opens. Cancel remounts this form from persisted data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function focusField(field: string) {
    const id = fieldElementId(field);
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.focus();
    });
  }

  function photoErrorMessage(code: string): string {
    if (code === "IMAGE_TOO_LARGE") return t("contributorProfile.edit.photo.tooLarge");
    if (code === "UNSUPPORTED_IMAGE_TYPE" || code === "INVALID_IMAGE" || code === "PHOTO_REQUIRED") {
      return t("contributorProfile.edit.photo.unsupported");
    }
    if (code === "NETWORK") return t("contributorProfile.edit.networkError");
    return t("contributorProfile.edit.photo.uploadFailed");
  }

  function onPhotoSelected(file: File | null) {
    if (!file) return;
    const issue = clientPhotoIssue(file);
    if (issue) {
      setPhotoError(issue);
      return;
    }
    setPhotoError("");
    setRemovePhoto(false);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function onRemovePhoto() {
    setSelectedFile(null);
    setPreviewUrl(null);
    setRemovePhoto(true);
    setPhotoError("");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setFormError("");
    const current = profileFields.snapshot();
    const errors = validateContributorForm(
      {
        username: "",
        email: "",
        confirmEmail: "",
        password: "",
        ...current,
      },
      { includeAccount: false }
    );
    setFieldErrors(errors);
    const first = firstInvalidField(errors);
    if (first) {
      focusField(first);
      return;
    }
    if (selectedFile) {
      const issue = clientPhotoIssue(selectedFile);
      if (issue) {
        setPhotoError(issue);
        return;
      }
    }

    setSubmitting(true);
    const result = await updateOwnContributor({
      displayName: current.displayName.trim(),
      domainId: current.domainId,
      skillIds: current.skillIds,
      customSkills: current.customSkills.map((label) => label.trim()),
      country: current.country.trim(),
      region: current.region.trim(),
      city: current.city.trim(),
      biography: current.biography.trim(),
    });

    if (result.ok !== true) {
      setSubmitting(false);
      if (result.status === 401) {
        router.replace("/login?redirect=/profile");
        return;
      }
      if (result.fields) {
        setFieldErrors(result.fields);
        const serverFirst = firstInvalidField(result.fields);
        if (serverFirst) focusField(serverFirst);
        else setFormError("server");
      } else {
        setFormError(result.code === "NETWORK" ? "network" : "server");
      }
      return;
    }

    let next = result.profile;
    const shouldUpload = Boolean(selectedFile);
    const shouldRemove = removePhoto && !selectedFile && Boolean(profile.photoUrl);
    if (shouldUpload || shouldRemove) {
      const photoResult = shouldUpload
        ? await uploadOwnContributorPhoto(selectedFile as File)
        : await removeOwnContributorPhoto();
      if (photoResult.ok !== true) {
        setSubmitting(false);
        onDraftPersisted(next);
        if (photoResult.status === 401) {
          router.replace("/login?redirect=/profile");
          return;
        }
        const fieldCode = photoResult.fields?.photo;
        setPhotoError(fieldCode || photoResult.code || "UPLOAD_FAILED");
        return;
      }
      next = photoResult.profile;
    }

    setSubmitting(false);
    onSaved(next);
  }

  const displayName = profileFields.fieldProps.displayName || profile.displayName;
  const shownPhoto = previewUrl || (removePhoto ? null : profile.photoUrl);
  const canRemove = Boolean(shownPhoto);
  const photoLabel = shownPhoto
    ? t("contributorProfile.edit.photo.replace")
    : t("contributorProfile.edit.photo.choose");

  return (
    <form
      className="mb-10 space-y-6"
      onSubmit={onSubmit}
      noValidate
      data-testid="contributor-profile-edit-form"
    >
      <h2 className="text-xl font-semibold text-foreground">
        {t("contributorProfile.edit.action")}
      </h2>
      {formError ? (
        <p role="alert" className="text-sm text-destructive" data-testid="contributor-profile-edit-error">
          {t(
            formError === "network"
              ? "contributorProfile.edit.networkError"
              : "contributorProfile.edit.serverError"
          )}
        </p>
      ) : null}

      <section
        className="space-y-3"
        aria-labelledby="contributor-photo-heading"
        data-testid="contributor-profile-photo-section"
      >
        <h3 id="contributor-photo-heading" className="text-sm font-semibold text-foreground">
          {t("contributorProfile.edit.photo.title")}
        </h3>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <ContributorAvatar
            name={displayName}
            photoUrl={shownPhoto}
            alt={t("contributorProfile.photoAlt", { name: displayName })}
            imageTestId="contributor-profile-photo-preview"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <label
              htmlFor="contributor-profile-photo-input"
              className="btn btn-secondary inline-flex cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary"
            >
              {photoLabel}
            </label>
            <input
              id="contributor-profile-photo-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              data-testid="contributor-profile-photo-input"
              aria-invalid={Boolean(photoError)}
              aria-describedby={photoError ? "contributor-photo-error" : undefined}
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                event.target.value = "";
                onPhotoSelected(file);
              }}
            />
            {canRemove ? (
              <button
                type="button"
                className="btn btn-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                onClick={onRemovePhoto}
                data-testid="contributor-profile-photo-remove"
              >
                {t("contributorProfile.edit.photo.remove")}
              </button>
            ) : null}
          </div>
        </div>
        {photoError ? (
          <p
            id="contributor-photo-error"
            role="alert"
            className="text-sm text-destructive"
            data-testid="contributor-profile-photo-error"
          >
            {photoErrorMessage(photoError)}
          </p>
        ) : null}
      </section>

      <ContributorProfileFields {...profileFields.fieldProps} showIntro={false} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
          data-testid="contributor-profile-save"
        >
          {submitting
            ? t("contributorProfile.edit.saving")
            : t("contributorProfile.edit.save")}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onCancel}
          disabled={submitting}
          data-testid="contributor-profile-cancel"
        >
          {t("contributorProfile.edit.cancel")}
        </button>
      </div>
    </form>
  );
}
