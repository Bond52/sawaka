"use client";

import { Globe, Lock } from "lucide-react";
import { useRef, useState } from "react";

export const SUPPLIER_CATEGORY_OPTIONS = [
  { label: "Construction Materials", value: "construction_materials" },
  { label: "Wood & Lumber", value: "wood_lumber" },
  { label: "Metal & Steel", value: "metal_steel" },
  { label: "Electrical Supplies", value: "electrical_supplies" },
  { label: "Plumbing Supplies", value: "plumbing_supplies" },
  { label: "Paints & Finishes", value: "paints_finishes" },
  { label: "Hardware & Fasteners", value: "hardware_fasteners" },
  { label: "Hand Tools", value: "hand_tools" },
  { label: "Power Tools", value: "power_tools" },
  { label: "Industrial Machinery", value: "industrial_machinery" },
  { label: "Safety Equipment (PPE)", value: "safety_equipment" },
  { label: "Textiles & Fabrics", value: "textiles_fabrics" },
  { label: "Leather & Accessories", value: "leather_accessories" },
  { label: "Art & Craft Materials", value: "art_craft_materials" },
  { label: "Agro Raw Materials", value: "agro_raw_materials" },
  { label: "Food Processing Equipment", value: "food_processing_equipment" },
  { label: "Packaging & Containers", value: "packaging_containers" },
  { label: "Equipment Rental", value: "equipment_rental" },
  { label: "Transport & Logistics", value: "transport_logistics" },
  {
    label: "Import / Wholesale Distribution",
    value: "import_wholesale_distribution",
  },
] as const;

const ALLOWED_CATEGORY_VALUES = new Set(
  SUPPLIER_CATEGORY_OPTIONS.map((o) => o.value)
);

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

function normalizeCategoryValues(selected: string[]): string[] {
  const asArray = Array.isArray(selected) ? selected : [];
  const filtered = asArray.filter(
    (v): v is string =>
      typeof v === "string" && ALLOWED_CATEGORY_VALUES.has(v)
  );
  return Array.from(new Set(filtered));
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
  const API_URL = resolveApiBaseUrl();

  const [form, setForm] = useState<FormState>(initialForm);
  const [categories, setCategories] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  function validateForm(values: FormState): Record<string, string> {
    const errors: Record<string, string> = {};
    const name = values.name.trim();
    const country = values.country.trim();
    const accountEmail = values.accountEmail.trim();
    const phone = values.phone.trim();
    const publicEmail = values.publicEmail.trim();
    const website = values.website.trim();

    if (!name) {
      errors.name = "Indiquez le nom du fournisseur (champ obligatoire).";
    } else if (name.length < 2) {
      errors.name = "Le nom doit contenir au moins 2 caractères.";
    }

    if (!country) {
      errors.country = "Indiquez le pays (champ obligatoire).";
    }

    if (!accountEmail) {
      errors.accountEmail =
        "Indiquez l’e-mail du compte (champ obligatoire).";
    } else if (!isValidEmail(accountEmail)) {
      errors.accountEmail =
        "L’e-mail du compte n’est pas valide (ex. : contact@entreprise.com).";
    }

    if (publicEmail && !isValidEmail(publicEmail)) {
      errors.publicEmail =
        "L’e-mail public n’est pas valide (ex. : info@entreprise.com).";
    }

    if (!phone) {
      errors.phone = "Indiquez un numéro de téléphone (champ obligatoire).";
    } else if (phone.length < 6) {
      errors.phone =
        "Le téléphone doit contenir au moins 6 caractères (chiffres ou format local).";
    }

    if (!isValidOptionalUrl(website)) {
      errors.website =
        "L’adresse du site web n’est pas valide (ex. : https://exemple.com).";
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

  const toggleCategory = (value: string) => {
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

    const errors = validateForm(form);
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
          errStr || msgStr || "Certains champs sont incorrects. Corrigez-les puis réessayez."
        );
        queueMicrotask(() => scrollToFirstFieldError(mapped));
      } else {
        setServerMessage(
          errStr ||
            msgStr ||
            (res.status >= 500
              ? "Le serveur rencontre un problème. Réessayez dans quelques instants."
              : res.status === 400
                ? "Les informations envoyées sont invalides ou incomplètes."
                : "La création du profil fournisseur a échoué. Réessayez ou contactez le support.")
        );
      }
    } catch {
      setServerMessage(
        "Connexion impossible. Vérifiez votre réseau et réessayez."
      );
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
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200/90 bg-white shadow-soft"
    >
      <div className="p-6 sm:p-8 lg:p-10 space-y-8">
        {success && (
          <div
            className="rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-4 py-3.5 text-sm font-medium text-emerald-900 shadow-sm"
            role="status"
          >
            Supplier profile created. Please check your email to complete
            activation.
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
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Create Your Supplier Profile
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
            General Information
          </h3>

          <div className="space-y-2">
            <label htmlFor="supplier-name" className={labelClass}>
              Supplier Name <span className="text-red-600">*</span>
            </label>
            <input
              id="supplier-name"
              name="name"
              value={form.name}
              onChange={update("name")}
              autoComplete="organization"
              placeholder="Enter supplier name"
              className={inputClass}
              aria-invalid={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? "err-name" : undefined}
            />
            {fieldErrors.name && (
              <p id="err-name" className="mt-1.5 text-sm font-medium text-red-600">
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <span className={`${labelClass} mb-0`}>Category</span>
            <div
              id="supplier-categories"
              className="flex flex-wrap gap-2.5"
              role="group"
              aria-label="Categories"
            >
              {SUPPLIER_CATEGORY_OPTIONS.map((opt) => {
                const selected = categories.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleCategory(opt.value)}
                    className={[
                      "rounded-full border px-3.5 py-2 text-xs font-medium transition-all md:text-[13px]",
                      selected
                        ? "border-sawaka-600 bg-sawaka-50 text-sawaka-900 shadow-sm ring-1 ring-sawaka-600/20"
                        : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {fieldErrors.categories && (
              <p className="mt-1.5 text-sm font-medium text-red-600">
                {fieldErrors.categories}
              </p>
            )}
          </div>
        </section>

        <div className="h-px bg-slate-100" aria-hidden />

        {/* Location */}
        <section className="space-y-6">
          <h3 className="text-lg font-semibold text-slate-900">Location</h3>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="supplier-country" className={labelClass}>
                Country <span className="text-red-600">*</span>
              </label>
              <input
                id="supplier-country"
                name="country"
                value={form.country}
                onChange={update("country")}
                autoComplete="country-name"
                placeholder="Country"
                className={inputClass}
                aria-invalid={!!fieldErrors.country}
                aria-describedby={
                  fieldErrors.country ? "err-country" : undefined
                }
              />
              {fieldErrors.country && (
                <p id="err-country" className="mt-1.5 text-sm font-medium text-red-600">
                  {fieldErrors.country}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="supplier-region" className={labelClass}>
                Region
              </label>
              <input
                id="supplier-region"
                name="region"
                value={form.region}
                onChange={update("region")}
                placeholder="Region"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="supplier-city" className={labelClass}>
                City
              </label>
              <input
                id="supplier-city"
                name="city"
                value={form.city}
                onChange={update("city")}
                autoComplete="address-level2"
                placeholder="City"
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="supplier-address" className={labelClass}>
                Physical Address
              </label>
              <textarea
                id="supplier-address"
                name="address"
                value={form.address}
                onChange={update("address")}
                rows={3}
                placeholder="Street number and name"
                className={`${inputClass} resize-y min-h-[5.5rem]`}
              />
            </div>

            <div className="max-w-full space-y-2 md:max-w-xs">
              <label htmlFor="supplier-postal" className={labelClass}>
                Postal Code
              </label>
              <input
                id="supplier-postal"
                name="postalCode"
                value={form.postalCode}
                onChange={update("postalCode")}
                autoComplete="postal-code"
                placeholder="Postal code"
                className={inputClass}
              />
            </div>
          </div>
        </section>

        <div className="h-px bg-slate-100" aria-hidden />

        {/* Account Access */}
        <section className="space-y-6">
          <h3 className="text-lg font-semibold text-slate-900">
            Account Access
          </h3>

          <div className="space-y-2">
            <label htmlFor="supplier-account-email" className={labelClass}>
              Email for account access{" "}
              <span className="text-red-600">*</span>
            </label>
            <input
              id="supplier-account-email"
              type="email"
              name="accountEmail"
              value={form.accountEmail}
              onChange={update("accountEmail")}
              autoComplete="email"
              placeholder="example@domain.com"
              className={inputClass}
              aria-invalid={!!fieldErrors.accountEmail}
              aria-describedby={
                fieldErrors.accountEmail ? "err-accountEmail" : undefined
              }
            />
            {fieldErrors.accountEmail && (
              <p id="err-accountEmail" className="mt-1.5 text-sm font-medium text-red-600">
                {fieldErrors.accountEmail}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                <Lock className="h-3.5 w-3.5" strokeWidth={2} />
                Private
              </span>
              <p className="text-xs text-slate-500">
                Used only for login and account management. Not displayed
                publicly.
              </p>
            </div>
          </div>
        </section>

        <div className="h-px bg-slate-100" aria-hidden />

        {/* Public Contact Information */}
        <section className="space-y-6">
          <h3 className="text-lg font-semibold text-slate-900">
            Public Contact Information
          </h3>

          <div className="space-y-2">
            <label htmlFor="supplier-public-email" className={labelClass}>
              Public contact email
            </label>
            <input
              id="supplier-public-email"
              type="email"
              name="publicEmail"
              value={form.publicEmail}
              onChange={update("publicEmail")}
              placeholder="contact@company.com"
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
                Public
              </span>
              <p className="text-xs text-slate-500">
                Displayed on your supplier profile.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="supplier-phone" className={labelClass}>
              Phone number <span className="text-red-600">*</span>
            </label>
            <input
              id="supplier-phone"
              type="tel"
              name="phone"
              value={form.phone}
              onChange={update("phone")}
              autoComplete="tel"
              placeholder="+237 6XX XXX XXX"
              className={inputClass}
              aria-invalid={!!fieldErrors.phone}
              aria-describedby={fieldErrors.phone ? "err-phone" : undefined}
            />
            {fieldErrors.phone && (
              <p id="err-phone" className="mt-1.5 text-sm font-medium text-red-600">
                {fieldErrors.phone}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="supplier-website" className={labelClass}>
              Website
            </label>
            <input
              id="supplier-website"
              type="text"
              name="website"
              placeholder="https://example.com"
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
            disabled={submitting}
            className="btn btn-primary w-full min-h-[48px] rounded-xl px-6 py-3 text-base font-semibold shadow-sm disabled:pointer-events-none disabled:opacity-50 sm:w-auto sm:min-w-[220px]"
          >
            {submitting ? "Envoi en cours…" : "Créer le profil fournisseur"}
          </button>
        </div>
      </div>
    </form>
  );
}
