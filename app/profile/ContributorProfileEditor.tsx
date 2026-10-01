"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  updateOwnContributor,
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

type Props = {
  profile: ContributorProfileDetail;
  onSaved: (profile: ContributorProfileDetail) => void;
  onCancel: () => void;
};

export default function ContributorProfileEditor({
  profile,
  onSaved,
  onCancel,
}: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [fieldErrors, setFieldErrors] = useState<ContributorFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const profileFields = useContributorProfileFields(fieldErrors, setFieldErrors);

  useEffect(() => {
    profileFields.seedFromProfile(profile);
    // Seed once when Edit Mode opens. Cancel remounts this form from persisted data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function focusField(field: string) {
    const id = fieldElementId(field);
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.focus();
    });
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
    setSubmitting(false);

    if (result.ok === true) {
      onSaved(result.profile);
    } else if (result.status === 401) {
      router.replace("/login?redirect=/profile");
    } else if (result.fields) {
      setFieldErrors(result.fields);
      const serverFirst = firstInvalidField(result.fields);
      if (serverFirst) focusField(serverFirst);
      else setFormError("server");
    } else {
      setFormError(result.code === "NETWORK" ? "network" : "server");
    }
  }

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
