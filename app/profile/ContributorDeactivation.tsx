"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  deactivateOwnProfile,
  type ContributorProfileDetail,
} from "@/app/lib/apiContributors";

const ACTIVE_STATUS = "Active";
const INACTIVE_STATUS = "Inactive";

type Props = {
  profile: ContributorProfileDetail;
  editing: boolean;
  onDeactivated: (profile: ContributorProfileDetail) => void;
  onAlreadyInactive: () => void;
};

export default function ContributorDeactivation({
  profile,
  editing,
  onDeactivated,
  onAlreadyInactive,
}: Props) {
  const { t } = useTranslation();
  const inactive = profile.status === INACTIVE_STATUS;
  const canDeactivate =
    profile.status === ACTIVE_STATUS && profile.isVisible === true;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const lockRef = useRef(false);

  function closeDialog() {
    if (lockRef.current) return;
    setOpen(false);
    setError("");
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (lockRef.current) return;
        event.preventDefault();
        setOpen(false);
        setError("");
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled])"
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function confirmDeactivation() {
    if (lockRef.current) return;
    lockRef.current = true;
    setSubmitting(true);
    setError("");
    const result = await deactivateOwnProfile();
    if (result.ok !== true) {
      lockRef.current = false;
      setSubmitting(false);
      if (result.code === "PROFILE_ALREADY_INACTIVE") {
        setOpen(false);
        setError("");
        onAlreadyInactive();
        return;
      }
      setError(
        result.status === 0
          ? t("contributorProfile.deactivate.networkError")
          : t("contributorProfile.deactivate.error")
      );
      return;
    }
    onDeactivated(result.profile);
  }

  if (inactive) {
    return (
      <p
        role="status"
        className="alert alert-warning mt-10"
        data-testid="contributor-profile-inactive"
      >
        {t("contributorProfile.deactivate.inactive")}
      </p>
    );
  }

  if (!canDeactivate || editing) return null;

  return (
    <>
      <section
        className="alert alert-error mt-10 !p-6"
        data-testid="contributor-profile-deactivate-zone"
        aria-labelledby="contributor-deactivate-title"
      >
        <h2
          id="contributor-deactivate-title"
          className="font-display text-lg font-semibold text-destructive"
        >
          {t("contributorProfile.deactivate.zoneTitle")}
        </h2>
        <p className="mt-2 text-sm text-destructive/90">
          {t("contributorProfile.deactivate.zoneBody")}
        </p>
        <button
          ref={triggerRef}
          type="button"
          data-testid="contributor-profile-deactivate-open"
          onClick={() => {
            setError("");
            setOpen(true);
          }}
          className="btn btn-outline mt-4 border-destructive text-destructive hover:bg-red-50 focus-visible:ring-destructive"
        >
          {t("contributorProfile.deactivate.action")}
        </button>
      </section>

      {open ? (
        <div
          className="dialog-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="contributor-deactivate-dialog-title"
            aria-describedby="contributor-deactivate-dialog-body"
            data-testid="contributor-profile-deactivate-dialog"
            className="dialog-panel max-h-[85vh] overflow-y-auto"
          >
            <h2
              id="contributor-deactivate-dialog-title"
              className="dialog-title"
            >
              {t("contributorProfile.deactivate.title")}
            </h2>
            <ul
              id="contributor-deactivate-dialog-body"
              className="dialog-description list-disc space-y-2 pl-5"
            >
              <li>{t("contributorProfile.deactivate.impactVisibility")}</li>
              <li>{t("contributorProfile.deactivate.impactDiscovery")}</li>
              <li>{t("contributorProfile.deactivate.impactAccount")}</li>
              <li>{t("contributorProfile.deactivate.impactHistory")}</li>
            </ul>
            {error ? (
              <p
                role="alert"
                className="field-error mt-3"
                data-testid="contributor-profile-deactivate-error"
              >
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                ref={cancelRef}
                type="button"
                data-testid="contributor-profile-deactivate-cancel"
                disabled={submitting}
                onClick={closeDialog}
                className="btn btn-outline"
              >
                {t("contributorProfile.deactivate.cancel")}
              </button>
              <button
                type="button"
                data-testid="contributor-profile-deactivate-confirm"
                disabled={submitting}
                onClick={confirmDeactivation}
                className="btn btn-destructive"
              >
                {submitting
                  ? t("contributorProfile.deactivate.submitting")
                  : t("contributorProfile.deactivate.confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
