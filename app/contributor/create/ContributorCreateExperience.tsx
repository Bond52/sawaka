"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { readStoredUser, type StoredUser } from "@/app/lib/authUser";
import {
  createContributorProfile,
  getOwnContributor,
  listContributorDomains,
  listContributorSkills,
  resendContributorVerification,
  taxonomyLabel,
  type ContributorProfilePayload,
  type TaxonomyItem,
} from "@/app/lib/apiContributors";
import {
  BIOGRAPHY_MAX,
  CUSTOM_SKILL_MAX,
  MAX_CUSTOM_SKILLS,
  MAX_SELECTED_SKILLS,
  fieldElementId,
  firstInvalidField,
  validateContributorForm,
  type ContributorFieldErrors,
} from "@/app/lib/contributorValidation";

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
  const { locale, t } = useTranslation();
  const [screen, setScreen] = useState<Screen>("loading");
  const [sessionUser, setSessionUser] = useState<StoredUser | null>(null);
  const [owned, setOwned] = useState<ContributorProfilePayload | null>(null);
  const [createdNow, setCreatedNow] = useState(false);
  const [emailFailed, setEmailFailed] = useState(false);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [domainId, setDomainId] = useState("");
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [customSkills, setCustomSkills] = useState<string[]>([]);
  const [customDraft, setCustomDraft] = useState("");
  const [customDraftError, setCustomDraftError] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [biography, setBiography] = useState("");

  const [domains, setDomains] = useState<TaxonomyItem[]>([]);
  const [domainsError, setDomainsError] = useState(false);
  const [skills, setSkills] = useState<TaxonomyItem[]>([]);
  const [skillsState, setSkillsState] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const [additionalDomainId, setAdditionalDomainId] = useState("");
  const [additionalSkills, setAdditionalSkills] = useState<TaxonomyItem[]>([]);
  const [additionalSkillsState, setAdditionalSkillsState] = useState<
    "idle" | "loading" | "error" | "ready"
  >("idle");
  const [additionalSelections, setAdditionalSelections] = useState<TaxonomyItem[]>([]);
  const [skillsCleared, setSkillsCleared] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ContributorFieldErrors>({});
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
        setDisplayName(suggestedDisplayName(user));
        setScreen("form");
        return;
      }
      setScreen("loadError");
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadDomains() {
      const result = await listContributorDomains();
      if (cancelled) return;
      if (!result.ok) {
        setDomainsError(true);
        return;
      }
      setDomains(result.domains);
      setDomainsError(false);
    }
    loadDomains();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!domainId) {
      setSkills([]);
      setSkillsState("idle");
      return;
    }
    let cancelled = false;
    setSkillsState("loading");
    listContributorSkills(domainId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setSkills([]);
        setSkillsState("error");
        return;
      }
      setSkills(result.skills);
      setSkillsState("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [domainId]);

  useEffect(() => {
    if (!additionalDomainId) {
      setAdditionalSkills([]);
      setAdditionalSkillsState("idle");
      return;
    }
    let cancelled = false;
    setAdditionalSkillsState("loading");
    listContributorSkills(additionalDomainId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setAdditionalSkills([]);
        setAdditionalSkillsState("error");
        return;
      }
      setAdditionalSkills(result.skills);
      setAdditionalSkillsState("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [additionalDomainId]);

  function messageFor(code: string): string {
    const key = `contributor.create.errors.${code}`;
    const message = t(key);
    return message === key ? t("contributor.create.errors.generic") : message;
  }

  function focusField(field: string) {
    const id = fieldElementId(field);
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.focus();
    });
  }

  function onDomainChange(nextDomainId: string) {
    const additionalIds = new Set(additionalSelections.map((item) => item.id));
    const removedPrimary = skillIds.some((id) => !additionalIds.has(id));
    setDomainId(nextDomainId);
    setSkillsCleared(removedPrimary);
    setSkillIds(skillIds.filter((id) => additionalIds.has(id)));
    if (additionalDomainId === nextDomainId) {
      setAdditionalDomainId("");
    }
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.domainId;
      delete next.skillIds;
      return next;
    });
  }

  function toggleSkill(
    skillId: string,
    origin: "primary" | "additional",
    skill?: TaxonomyItem
  ) {
    setSkillsCleared(false);
    if (skillIds.includes(skillId)) {
      setSkillIds(skillIds.filter((id) => id !== skillId));
      setAdditionalSelections((current) => current.filter((item) => item.id !== skillId));
      return;
    }
    if (skillIds.length + customSkills.length >= MAX_SELECTED_SKILLS) {
      setFieldErrors((errors) => ({ ...errors, skillIds: "SKILL_LIMIT" }));
      return;
    }
    setFieldErrors((errors) => {
      const next = { ...errors };
      delete next.skillIds;
      return next;
    });
    setSkillIds([...skillIds, skillId]);
    if (
      origin === "additional" &&
      skill &&
      !additionalSelections.some((item) => item.id === skillId)
    ) {
      setAdditionalSelections([...additionalSelections, skill]);
    }
  }

  function removableSkillChip(
    label: string,
    onRemove: () => void,
    testId?: string,
    pressed?: boolean
  ) {
    return (
      <button
        type="button"
        data-testid={testId}
        className="min-h-[44px] rounded-full border border-border bg-secondary px-3 py-2 text-sm text-foreground"
        onClick={onRemove}
        aria-pressed={pressed}
        aria-label={t("contributor.create.customRemove", { label })}
      >
        {label} ×
      </button>
    );
  }

  function addCustomSkill() {
    const label = customDraft.trim();
    if (!label) {
      setCustomDraftError("CUSTOM_SKILL_INVALID");
      return;
    }
    if (label.length > CUSTOM_SKILL_MAX) {
      setCustomDraftError("CUSTOM_SKILL_LENGTH");
      return;
    }
    const key = label.toLocaleLowerCase();
    if (customSkills.some((item) => item.toLocaleLowerCase() === key)) {
      setCustomDraftError("CUSTOM_SKILL_DUPLICATE");
      return;
    }
    if (customSkills.length >= MAX_CUSTOM_SKILLS) {
      setCustomDraftError("CUSTOM_SKILL_LIMIT");
      return;
    }
    if (skillIds.length + customSkills.length >= MAX_SELECTED_SKILLS) {
      setCustomDraftError("SKILL_LIMIT");
      return;
    }
    setCustomSkills((current) => [...current, label]);
    setCustomDraft("");
    setCustomDraftError("");
    setFieldErrors((errors) => {
      const next = { ...errors };
      delete next.customSkills;
      delete next.skillIds;
      return next;
    });
  }

  function removeCustomSkill(label: string) {
    setCustomSkills((current) => current.filter((item) => item !== label));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setFormError("");
    const includeAccount = !sessionUser;
    const errors = validateContributorForm(
      {
        username,
        email,
        confirmEmail,
        password,
        displayName,
        domainId,
        skillIds,
        customSkills,
        country,
        region,
        city,
        biography,
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
      displayName: displayName.trim(),
      domainId,
      skillIds,
      customSkills: customSkills.map((label) => label.trim()),
      country: country.trim(),
      region: region.trim(),
      city: city.trim(),
      biography: biography.trim(),
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
          displayName: displayName.trim(),
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
    return (
      <p id={`err-${field}`} className="text-sm text-destructive" role="alert">
        {messageFor(code)}
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

          <fieldset className="space-y-4">
            <legend className="font-display text-lg font-semibold text-foreground">
              {t("contributor.create.profileSection")}
            </legend>
            <p className="text-sm text-muted-foreground">
              {t("contributor.create.profileHint")}
            </p>

            <div className="space-y-2">
              <label htmlFor="contributor-display-name" className={labelClass}>
                {t("contributor.create.displayName")}
              </label>
              <input
                id="contributor-display-name"
                className={inputClass}
                value={displayName}
                maxLength={80}
                aria-invalid={Boolean(fieldErrors.displayName)}
                aria-describedby={
                  fieldErrors.displayName
                    ? "err-displayName contributor-display-hint"
                    : "contributor-display-hint"
                }
                onChange={(event) => setDisplayName(event.target.value)}
              />
              <p
                id="contributor-display-hint"
                className="text-sm text-muted-foreground"
              >
                {t("contributor.create.displayNameHint")}
              </p>
              {fieldError("displayName")}
            </div>

            <div className="space-y-2">
              <label htmlFor="contributor-domain" className={labelClass}>
                {t("contributor.create.domain")}
              </label>
              {domainsError ? (
                <p role="alert" className="text-sm text-destructive">
                  {t("contributor.create.taxonomyError")}
                </p>
              ) : (
                <select
                  id="contributor-domain"
                  className={inputClass}
                  value={domainId}
                  aria-invalid={Boolean(fieldErrors.domainId)}
                  aria-describedby={
                    fieldErrors.domainId ? "err-domainId" : undefined
                  }
                  onChange={(event) => onDomainChange(event.target.value)}
                >
                  <option value="">{t("contributor.create.domainPlaceholder")}</option>
                  {domains.map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {taxonomyLabel(domain, locale)}
                    </option>
                  ))}
                </select>
              )}
              {fieldError("domainId")}
            </div>

            <div className="space-y-2">
              <fieldset
                id="contributor-skills"
                tabIndex={-1}
                className="space-y-3"
                aria-invalid={Boolean(fieldErrors.skillIds)}
                aria-describedby="contributor-skills-hint"
              >
                <legend className={labelClass}>{t("contributor.create.skills")}</legend>
                <p
                  id="contributor-skills-hint"
                  className="text-sm text-muted-foreground"
                >
                  {t("contributor.create.skillsHint")}
                </p>
                {!domainId && (
                  <p className="text-sm text-muted-foreground">
                    {t("contributor.create.skillsNeedDomain")}
                  </p>
                )}
                {skillsState === "loading" && (
                  <p role="status" className="text-sm text-muted-foreground">
                    {t("contributor.create.skillsLoading")}
                  </p>
                )}
                {skillsState === "error" && (
                  <p role="alert" className="text-sm text-destructive">
                    {t("contributor.create.skillsError")}
                  </p>
                )}
                {skillsState === "ready" && skills.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t("contributor.create.skillsEmpty")}
                  </p>
                )}
                {skillsCleared && (
                  <p role="status" className="text-sm text-foreground">
                    {t("contributor.create.skillsCleared")}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => {
                    const selected = skillIds.includes(skill.id);
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        data-testid={`contributor-skill-${skill.id}`}
                        aria-pressed={selected}
                        className={`min-h-[44px] rounded-full border px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                          selected
                            ? "border-primary bg-primary/10 font-semibold text-foreground"
                            : "border-border bg-card text-foreground"
                        }`}
                        onClick={() => toggleSkill(skill.id, "primary", skill)}
                      >
                        {taxonomyLabel(skill, locale)}
                      </button>
                    );
                  })}
                </div>
                {skills.some((skill) => skillIds.includes(skill.id)) && (
                  <ul className="flex flex-wrap gap-2">
                    {skills
                      .filter((skill) => skillIds.includes(skill.id))
                      .map((skill) => (
                        <li key={skill.id}>
                          {removableSkillChip(
                            taxonomyLabel(skill, locale),
                            () => toggleSkill(skill.id, "primary", skill),
                            `contributor-primary-selected-${skill.id}`,
                            true
                          )}
                        </li>
                      ))}
                  </ul>
                )}
              </fieldset>
              {fieldError("skillIds")}
            </div>

            <div className="space-y-2">
              <fieldset className="space-y-3">
                <legend className={labelClass}>
                  {t("contributor.create.additionalSkills")}
                </legend>
                <p
                  id="contributor-additional-hint"
                  className="text-sm text-muted-foreground"
                >
                  {t("contributor.create.additionalHint")}
                </p>
                <label htmlFor="contributor-additional-domain" className={labelClass}>
                  {t("contributor.create.additionalDomain")}
                </label>
                <select
                  id="contributor-additional-domain"
                  className={inputClass}
                  value={additionalDomainId}
                  aria-describedby="contributor-additional-hint"
                  onChange={(event) => setAdditionalDomainId(event.target.value)}
                >
                  <option value="">
                    {t("contributor.create.additionalDomainPlaceholder")}
                  </option>
                  {domains
                    .filter((domain) => domain.id !== domainId)
                    .map((domain) => (
                      <option key={domain.id} value={domain.id}>
                        {taxonomyLabel(domain, locale)}
                      </option>
                    ))}
                </select>
                {!additionalDomainId && (
                  <p className="text-sm text-muted-foreground">
                    {t("contributor.create.additionalNeedDomain")}
                  </p>
                )}
                {additionalSkillsState === "loading" && (
                  <p role="status" className="text-sm text-muted-foreground">
                    {t("contributor.create.skillsLoading")}
                  </p>
                )}
                {additionalSkillsState === "error" && (
                  <p role="alert" className="text-sm text-destructive">
                    {t("contributor.create.skillsError")}
                  </p>
                )}
                {additionalSkillsState === "ready" && additionalSkills.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t("contributor.create.skillsEmpty")}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {additionalSkills.map((skill) => {
                    const selected = skillIds.includes(skill.id);
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        data-testid={`contributor-additional-skill-${skill.id}`}
                        aria-pressed={selected}
                        className={`min-h-[44px] rounded-full border px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                          selected
                            ? "border-primary bg-primary/10 font-semibold text-foreground"
                            : "border-border bg-card text-foreground"
                        }`}
                        onClick={() => toggleSkill(skill.id, "additional", skill)}
                      >
                        {taxonomyLabel(skill, locale)}
                      </button>
                    );
                  })}
                </div>
                {additionalSelections.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {additionalSelections.map((skill) => (
                      <li key={skill.id}>
                        {removableSkillChip(
                          taxonomyLabel(skill, locale),
                          () => toggleSkill(skill.id, "additional", skill),
                          `contributor-additional-selected-${skill.id}`,
                          true
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </fieldset>
            </div>

            <div className="space-y-2">
              <label htmlFor="contributor-custom-skill" className={labelClass}>
                {t("contributor.create.customSkills")}
              </label>
              <p className="text-sm text-muted-foreground">
                {t("contributor.create.customHint")}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="contributor-custom-skill"
                  className={inputClass}
                  value={customDraft}
                  maxLength={CUSTOM_SKILL_MAX}
                  aria-invalid={Boolean(customDraftError || fieldErrors.customSkills)}
                  aria-describedby={
                    customDraftError || fieldErrors.customSkills
                      ? "err-customSkills"
                      : undefined
                  }
                  placeholder={t("contributor.create.customPlaceholder")}
                  onChange={(event) => setCustomDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addCustomSkill();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary shrink-0"
                  onClick={addCustomSkill}
                  data-testid="contributor-add-custom-skill"
                >
                  {t("contributor.create.customAdd")}
                </button>
              </div>
              {(customDraftError || fieldErrors.customSkills) && (
                <p id="err-customSkills" className="text-sm text-destructive" role="alert">
                  {messageFor(customDraftError || fieldErrors.customSkills)}
                </p>
              )}
              {customSkills.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {customSkills.map((label) => (
                    <li key={label}>
                      {removableSkillChip(label, () => removeCustomSkill(label))}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <label htmlFor="contributor-country" className={labelClass}>
                  {t("contributor.create.country")}
                </label>
                <input
                  id="contributor-country"
                  className={inputClass}
                  autoComplete="country-name"
                  value={country}
                  maxLength={120}
                  aria-invalid={Boolean(fieldErrors.country)}
                  aria-describedby={fieldErrors.country ? "err-country" : undefined}
                  onChange={(event) => setCountry(event.target.value)}
                />
                {fieldError("country")}
              </div>
              <div className="space-y-2">
                <label htmlFor="contributor-region" className={labelClass}>
                  {t("contributor.create.region")}
                </label>
                <input
                  id="contributor-region"
                  className={inputClass}
                  value={region}
                  maxLength={120}
                  aria-invalid={Boolean(fieldErrors.region)}
                  aria-describedby="contributor-region-hint"
                  onChange={(event) => setRegion(event.target.value)}
                />
                <p id="contributor-region-hint" className="text-sm text-muted-foreground">
                  {t("contributor.create.regionHint")}
                </p>
                {fieldError("region")}
              </div>
              <div className="space-y-2">
                <label htmlFor="contributor-city" className={labelClass}>
                  {t("contributor.create.city")}
                </label>
                <input
                  id="contributor-city"
                  className={inputClass}
                  autoComplete="address-level2"
                  value={city}
                  maxLength={120}
                  aria-describedby="contributor-city-hint"
                  onChange={(event) => setCity(event.target.value)}
                />
                <p id="contributor-city-hint" className="text-sm text-muted-foreground">
                  {t("contributor.create.cityHint")}
                </p>
                {fieldError("city")}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="contributor-biography" className={labelClass}>
                {t("contributor.create.biography")}
              </label>
              <textarea
                id="contributor-biography"
                className={`${inputClass} min-h-32`}
                value={biography}
                maxLength={BIOGRAPHY_MAX}
                aria-invalid={Boolean(fieldErrors.biography)}
                aria-describedby="contributor-biography-hint"
                onChange={(event) => setBiography(event.target.value)}
              />
              <p id="contributor-biography-hint" className="text-sm text-muted-foreground">
                {t("contributor.create.biographyHint", {
                  count: biography.length,
                  max: BIOGRAPHY_MAX,
                })}
              </p>
              {fieldError("biography")}
            </div>
          </fieldset>

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
