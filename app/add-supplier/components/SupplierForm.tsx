"use client";

import { Globe, Lock } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  ALLOWED_SUPPLIER_CATEGORIES,
  SUPPLIER_CATEGORY_OPTIONS,
  type SupplierCategory,
} from "@/app/lib/supplierCategories";

type Category = SupplierCategory;

export { SUPPLIER_CATEGORY_OPTIONS };

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

const initialForm: FormState = {
  name: "",
  country: "",
  region: "",
  city: "",
  address: "",
  postalCode: "",
  accountEmail: "",
  publicEmail: "",
  phone: "",
  website: "",
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

function normalizeCategoryValues(selected: string[]): Category[] {
  const asArray = Array.isArray(selected) ? selected : [];
  const filtered = asArray.filter(
    (v): v is Category =>
      typeof v === "string" && ALLOWED_CATEGORY_VALUES.has(v as Category)
  );
  return Array.from(new Set<Category>(filtered));
}

function buildPayload(
  form: FormState,
  categories: string[]
): Record<string, unknown> {
  const safeCategories = normalizeCategoryValues(categories);
  const payload: Record<string, unknown> = {
    name: form.name.trim(),
    categories: safeCategories,
    country: form.country.trim(),
    accountEmail: form.accountEmail.trim(),
    phone: form.phone.trim(),
  };

  const region = form.region.trim();
  const city = form.city.trim();
  const address = form.address.trim();
  const postalCode = form.postalCode.trim();
  const publicEmail = form.publicEmail.trim();
  const website = form.website.trim();

  if (region) payload.region = region;
  if (city) payload.city = city;
  if (address) payload.address = address;
  if (postalCode) payload.postalCode = postalCode;
  if (publicEmail) payload.publicEmail = publicEmail;
  if (website) payload.website = website;

  return payload;
}

const VALIDATION_FIELD_ORDER = [
  "name",
  "categories",
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

const FIELD_SCROLL_ID: Record<string, string> = {
  name: "supplier-name",
  categories: "supplier-categories",
  country: "supplier-country",
  region: "supplier-region",
  city: "supplier-city",
  address: "supplier-address",
  postalCode: "supplier-postal",
  accountEmail: "supplier-account-email",
  publicEmail: "supplier-public-email",
  phone: "supplier-phone",
  website: "supplier-website",
};

function scrollToFirstFieldError(errors: Record<string, string>) {
  if (typeof document === "undefined") return;
  for (const key of VALIDATION_FIELD_ORDER) {
    if (!errors[key]) continue;
    const id = FIELD_SCROLL_ID[key];
    if (!id) continue;
    const el = document.getElementById(id);
    if (!el) continue;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLButtonElement
    ) {
      el.focus({ preventScroll: true });
    }
    break;
  }
}

function parseBackendErrorsObject(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) {
      out[k] = v.trim();
      continue;
    }
    if (Array.isArray(v)) {
      const first = v.find((x) => typeof x === "string" && String(x).trim());
      if (first) out[k] = String(first).trim();
      continue;
    }
    if (v && typeof v === "object" && "message" in v) {
      const m = (v as { message?: unknown }).message;
      if (typeof m === "string" && m.trim()) out[k] = m.trim();
    }
  }
  return out;
}

function resolveApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return "http://localhost:5000";
  }

  return "https://ecommerce-web-avec-tailwind.onrender.com";
}

export default function SupplierForm() {
  const { t } = useTranslation();
  const API_URL = resolveApiBaseUrl();

  const [form, setForm] = useState<FormState>(initialForm);
  const [categories, setCategories] = useState<Category[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  function validateForm(
    values: FormState,
    selectedCategories: Category[]
  ): Record<string, string> {
    const errors: Record<string, string> = {};
    const name = values.name.trim();
    const country = values.country.trim();
    const accountEmail = values.accountEmail.trim();
    const phone = values.phone.trim();
    const publicEmail = values.publicEmail.trim();
    const website = values.website.trim();
    const safeCategories = normalizeCategoryValues(selectedCategories);

    if (!name) {
      errors.name = t("suppliers.validation.nameRequired");
    } else if (name.length < 2) {
      errors.name = t("suppliers.validation.nameMin");
    }

    if (safeCategories.length === 0) {
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
  }

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const update =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
      clearFieldError(key);
      setServerMessage(null);
      setSuccess(false);
    };

  const toggleCategory = (value: Category) => {
    if (!ALLOWED_CATEGORY_VALUES.has(value)) return;
    setCategories((prev) => {
      const safe = normalizeCategoryValues(prev);
      if (safe.includes(value)) {
        return safe.filter((v) => v !== value);
      }
      return Array.from(new Set([...safe, value]));
    });
    clearFieldError("categories");
    setServerMessage(null);
    setSuccess(false);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || submitLockRef.current) return;

    setServerMessage(null);
    setSuccess(false);

    const errors = validateForm(form, categories);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      queueMicrotask(() => scrollToFirstFieldError(errors));
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    submitLockRef.current = true;

    try {
      const res = await fetch(`${API_URL}/api/suppliers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(buildPayload(form, categories)),
      });

      let data: {
        message?: unknown;
        error?: unknown;
        errors?: unknown;
      } = {};
      try {
        data = await res.json();
      } catch {
        /* corps absent ou non JSON */
      }

      if (res.ok) {
        setSuccess(true);
        setForm(initialForm);
        setCategories([]);
        setServerMessage(null);
        return;
      }

      const mapped = parseBackendErrorsObject(data.errors);
      const errStr =
        typeof data.error === "string" && data.error.trim()
          ? data.error.trim()
          : "";
      const msgStr =
        typeof data.message === "string" && data.message.trim()
          ? data.message.trim()
          : "";

      if (Object.keys(mapped).length > 0) {
        setFieldErrors(mapped);
        setServerMessage(
          errStr || msgStr || t("suppliers.validation.fixFields")
        );
        queueMicrotask(() => scrollToFirstFieldError(mapped));
      } else {
        setServerMessage(
          errStr ||
            msgStr ||
            (res.status >= 500
              ? t("suppliers.validation.serverError")
              : res.status === 400
                ? t("suppliers.validation.invalidPayload")
                : t("suppliers.validation.createFailed"))
        );
      }
    } catch {
      setServerMessage(t("suppliers.validation.networkError"));
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  }

  const labelClass = "block text-sm font-semibold text-slate-700 mb-2";
  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-sawaka-500 focus:outline-none focus:ring-2 focus:ring-sawaka-500/25";

  return (
    <form
      data-testid="supplier-form"
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200/90 bg-white shadow-soft"
    >
      <div className="p-6 sm:p-8 lg:p-10 space-y-8">
        {success && (
          <div
            data-testid="supplier-success"
            className="rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-4 py-3.5 text-sm font-medium text-emerald-900 shadow-sm"
            role="status"
          >
            {t("suppliers.success")}
          </div>
        )}

        {serverMessage && (
          <div
            className="rounded-xl border border-red-200/90 bg-red-50 px-4 py-3.5 text-sm font-medium text-red-900 shadow-sm"
            role="alert"
          >
            {serverMessage}
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <h2
            data-testid="supplier-form-title"
            className="text-2xl font-bold tracking-tight text-slate-900"
          >
            {t("suppliers.formTitle")}
          </h2>
          <div
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600"
            aria-hidden
          >
            <Globe className="h-4 w-4 text-slate-500" strokeWidth={1.75} />
            <span>EN | FR</span>
          </div>
        </div>

        <div className="h-px bg-slate-100" aria-hidden />

        {/* General Information */}
        <section className="space-y-6">
          <h3 className="text-lg font-semibold text-slate-900">
            {t("suppliers.sectionGeneral")}
          </h3>

          <div className="space-y-2">
            <label htmlFor="supplier-name" className={labelClass}>
              {t("suppliers.name")} <span className="text-red-600">*</span>
            </label>
            <input
              id="supplier-name"
              data-testid="supplier-input-name"
              name="name"
              value={form.name}
              onChange={update("name")}
              autoComplete="organization"
              placeholder={t("suppliers.namePlaceholder")}
              className={inputClass}
              aria-invalid={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? "err-name" : undefined}
            />
            {fieldErrors.name && (
              <p
                id="err-name"
                data-testid="supplier-error-name"
                className="mt-1.5 text-sm font-medium text-red-600"
              >
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <span className={`${labelClass} mb-0`}>
              {t("suppliers.categorySingle")}{" "}
              <span className="text-red-600">*</span>
            </span>
            <div
              id="supplier-categories"
              className="flex flex-wrap gap-2.5"
              role="group"
              aria-label={t("suppliers.categoriesAria")}
              aria-invalid={!!fieldErrors.categories}
              aria-describedby={
                fieldErrors.categories ? "err-categories" : undefined
              }
            >
              {SUPPLIER_CATEGORY_OPTIONS.map((opt) => {
                const selected = categories.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    data-testid={`supplier-category-${opt.value}`}
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
            {fieldErrors.categories && (
              <p
                id="err-categories"
                data-testid="supplier-error-categories"
                className="mt-1.5 text-sm font-medium text-red-600"
              >
                {fieldErrors.categories}
              </p>
            )}
          </div>
        </section>

        <div className="h-px bg-slate-100" aria-hidden />

        {/* Location */}
        <section className="space-y-6">
          <h3 className="text-lg font-semibold text-slate-900">{t("suppliers.sectionLocation")}</h3>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="supplier-country" className={labelClass}>
                {t("suppliers.country")} <span className="text-red-600">*</span>
              </label>
              <input
                id="supplier-country"
                data-testid="supplier-input-country"
                name="country"
                value={form.country}
                onChange={update("country")}
                autoComplete="country-name"
                placeholder={t("suppliers.country")}
                className={inputClass}
                aria-invalid={!!fieldErrors.country}
                aria-describedby={
                  fieldErrors.country ? "err-country" : undefined
                }
              />
              {fieldErrors.country && (
                <p
                  id="err-country"
                  data-testid="supplier-error-country"
                  className="mt-1.5 text-sm font-medium text-red-600"
                >
                  {fieldErrors.country}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="supplier-region" className={labelClass}>
                {t("suppliers.region")}
              </label>
              <input
                id="supplier-region"
                name="region"
                value={form.region}
                onChange={update("region")}
                placeholder={t("suppliers.region")}
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="supplier-city" className={labelClass}>
                {t("suppliers.city")}
              </label>
              <input
                id="supplier-city"
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
              <label htmlFor="supplier-address" className={labelClass}>
                {t("suppliers.address")}
              </label>
              <textarea
                id="supplier-address"
                name="address"
                value={form.address}
                onChange={update("address")}
                rows={3}
                placeholder={t("suppliers.addressPlaceholder")}
                className={`${inputClass} resize-y min-h-[5.5rem]`}
              />
            </div>

            <div className="max-w-full space-y-2 md:max-w-xs">
              <label htmlFor="supplier-postal" className={labelClass}>
                {t("suppliers.postalCode")}
              </label>
              <input
                id="supplier-postal"
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

        {/* Account Access */}
        <section className="space-y-6">
          <h3 className="text-lg font-semibold text-slate-900">
            {t("suppliers.sectionAccount")}
          </h3>

          <div className="space-y-2">
            <label htmlFor="supplier-account-email" className={labelClass}>
              {t("suppliers.accountEmail")}{" "}
              <span className="text-red-600">*</span>
            </label>
            <input
              id="supplier-account-email"
              data-testid="supplier-input-account-email"
              type="email"
              name="accountEmail"
              value={form.accountEmail}
              onChange={update("accountEmail")}
              autoComplete="email"
              placeholder={t("suppliers.accountEmailPlaceholder")}
              className={inputClass}
              aria-invalid={!!fieldErrors.accountEmail}
              aria-describedby={
                fieldErrors.accountEmail ? "err-accountEmail" : undefined
              }
            />
            {fieldErrors.accountEmail && (
              <p
                id="err-accountEmail"
                data-testid="supplier-error-account-email"
                className="mt-1.5 text-sm font-medium text-red-600"
              >
                {fieldErrors.accountEmail}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                <Lock className="h-3.5 w-3.5" strokeWidth={2} />
                {t("suppliers.privateBadge")}
              </span>
              <p className="text-xs text-slate-500">
                {t("suppliers.privateHint")}
              </p>
            </div>
          </div>
        </section>

        <div className="h-px bg-slate-100" aria-hidden />

        {/* Public Contact Information */}
        <section className="space-y-6">
          <h3 className="text-lg font-semibold text-slate-900">
            {t("suppliers.sectionContact")}
          </h3>

          <div className="space-y-2">
            <label htmlFor="supplier-public-email" className={labelClass}>
              {t("suppliers.publicEmail")}
            </label>
            <input
              id="supplier-public-email"
              type="email"
              name="publicEmail"
              value={form.publicEmail}
              onChange={update("publicEmail")}
              placeholder={t("suppliers.publicEmailPlaceholder")}
              className={inputClass}
              aria-invalid={!!fieldErrors.publicEmail}
              aria-describedby={
                fieldErrors.publicEmail ? "err-publicEmail" : undefined
              }
            />
            {fieldErrors.publicEmail && (
              <p id="err-publicEmail" className="mt-1.5 text-sm font-medium text-red-600">
                {fieldErrors.publicEmail}
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
            <label htmlFor="supplier-phone" className={labelClass}>
              {t("suppliers.phone")} <span className="text-red-600">*</span>
            </label>
            <input
              id="supplier-phone"
              data-testid="supplier-input-phone"
              type="tel"
              name="phone"
              value={form.phone}
              onChange={update("phone")}
              autoComplete="tel"
              placeholder={t("suppliers.phonePlaceholder")}
              className={inputClass}
              aria-invalid={!!fieldErrors.phone}
              aria-describedby={fieldErrors.phone ? "err-phone" : undefined}
            />
            {fieldErrors.phone && (
              <p
                id="err-phone"
                data-testid="supplier-error-phone"
                className="mt-1.5 text-sm font-medium text-red-600"
              >
                {fieldErrors.phone}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="supplier-website" className={labelClass}>
              {t("suppliers.website")}
            </label>
            <input
              id="supplier-website"
              type="text"
              name="website"
              placeholder={t("suppliers.websitePlaceholder")}
              value={form.website}
              onChange={update("website")}
              className={inputClass}
              aria-invalid={!!fieldErrors.website}
              aria-describedby={
                fieldErrors.website ? "err-website" : undefined
              }
            />
            {fieldErrors.website && (
              <p id="err-website" className="mt-1.5 text-sm font-medium text-red-600">
                {fieldErrors.website}
              </p>
            )}
          </div>
        </section>

        <div className="pt-2">
          <button
            type="submit"
            data-testid="supplier-submit"
            disabled={submitting}
            className="btn btn-primary w-full min-h-[48px] rounded-xl px-6 py-3 text-base font-semibold shadow-sm disabled:pointer-events-none disabled:opacity-50 sm:w-auto sm:min-w-[220px]"
          >
            {submitting ? t("suppliers.submitting") : t("suppliers.submit")}
          </button>
        </div>
      </div>
    </form>
  );
}
