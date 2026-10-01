"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { readStoredUser, type StoredUser } from "@/app/lib/authUser";
import {
  createContributorProfile,
  getOwnContributor,
  resendContributorVerification,
  type ContributorProfilePayload,
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
} from "../ContributorProfileFields";

const PENDING_STATUS = "Pending Email Verification";

type Screen =
  | "loading"
  | "loadError"
  | "session"
  | "form"
  | "pending"
  | "active";

function suggestedDisplayName(user: StoredUser): string {
  const combined = [user.firstName, user.lastName]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  if (combined.length >= 2) return combined.slice(0, 80);
  return (user.username || "").trim().slice(0, 80);
}

function storeCreatedSession(input: {
  token: string;
  roles?: string[];
  username?: string;
}) {
  localStorage.setItem(
    "user",
    JSON.stringify({
      token: input.token,
      roles: input.roles ?? ["acheteur"],
      username: input.username ?? "",
    })
  );
  window.dispatchEvent(new Event("sawaka-auth-changed"));
}

export default function ContributorCreateExperience() {
  const { t } = useTranslation();
  const [screen, setScreen] = useState<Screen>("loading");
  const [sessionUser, setSessionUser] = useState<StoredUser | null>(null);
  const [owned, setOwned] = useState<ContributorProfilePayload | null>(null);
  const [createdNow, setCreatedNow] = useState(false);
  const [emailFailed, setEmailFailed] = useState(false);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ContributorFieldErrors>({});
  const profileFields = useContributorProfileFields(fieldErrors, setFieldErrors);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendTone, setResendTone] = useState<"status" | "error">("status");

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const user = readStoredUser();
      if (cancelled) return;
      setSessionUser(user);
      if (!user) {
        setScreen("form");
        return;
      }
      const own = await getOwnContributor();
      if (cancelled) return;
      if (!("status" in own)) {
        setOwned(own.profile);
        setCreatedNow(false);
        setScreen(own.profile.status === PENDING_STATUS ? "pending" : "active");
        return;
      }
      if (own.status === 401) {
        setScreen("session");
        return;
      }
      if (own.status === 404 || own.code === "CONTRIBUTOR_PROFILE_NOT_FOUND") {
        profileFields.setDisplayName(suggestedDisplayName(user));
        setScreen("form");
        return;
      }
      setScreen("loadError");
    }

    boot();
    return () => {
      cancelled = true;
    };
    // profileFields.setDisplayName is a stable state setter used only for the initial suggestion.
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
    const includeAccount = !sessionUser;
    const profile = profileFields.snapshot();
    const errors = validateContributorForm(
      {
        username,
        email,
        confirmEmail,
        password,
        ...profile,
      },
      { includeAccount }
    );
    setFieldErrors(errors);
    const first = firstInvalidField(errors);
    if (first) {
      focusField(first);
      return;
    }

    setSubmitting(true);
    const result = await createContributorProfile({
      ...(includeAccount
        ? {
            account: {
              username: username.trim(),
              email: email.trim(),
              password,
            },
          }
        : {}),
      displayName: profile.displayName.trim(),
      domainId: profile.domainId,
      skillIds: profile.skillIds,
      customSkills: profile.customSkills.map((label) => label.trim()),
      country: profile.country.trim(),
      region: profile.region.trim(),
      city: profile.city.trim(),
      biography: profile.biography.trim(),
    });
    setSubmitting(false);
    setPassword("");

    if ("code" in result) {
      if (result.code === "ACCOUNT_ALREADY_EXISTS") {
        setFormError("accountExists");
        focusField("form");
        return;
      }
      if (result.code === "CONTRIBUTOR_PROFILE_EXISTS") {
        setCreatedNow(false);
        setScreen("active");
        setOwned({
          id: "",
          displayName: profileFields.snapshot().displayName.trim(),
          status: "Active",
        });
        setFormError("exists");
        return;
      }
      if (result.fields) {
        setFieldErrors(result.fields);
        const serverFirst = firstInvalidField(result.fields);
        if (serverFirst) focusField(serverFirst);
        else {
          setFormError("server");
          focusField("form");
        }
        return;
      }
      setFormError(result.code === "NETWORK" ? "network" : "server");
      focusField("form");
      return;
    }

    if (result.accountCreated && result.token) {
      storeCreatedSession({
        token: result.token,
        roles: result.roles,
        username: result.username,
      });
      setSessionUser(readStoredUser());
    }

    setOwned(result.profile);
    setCreatedNow(true);
    setEmailFailed(result.verificationRequired && !result.verificationEmailSent);
    setResendMessage("");
    setScreen(result.verificationRequired ? "pending" : "active");
  }

  async function onResend() {
    if (resending) return;
    setResending(true);
    setResendMessage("");
    const result = await resendContributorVerification();
    setResending(false);
    if ("code" in result) {
      setResendTone("error");
      setResendMessage(result.code === "RATE_LIMIT" ? "rate" : "error");
      return;
    }
    if (result.emailVerified && result.status !== PENDING_STATUS) {
      const own = await getOwnContributor();
      if (!("status" in own) && own.profile.status !== PENDING_STATUS) {
        setOwned(own.profile);
        setCreatedNow(false);
        setScreen("active");
        return;
      }
    }
    setResendTone("status");
    setResendMessage("sent");
    setScreen("pending");
  }

  const labelClass = "field-label";
  const inputClass = "field";

  function fieldError(field: string) {
    const code = fieldErrors[field];
    if (!code) return null;
    const key = `contributor.create.errors.${code}`;
    const message = t(key);
    return (
      <p id={`err-${field}`} className="text-sm text-destructive" role="alert">
        {message === key ? t("contributor.create.errors.generic") : message}
      </p>
    );
  }

  if (screen === "loading") {
    return (
      <main className="min-h-[70vh] bg-background py-10">
        <p className="wrap text-sm text-muted-foreground" role="status">
          {t("contributor.create.loading")}
        </p>
      </main>
    );
  }

  if (screen === "loadError") {
    return (
      <main className="min-h-[70vh] bg-background py-10 md:py-14">
        <div className="wrap max-w-3xl">
          <p className="text-sm text-destructive" role="alert">
            {t("contributor.create.networkError")}
          </p>
        </div>
      </main>
    );
  }

  if (screen === "session") {
    return (
      <main className="min-h-[70vh] bg-background py-10 md:py-14">
        <div className="wrap max-w-3xl space-y-4">
          <h1 className="font-display text-2xl text-foreground md:text-3xl">
            {t("contributor.create.title")}
          </h1>
          <p role="alert" className="text-sm text-foreground">
            {t("contributor.create.sessionExpired")}
          </p>
          <Link href="/login" className="btn btn-primary">
            {t("contributor.create.signIn")}
          </Link>
        </div>
      </main>
    );
  }

  if (screen === "pending" || screen === "active") {
    const pending = screen === "pending";
    const title = pending
      ? createdNow
        ? t("contributor.create.pendingTitle")
        : t("contributor.create.existsTitle")
      : createdNow && !formError
        ? t("contributor.create.activeTitle")
        : t("contributor.create.existsTitle");
    const body = pending
      ? createdNow
        ? t("contributor.create.pendingBody")
        : t("contributor.create.existsPending")
      : createdNow && formError !== "exists"
        ? t("contributor.create.activeBody")
        : formError === "exists"
          ? t("contributor.create.duplicateProfile")
          : t("contributor.create.existsActive");

    return (
      <main className="min-h-[70vh] bg-background py-10 md:py-14">
        <div className="wrap max-w-3xl">
          <div
            className="card p-6 sm:p-8"
            role="status"
            data-testid={
              pending
                ? "contributor-pending-verification"
                : formError === "exists"
                  ? "contributor-profile-exists"
                  : "contributor-active-confirmation"
            }
          >
            <h1 className="font-display text-2xl text-foreground">{title}</h1>
            <p className="mt-3 text-sm text-muted-foreground">{body}</p>
            {owned?.displayName && (
              <p className="mt-4 text-sm text-foreground">
                <span className="font-medium">
                  {t("contributor.create.displayName")}:{" "}
                </span>
                {owned.displayName}
              </p>
            )}
            {pending && emailFailed && (
              <p className="mt-4 text-sm text-foreground" role="alert">
                {t("contributor.create.pendingEmailFailed")}
              </p>
            )}
            {pending && (
              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onResend}
                  disabled={resending}
                  data-testid="contributor-resend"
                >
                  {resending
                    ? t("contributor.create.resending")
                    : t("contributor.create.resend")}
                </button>
                {resendMessage && (
                  <p
                    role={resendTone === "error" ? "alert" : "status"}
                    className={
                      resendTone === "error"
                        ? "text-sm text-destructive"
                        : "text-sm text-foreground"
                    }
                    data-testid="contributor-resend-message"
                  >
                    {t(
                      resendMessage === "sent"
                        ? "contributor.create.resendSuccess"
                        : resendMessage === "rate"
                          ? "contributor.create.resendRateLimit"
                          : "contributor.create.resendError"
                    )}
                  </p>
                )}
              </div>
            )}
            <Link
              href="/dashboard"
              className="btn btn-secondary mt-6"
              data-testid="contributor-go-dashboard"
            >
              {t("contributor.create.goToDashboard")}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[70vh] bg-background py-10 md:py-14">
      <div className="wrap max-w-3xl">
        <h1
          className="mb-2 font-display text-2xl text-foreground md:text-3xl"
          data-testid="contributor-create-title"
        >
          {t("contributor.create.title")}
        </h1>
        <p className="mb-8 text-sm text-muted-foreground md:text-base">
          {t("contributor.create.subtitle")}
        </p>

        <form
          className="card space-y-8 p-6 sm:p-8"
          onSubmit={onSubmit}
          noValidate
          data-testid="contributor-create-form"
        >
          {formError && (
            <p
              id="contributor-form-error"
              tabIndex={-1}
              role="alert"
              className="text-sm text-destructive"
              data-testid="contributor-form-error"
            >
              {formError === "accountExists" ? (
                <>
                  {t("contributor.create.accountExists")}{" "}
                  <Link href="/login" className="underline">
                    {t("contributor.create.signIn")}
                  </Link>
                </>
              ) : (
                t(
                  formError === "network"
                    ? "contributor.create.networkError"
                    : "contributor.create.serverError"
                )
              )}
            </p>
          )}

          {!sessionUser && (
            <fieldset className="space-y-4">
              <legend className="font-display text-lg font-semibold text-foreground">
                {t("contributor.create.accountSection")}
              </legend>
              <p className="text-sm text-muted-foreground">
                {t("contributor.create.accountHint")}
              </p>
              <div className="space-y-2">
                <label htmlFor="contributor-username" className={labelClass}>
                  {t("contributor.create.username")}
                </label>
                <input
                  id="contributor-username"
                  className={inputClass}
                  autoComplete="username"
                  value={username}
                  aria-invalid={Boolean(fieldErrors.username)}
                  aria-describedby={
                    fieldErrors.username ? "err-username" : undefined
                  }
                  onChange={(event) => setUsername(event.target.value)}
                />
                {fieldError("username")}
              </div>
              <div className="space-y-2">
                <label htmlFor="contributor-email" className={labelClass}>
                  {t("contributor.create.email")}
                </label>
                <input
                  id="contributor-email"
                  type="email"
                  className={inputClass}
                  autoComplete="email"
                  value={email}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={
                    fieldErrors.email
                      ? "err-email contributor-email-hint"
                      : "contributor-email-hint"
                  }
                  onChange={(event) => setEmail(event.target.value)}
                />
                <p
                  id="contributor-email-hint"
                  className="text-sm text-muted-foreground"
                >
                  {t("contributor.create.emailHint")}
                </p>
                {fieldError("email")}
              </div>
              <div className="space-y-2">
                <label htmlFor="contributor-confirm-email" className={labelClass}>
                  {t("contributor.create.confirmEmail")}
                </label>
                <input
                  id="contributor-confirm-email"
                  type="email"
                  className={inputClass}
                  autoComplete="email"
                  value={confirmEmail}
                  aria-invalid={Boolean(fieldErrors.confirmEmail)}
                  aria-describedby={
                    fieldErrors.confirmEmail ? "err-confirmEmail" : undefined
                  }
                  onChange={(event) => setConfirmEmail(event.target.value)}
                />
                {fieldError("confirmEmail")}
              </div>
              <div className="space-y-2">
                <label htmlFor="contributor-password" className={labelClass}>
                  {t("contributor.create.password")}
                </label>
                <input
                  id="contributor-password"
                  type="password"
                  className={inputClass}
                  autoComplete="new-password"
                  value={password}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={
                    fieldErrors.password ? "err-password" : undefined
                  }
                  onChange={(event) => setPassword(event.target.value)}
                />
                {fieldError("password")}
              </div>
            </fieldset>
          )}

          <ContributorProfileFields {...profileFields.fieldProps} />

          <button
            type="submit"
            className="btn btn-primary w-full sm:w-auto"
            disabled={submitting}
            data-testid="contributor-submit"
          >
            {submitting
              ? t("contributor.create.submitting")
              : t("contributor.create.submit")}
          </button>
        </form>
      </div>
    </main>
  );
}
