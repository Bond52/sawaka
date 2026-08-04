"use client";

import { Globe, Lock, MailWarning } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  ALLOWED_SUPPLIER_CATEGORIES,
  SUPPLIER_CATEGORY_OPTIONS,
  type SupplierCategory,
} from "@/app/lib/supplierCategories";
import {
  cancelPendingContactEmail,
  resendContactEmailVerification,
  updateEditableSupplier,
  type EditableSupplier,
  type EditableSupplierPayload,
} from "@/app/lib/apiSuppliers";

type Category = SupplierCategory;

const ALLOWED_CATEGORY_VALUES = ALLOWED_SUPPLIER_CATEGORIES as Set<Category>;

type FormState = {
  name: string;
  country: string;
  region: string;
  city: string;
  address: string;
  postalCode: string;
  accountEmail: string;
  publicEmail: string;
  phone: string;
  website: string;
};

/** Distinguishes a full save from one that still awaits contact-email verification. */
type SavedState = null | "saved" | "savedPendingEmail";

type EmailAction = null | "resend" | "cancel";

type EmailFeedback = { tone: "success" | "error"; message: string } | null;

type Props = {
  initial: EditableSupplier;
  token: string;
  /** Called when the management session is no longer accepted by the API. */
  onSessionExpired: () => void;
};

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: string): boolean {
  return emailRe.test(value.trim());
}

function isValidOptionalUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  try {
    const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    new URL(withProto);
    return true;
  } catch {
    return false;
  }
}

function normalizeCategoryValues(selected: readonly string[]): Category[] {
  const filtered = (Array.isArray(selected) ? selected : []).filter(
    (v): v is Category =>
      typeof v === "string" && ALLOWED_CATEGORY_VALUES.has(v as Category)
  );
  return Array.from(new Set<Category>(filtered));
}

function toFormState(supplier: EditableSupplier): FormState {
  return {
    name: supplier.name ?? "",
    country: supplier.country ?? "",
    region: supplier.region ?? "",
    city: supplier.city ?? "",
    address: supplier.address ?? "",
    postalCode: supplier.postalCode ?? "",
    accountEmail: supplier.accountEmail ?? "",
    publicEmail: supplier.publicEmail ?? "",
    phone: supplier.phone ?? "",
    website: supplier.website ?? "",
  };
}

const FORM_FIELDS = [
  "name",
  "country",
  "region",
  "city",
  "address",
  "postalCode",
  "accountEmail",
  "publicEmail",
  "phone",
  "website",
] as const;

function sameCategories(a: readonly string[], b: readonly string[]): boolean {
  const left = normalizeCategoryValues(a).slice().sort();
  const right = normalizeCategoryValues(b).slice().sort();
  return (
    left.length === right.length && left.every((v, i) => v === right[i])
  );
}

/** Only sends what actually changed so untouched fields keep their value. */
function buildChangedPayload(
  form: FormState,
  categories: readonly Category[],
  baseForm: FormState,
  baseCategories: readonly string[]
): EditableSupplierPayload {
  const payload: EditableSupplierPayload = {};

  for (const field of FORM_FIELDS) {
    const next = form[field].trim();
    if (next !== baseForm[field].trim()) {
      payload[field] = next;
    }
  }

  if (!sameCategories(categories, baseCategories)) {
    payload.categories = normalizeCategoryValues(categories);
  }

  return payload;
}

const FIELD_INPUT_ID: Record<string, string> = {
  name: "manage-supplier-name",
  categories: "manage-supplier-categories",
  country: "manage-supplier-country",
  region: "manage-supplier-region",
  city: "manage-supplier-city",
  address: "manage-supplier-address",
  postalCode: "manage-supplier-postal",
  accountEmail: "manage-supplier-account-email",
  publicEmail: "manage-supplier-public-email",
  phone: "manage-supplier-phone",
  website: "manage-supplier-website",
};

const VALIDATION_FIELD_ORDER = [
  "name",
  "categories",
  "country",
  "accountEmail",
  "publicEmail",
  "phone",
  "website",
] as const;

function focusFirstFieldError(errors: Record<string, string>) {
  if (typeof document === "undefined") return;
  for (const key of VALIDATION_FIELD_ORDER) {
    if (!errors[key]) continue;
    const el = document.getElementById(FIELD_INPUT_ID[key] ?? "");
    if (!el) continue;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLButtonElement
    ) {
      el.focus({ preventScroll: true });
    }
    break;
  }
}

export default function ManageSupplierForm({
  initial,
  token,
  onSessionExpired,
}: Props) {
  const { t } = useTranslation();
  const router = useRouter();

  const [baseline, setBaseline] = useState<EditableSupplier>(initial);
  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const [categories, setCategories] = useState<Category[]>(() =>
    normalizeCategoryValues(initial.categories)
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Record<string, string>
  >({});
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedState>(null);
  const [saving, setSaving] = useState(false);
  const [emailAction, setEmailAction] = useState<EmailAction>(null);
  const [emailFeedback, setEmailFeedback] = useState<EmailFeedback>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const saveLockRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  const baseForm = useMemo(() => toFormState(baseline), [baseline]);
  const profileHref = `/fournisseurs/${encodeURIComponent(baseline.id)}`;

  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    const name = form.name.trim();
    const country = form.country.trim();
    const accountEmail = form.accountEmail.trim();
    const publicEmail = form.publicEmail.trim();
    const phone = form.phone.trim();
    const website = form.website.trim();

    if (!name) {
      errors.name = t("suppliers.validation.nameRequired");
    } else if (name.length < 2) {
      errors.name = t("suppliers.validation.nameMin");
    }

    if (normalizeCategoryValues(categories).length === 0) {
      errors.categories = t("suppliers.validation.categoriesRequired");
    }

    if (!country) {
      errors.country = t("suppliers.validation.countryRequired");
    }

    if (!accountEmail) {
      errors.accountEmail = t("suppliers.validation.accountEmailRequired");
    } else if (!isValidEmail(accountEmail)) {
      errors.accountEmail = t("suppliers.validation.accountEmailInvalid");
    }

    if (publicEmail && !isValidEmail(publicEmail)) {
      errors.publicEmail = t("suppliers.validation.publicEmailInvalid");
    }

    if (!phone) {
      errors.phone = t("suppliers.validation.phoneRequired");
    } else if (phone.length < 6) {
      errors.phone = t("suppliers.validation.phoneMin");
    }

    if (!isValidOptionalUrl(website)) {
      errors.website = t("suppliers.validation.websiteInvalid");
    }

    return errors;
  }, [categories, form, t]);

  const isValid = Object.keys(validationErrors).length === 0;

  const isDirty = useMemo(() => {
    if (!sameCategories(categories, baseline.categories)) return true;
    return FORM_FIELDS.some(
      (field) => form[field].trim() !== baseForm[field].trim()
    );
  }, [baseForm, baseline.categories, categories, form]);

  /** Errors are only surfaced once a field was edited or a save was attempted. */
  const visibleErrors = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [key, message] of Object.entries(validationErrors)) {
      if (submitAttempted || touched[key]) out[key] = message;
    }
    return { ...out, ...serverFieldErrors };
  }, [serverFieldErrors, submitAttempted, touched, validationErrors]);

  const resetFeedback = useCallback(() => {
    setServerMessage(null);
    setSaved(null);
  }, []);

  const pendingEmail = baseline.pendingContactEmail ?? "";

  const update =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setForm((prev) => ({ ...prev, [key]: value }));
      setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
      setServerFieldErrors((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      resetFeedback();
    };

  const toggleCategory = (value: Category) => {
    if (!ALLOWED_CATEGORY_VALUES.has(value)) return;
    setCategories((prev) => {
      const safe = normalizeCategoryValues(prev);
      return safe.includes(value)
        ? safe.filter((v) => v !== value)
        : [...safe, value];
    });
    setTouched((prev) =>
      prev.categories ? prev : { ...prev, categories: true }
    );
    setServerFieldErrors((prev) => {
      if (!("categories" in prev)) return prev;
      const next = { ...prev };
      delete next.categories;
      return next;
    });
    resetFeedback();
  };

  const leaveTo = useCallback(
    (href: string) => {
      if (isDirty) {
        setPendingHref(href);
        return;
      }
      router.push(href);
    },
    [isDirty, router]
  );

  useEffect(() => {
    if (!pendingHref) return;
    confirmRef.current?.focus();
  }, [pendingHref]);

  /** Keeps keyboard focus inside the confirmation dialog while it is open. */
  useEffect(() => {
    if (!pendingHref) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setPendingHref(null);
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href]"
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
  }, [pendingHref]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving || saveLockRef.current) return;

    resetFeedback();
    setSubmitAttempted(true);

    if (!isValid) {
      setServerMessage(t("suppliers.manage.saveValidationError"));
      queueMicrotask(() => focusFirstFieldError(validationErrors));
      return;
    }

    const payload = buildChangedPayload(
      form,
      categories,
      baseForm,
      baseline.categories
    );
    if (Object.keys(payload).length === 0) return;

    setSaving(true);
    saveLockRef.current = true;
    setServerFieldErrors({});

    try {
      const result = await updateEditableSupplier(token, payload);

      if (result.ok) {
        setBaseline(result.supplier);
        setForm(toFormState(result.supplier));
        setCategories(normalizeCategoryValues(result.supplier.categories));
        setTouched({});
        setSubmitAttempted(false);
        setServerFieldErrors({});
        setEmailFeedback(null);
        setSaved(
          result.emailVerificationPending ? "savedPendingEmail" : "saved"
        );
        return;
      }

      if (result.status === 401 || result.status === 403) {
        onSessionExpired();
        return;
      }

      if (result.fieldErrors) {
        setServerFieldErrors(result.fieldErrors);
        setServerMessage(t("suppliers.manage.saveValidationError"));
        queueMicrotask(() => focusFirstFieldError(result.fieldErrors ?? {}));
        return;
      }

      setServerMessage(
        result.status === 0
          ? t("suppliers.manage.saveNetworkError")
          : t("suppliers.manage.saveError")
      );
    } finally {
      setSaving(false);
      saveLockRef.current = false;
    }
  }

  /** Maps a failed contact-email action to a localized message. */
  const emailActionError = useCallback(
    (status: number, fallbackKey: string) => {
      if (status === 0) return t("suppliers.manage.pendingEmailNetworkError");
      if (status === 429) return t("suppliers.manage.pendingEmailRateLimited");
      return t(fallbackKey);
    },
    [t]
  );

  async function handleResendVerification() {
    if (emailAction) return;

    setEmailAction("resend");
    setEmailFeedback(null);
    setSaved(null);

    try {
      const result = await resendContactEmailVerification(token);

      if (result.ok) {
        setEmailFeedback({
          tone: "success",
          message: t("suppliers.manage.pendingEmailResent"),
        });
        return;
      }

      if (result.status === 401 || result.status === 403) {
        onSessionExpired();
        return;
      }

      setEmailFeedback({
        tone: "error",
        message: emailActionError(
          result.status,
          "suppliers.manage.pendingEmailResendError"
        ),
      });
    } finally {
      setEmailAction(null);
    }
  }

  async function handleCancelEmailChange() {
    if (emailAction) return;

    setEmailAction("cancel");
    setEmailFeedback(null);
    setSaved(null);

    try {
      const result = await cancelPendingContactEmail(token);

      if (result.ok) {
        setBaseline(result.supplier);
        setForm((prev) => ({
          ...prev,
          accountEmail: result.supplier.accountEmail,
        }));
        setServerFieldErrors((prev) => {
          if (!("accountEmail" in prev)) return prev;
          const next = { ...prev };
          delete next.accountEmail;
          return next;
        });
        setEmailFeedback({
          tone: "success",
          message: t("suppliers.manage.pendingEmailCancelled"),
        });
        return;
      }

      if (result.status === 401 || result.status === 403) {
        onSessionExpired();
        return;
      }

      setEmailFeedback({
        tone: "error",
        message: emailActionError(
          result.status,
          "suppliers.manage.pendingEmailCancelError"
        ),
      });
    } finally {
      setEmailAction(null);
    }
  }

  const labelClass = "block text-sm font-semibold text-slate-700 mb-2";
  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-sawaka-500 focus:outline-none focus:ring-2 focus:ring-sawaka-500/25";
  const errorClass = "mt-1.5 text-sm font-medium text-red-600";

  const saveDisabled = saving || !isDirty || !isValid;

  return (
    <>
      <div className="mb-6">
        <button
          type="button"
          data-testid="manage-supplier-back"
          onClick={() => leaveTo(profileHref)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-sawaka-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sawaka-500"
        >
          <span aria-hidden>←</span>
          {t("suppliers.manage.back")}
        </button>
      </div>

      <form
        data-testid="manage-supplier-form"
        onSubmit={handleSubmit}
        noValidate
        className="rounded-2xl border border-slate-200/90 bg-white shadow-soft"
      >
        <div className="space-y-8 p-6 sm:p-8 lg:p-10">
          {saved === "saved" && (
            <div
              data-testid="manage-supplier-success"
              role="status"
              className="rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-4 py-3.5 text-sm font-medium text-emerald-900 shadow-sm"
            >
              {t("suppliers.manage.saved")}
            </div>
          )}

          {saved === "savedPendingEmail" && (
            <div
              data-testid="manage-supplier-saved-pending-email"
              role="status"
              className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3.5 text-sm font-medium text-amber-900 shadow-sm"
            >
              {t("suppliers.manage.savedPendingEmail")}
            </div>
          )}

          {pendingEmail && (
            <section
              data-testid="manage-supplier-pending-email"
              aria-labelledby="manage-supplier-pending-email-title"
              className="rounded-xl border border-amber-200/90 bg-amber-50/70 px-4 py-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <MailWarning
                  className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
                  strokeWidth={2}
                  aria-hidden
                />
                <div className="min-w-0 flex-1 space-y-3">
                  <h3
                    id="manage-supplier-pending-email-title"
                    className="text-sm font-semibold text-amber-900"
                  >
                    {t("suppliers.manage.pendingEmailTitle")}
                  </h3>
                  <p
                    data-testid="manage-supplier-pending-email-body"
                    className="break-words text-sm text-amber-900"
                  >
                    {t("suppliers.manage.pendingEmailBody", {
                      pending: pendingEmail,
                      current: baseline.accountEmail,
                    })}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      data-testid="manage-supplier-pending-email-resend"
                      onClick={handleResendVerification}
                      disabled={emailAction !== null}
                      className="btn btn-outline min-h-[44px] rounded-xl px-4 text-sm font-semibold disabled:pointer-events-none disabled:opacity-50"
                    >
                      {emailAction === "resend"
                        ? t("suppliers.manage.pendingEmailResending")
                        : t("suppliers.manage.pendingEmailResend")}
                    </button>
                    <button
                      type="button"
                      data-testid="manage-supplier-pending-email-cancel"
                      onClick={handleCancelEmailChange}
                      disabled={emailAction !== null}
                      className="btn btn-outline min-h-[44px] rounded-xl px-4 text-sm font-semibold disabled:pointer-events-none disabled:opacity-50"
                    >
                      {emailAction === "cancel"
                        ? t("suppliers.manage.pendingEmailCancelling")
                        : t("suppliers.manage.pendingEmailCancel")}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {emailFeedback && (
            <p
              data-testid="manage-supplier-pending-email-feedback"
              role={emailFeedback.tone === "error" ? "alert" : "status"}
              className={
                emailFeedback.tone === "error"
                  ? "rounded-xl border border-red-200/90 bg-red-50 px-4 py-3.5 text-sm font-medium text-red-900 shadow-sm"
                  : "rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-4 py-3.5 text-sm font-medium text-emerald-900 shadow-sm"
              }
            >
              {emailFeedback.message}
            </p>
          )}

          {serverMessage && (
            <div
              data-testid="manage-supplier-error"
              role="alert"
              className="rounded-xl border border-red-200/90 bg-red-50 px-4 py-3.5 text-sm font-medium text-red-900 shadow-sm"
            >
              {serverMessage}
            </div>
          )}

          <h2
            data-testid="manage-supplier-form-title"
            className="text-2xl font-bold tracking-tight text-slate-900"
          >
            {t("suppliers.manage.formTitle")}
          </h2>

          <div className="h-px bg-slate-100" aria-hidden />

          {/* Supplier information */}
          <section className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-900">
              {t("suppliers.manage.sectionInformation")}
            </h3>

            <div className="space-y-2">
              <label htmlFor="manage-supplier-name" className={labelClass}>
                {t("suppliers.name")} <span className="text-red-600">*</span>
              </label>
              <input
                id="manage-supplier-name"
                data-testid="manage-supplier-input-name"
                name="name"
                value={form.name}
                onChange={update("name")}
                autoComplete="organization"
                placeholder={t("suppliers.namePlaceholder")}
                className={inputClass}
                aria-invalid={!!visibleErrors.name}
                aria-describedby={
                  visibleErrors.name ? "manage-err-name" : undefined
                }
              />
              {visibleErrors.name && (
                <p
                  id="manage-err-name"
                  data-testid="manage-supplier-error-name"
                  role="alert"
                  className={errorClass}
                >
                  {visibleErrors.name}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <span className={`${labelClass} mb-0`}>
                {t("suppliers.categorySingle")}{" "}
                <span className="text-red-600">*</span>
              </span>
              <div
                id="manage-supplier-categories"
                className="flex flex-wrap gap-2.5"
                role="group"
                aria-label={t("suppliers.categoriesAria")}
                aria-invalid={!!visibleErrors.categories}
                aria-describedby={
                  visibleErrors.categories ? "manage-err-categories" : undefined
                }
              >
                {SUPPLIER_CATEGORY_OPTIONS.map((opt) => {
                  const selected = categories.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      data-testid={`manage-supplier-category-${opt.value}`}
                      aria-pressed={selected}
                      onClick={() => toggleCategory(opt.value)}
                      className={[
                        "rounded-full border px-3.5 py-2 text-xs font-medium transition-all md:text-[13px]",
                        selected
                          ? "border-sawaka-600 bg-sawaka-50 text-sawaka-900 shadow-sm ring-1 ring-sawaka-600/20"
                          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {t(`suppliers.categoryOptions.${opt.value}`)}
                    </button>
                  );
                })}
              </div>
              {visibleErrors.categories && (
                <p
                  id="manage-err-categories"
                  data-testid="manage-supplier-error-categories"
                  role="alert"
                  className={errorClass}
                >
                  {visibleErrors.categories}
                </p>
              )}
            </div>
          </section>

          <div className="h-px bg-slate-100" aria-hidden />

          {/* Location */}
          <section className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-900">
              {t("suppliers.manage.sectionLocation")}
            </h3>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <label htmlFor="manage-supplier-country" className={labelClass}>
                  {t("suppliers.country")}{" "}
                  <span className="text-red-600">*</span>
                </label>
                <input
                  id="manage-supplier-country"
                  data-testid="manage-supplier-input-country"
                  name="country"
                  value={form.country}
                  onChange={update("country")}
                  autoComplete="country-name"
                  placeholder={t("suppliers.country")}
                  className={inputClass}
                  aria-invalid={!!visibleErrors.country}
                  aria-describedby={
                    visibleErrors.country ? "manage-err-country" : undefined
                  }
                />
                {visibleErrors.country && (
                  <p
                    id="manage-err-country"
                    data-testid="manage-supplier-error-country"
                    role="alert"
                    className={errorClass}
                  >
                    {visibleErrors.country}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="manage-supplier-region" className={labelClass}>
                  {t("suppliers.region")}
                </label>
                <input
                  id="manage-supplier-region"
                  data-testid="manage-supplier-input-region"
                  name="region"
                  value={form.region}
                  onChange={update("region")}
                  placeholder={t("suppliers.region")}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="manage-supplier-city" className={labelClass}>
                  {t("suppliers.city")}
                </label>
                <input
                  id="manage-supplier-city"
                  data-testid="manage-supplier-input-city"
                  name="city"
                  value={form.city}
                  onChange={update("city")}
                  autoComplete="address-level2"
                  placeholder={t("suppliers.city")}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="manage-supplier-address" className={labelClass}>
                  {t("suppliers.address")}
                </label>
                <textarea
                  id="manage-supplier-address"
                  data-testid="manage-supplier-input-address"
                  name="address"
                  value={form.address}
                  onChange={update("address")}
                  rows={3}
                  placeholder={t("suppliers.addressPlaceholder")}
                  className={`${inputClass} min-h-[5.5rem] resize-y`}
                />
              </div>

              <div className="max-w-full space-y-2 md:max-w-xs">
                <label htmlFor="manage-supplier-postal" className={labelClass}>
                  {t("suppliers.postalCode")}
                </label>
                <input
                  id="manage-supplier-postal"
                  data-testid="manage-supplier-input-postal"
                  name="postalCode"
                  value={form.postalCode}
                  onChange={update("postalCode")}
                  autoComplete="postal-code"
                  placeholder={t("suppliers.postalPlaceholder")}
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          <div className="h-px bg-slate-100" aria-hidden />

          {/* Contact */}
          <section className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-900">
              {t("suppliers.manage.sectionContact")}
            </h3>

            <div className="space-y-2">
              <label htmlFor="manage-supplier-phone" className={labelClass}>
                {t("suppliers.phone")} <span className="text-red-600">*</span>
              </label>
              <input
                id="manage-supplier-phone"
                data-testid="manage-supplier-input-phone"
                type="tel"
                name="phone"
                value={form.phone}
                onChange={update("phone")}
                autoComplete="tel"
                placeholder={t("suppliers.phonePlaceholder")}
                className={inputClass}
                aria-invalid={!!visibleErrors.phone}
                aria-describedby={
                  visibleErrors.phone ? "manage-err-phone" : undefined
                }
              />
              {visibleErrors.phone && (
                <p
                  id="manage-err-phone"
                  data-testid="manage-supplier-error-phone"
                  role="alert"
                  className={errorClass}
                >
                  {visibleErrors.phone}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="manage-supplier-account-email"
                className={labelClass}
              >
                {t("suppliers.accountEmail")}{" "}
                <span className="text-red-600">*</span>
              </label>
              <input
                id="manage-supplier-account-email"
                data-testid="manage-supplier-input-account-email"
                type="email"
                name="accountEmail"
                value={form.accountEmail}
                onChange={update("accountEmail")}
                autoComplete="email"
                placeholder={t("suppliers.accountEmailPlaceholder")}
                className={inputClass}
                aria-invalid={!!visibleErrors.accountEmail}
                aria-describedby={
                  visibleErrors.accountEmail
                    ? "manage-err-accountEmail"
                    : "manage-hint-accountEmail"
                }
              />
              {visibleErrors.accountEmail && (
                <p
                  id="manage-err-accountEmail"
                  data-testid="manage-supplier-error-account-email"
                  role="alert"
                  className={errorClass}
                >
                  {visibleErrors.accountEmail}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                  <Lock className="h-3.5 w-3.5" strokeWidth={2} />
                  {t("suppliers.privateBadge")}
                </span>
                <p
                  id="manage-hint-accountEmail"
                  className="text-xs text-slate-500"
                >
                  {t("suppliers.manage.accountEmailHint")}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="manage-supplier-public-email"
                className={labelClass}
              >
                {t("suppliers.publicEmail")}
              </label>
              <input
                id="manage-supplier-public-email"
                data-testid="manage-supplier-input-public-email"
                type="email"
                name="publicEmail"
                value={form.publicEmail}
                onChange={update("publicEmail")}
                placeholder={t("suppliers.publicEmailPlaceholder")}
                className={inputClass}
                aria-invalid={!!visibleErrors.publicEmail}
                aria-describedby={
                  visibleErrors.publicEmail
                    ? "manage-err-publicEmail"
                    : undefined
                }
              />
              {visibleErrors.publicEmail && (
                <p
                  id="manage-err-publicEmail"
                  data-testid="manage-supplier-error-public-email"
                  role="alert"
                  className={errorClass}
                >
                  {visibleErrors.publicEmail}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800">
                  <Globe className="h-3.5 w-3.5" strokeWidth={2} />
                  {t("suppliers.publicBadge")}
                </span>
                <p className="text-xs text-slate-500">
                  {t("suppliers.publicHint")}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="manage-supplier-website" className={labelClass}>
                {t("suppliers.website")}
              </label>
              <input
                id="manage-supplier-website"
                data-testid="manage-supplier-input-website"
                type="text"
                name="website"
                value={form.website}
                onChange={update("website")}
                placeholder={t("suppliers.websitePlaceholder")}
                className={inputClass}
                aria-invalid={!!visibleErrors.website}
                aria-describedby={
                  visibleErrors.website ? "manage-err-website" : undefined
                }
              />
              {visibleErrors.website && (
                <p
                  id="manage-err-website"
                  data-testid="manage-supplier-error-website"
                  role="alert"
                  className={errorClass}
                >
                  {visibleErrors.website}
                </p>
              )}
            </div>
          </section>

          <div className="h-px bg-slate-100" aria-hidden />

          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
              <button
                type="submit"
                data-testid="manage-supplier-save"
                disabled={saveDisabled}
                aria-describedby={
                  !isDirty && !saving ? "manage-supplier-save-hint" : undefined
                }
                className="btn btn-primary min-h-[48px] w-full rounded-xl px-6 py-3 text-base font-semibold shadow-sm disabled:pointer-events-none disabled:opacity-50 sm:w-auto sm:min-w-[220px]"
              >
                {saving
                  ? t("suppliers.manage.saving")
                  : t("suppliers.manage.save")}
              </button>
              <button
                type="button"
                data-testid="manage-supplier-cancel"
                disabled={saving}
                onClick={() => leaveTo(profileHref)}
                className="btn btn-outline min-h-[48px] w-full rounded-xl px-6 py-3 text-base font-semibold disabled:pointer-events-none disabled:opacity-50 sm:w-auto sm:min-w-[160px]"
              >
                {t("suppliers.manage.cancel")}
              </button>
            </div>
            {!isDirty && !saving && (
              <p
                id="manage-supplier-save-hint"
                data-testid="manage-supplier-save-hint"
                className="text-xs text-slate-500"
              >
                {t("suppliers.manage.noChangesHint")}
              </p>
            )}
          </div>
        </div>
      </form>

      {pendingHref && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="presentation"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) setPendingHref(null);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="manage-supplier-discard-title"
            aria-describedby="manage-supplier-discard-body"
            data-testid="manage-supplier-discard-dialog"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8"
          >
            <h2
              id="manage-supplier-discard-title"
              className="text-lg font-semibold text-slate-900"
            >
              {t("suppliers.manage.discardTitle")}
            </h2>
            <p
              id="manage-supplier-discard-body"
              className="mt-2 text-sm text-slate-600"
            >
              {t("suppliers.manage.discardBody")}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                data-testid="manage-supplier-discard-cancel"
                onClick={() => setPendingHref(null)}
                className="btn btn-outline min-h-[44px] rounded-xl font-semibold"
              >
                {t("suppliers.manage.discardKeepEditing")}
              </button>
              <button
                ref={confirmRef}
                type="button"
                data-testid="manage-supplier-discard-confirm"
                onClick={() => {
                  const href = pendingHref;
                  setPendingHref(null);
                  router.push(href);
                }}
                className="btn btn-primary min-h-[44px] rounded-xl font-semibold"
              >
                {t("suppliers.manage.discardConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
