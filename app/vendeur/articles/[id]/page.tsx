"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { listContributorDomains, taxonomyLabel, type TaxonomyItem } from "../../../lib/apiContributors";
import { readStoredUser } from "../../../lib/authUser";
import {
  isOwnerEditFailure,
  loadOwnedRealization,
  updateOwnedRealization,
  type PortfolioRealization,
} from "../../../lib/portfolioRealizations";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Phase = "loading" | "ready" | "error" | "not-found" | "signed-out";

type FieldName = "title" | "description" | "domainId" | "completedOn" | "mainMaterial";

type FieldError = { field: FieldName; message: string };

function fieldName(value: string | undefined): FieldName | null {
  if (
    value === "title" ||
    value === "description" ||
    value === "domainId" ||
    value === "completedOn" ||
    value === "mainMaterial"
  ) {
    return value;
  }
  return null;
}

export default function EditRealizationPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const rawId = params?.id;
  const id = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] || "" : "";
  const [phase, setPhase] = useState<Phase>("loading");
  const [reloadToken, setReloadToken] = useState(0);
  const [item, setItem] = useState<PortfolioRealization | null>(null);
  const [domains, setDomains] = useState<TaxonomyItem[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [domainId, setDomainId] = useState("");
  const [completedOn, setCompletedOn] = useState("");
  const [mainMaterial, setMainMaterial] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<FieldError | null>(null);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const user = readStoredUser();
    if (!user || !id) {
      setPhase(id ? "signed-out" : "not-found");
      setItem(null);
      return;
    }
    setPhase("loading");
    loadOwnedRealization(id).then((result) => {
      if (cancelled) return;
      if (!isOwnerEditFailure(result)) {
        setItem(result.item);
        setTitle(result.item.title);
        setDescription(result.item.description);
        setDomainId(result.item.domainId || "");
        setCompletedOn(result.item.completedOn || "");
        setMainMaterial(result.item.mainMaterial);
        setFieldError(null);
        setFormError("");
        setPhase("ready");
        return;
      }
      setItem(null);
      setPhase(result.status === 401 ? "signed-out" : result.status === 404 ? "not-found" : "error");
    });
    listContributorDomains().then((result) => {
      if (!cancelled && result.ok) setDomains(result.domains);
    });
    return () => {
      cancelled = true;
    };
  }, [id, reloadToken]);

  function messageFor(code: string): string {
    const key: Record<string, string> = {
      TITLE_TOO_LONG: "portfolio.editor.titleTooLong",
      TITLE_INVALID: "portfolio.editor.titleInvalid",
      DESCRIPTION_TOO_LONG: "portfolio.editor.descriptionTooLong",
      DESCRIPTION_INVALID: "portfolio.editor.descriptionInvalid",
      DATE_INVALID: "portfolio.editor.dateInvalid",
      MATERIAL_TOO_LONG: "portfolio.editor.materialTooLong",
      MATERIAL_INVALID: "portfolio.editor.materialInvalid",
      DOMAIN_INVALID: "portfolio.editor.domainInvalid",
      FIELD_NOT_ALLOWED: "portfolio.editor.fieldNotAllowed",
      REQUIRED: "portfolio.editor.saveFailed",
    };
    return t(key[code] || "portfolio.editor.saveFailed");
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!item || saving) return;
    setSaving(true);
    setFieldError(null);
    setFormError("");
    const result = await updateOwnedRealization(item.id, {
      title,
      description,
      domainId: domainId || null,
      completedOn: completedOn || null,
      mainMaterial,
    });
    setSaving(false);
    if (isOwnerEditFailure(result)) {
      const named = fieldName(result.field);
      if (named && result.fieldCode) {
        setFieldError({ field: named, message: messageFor(result.fieldCode) });
        return;
      }
      if (result.status === 404) {
        setPhase("not-found");
        setItem(null);
        return;
      }
      setFormError(messageFor(result.code));
      return;
    }
    router.push("/vendeur/articles");
  }

  const inputClass = `h-11 w-full min-w-0 rounded-lg border border-border bg-card px-3 text-sm ${focusRing}`;

  return (
    <div className="wrap py-8" data-testid="portfolio-edit-page">
      <Link
        href="/vendeur/articles"
        data-testid="portfolio-edit-back"
        className={`inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-foreground ${focusRing}`}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        {t("portfolio.editor.back")}
      </Link>

      <h1 className="mt-4 font-display text-3xl text-foreground lg:text-4xl">{t("portfolio.editor.heading")}</h1>

      {phase === "loading" ? (
        <p data-testid="portfolio-edit-loading" role="status" className="mt-8 text-sm text-muted-foreground">
          {t("portfolio.editor.loading")}
        </p>
      ) : null}

      {phase === "error" ? (
        <div data-testid="portfolio-edit-error" role="alert" className="mt-8 rounded-xl border border-border bg-card px-6 py-12 text-center">
          <p className="text-base text-foreground">{t("portfolio.editor.loadError")}</p>
          <button
            type="button"
            data-testid="portfolio-edit-retry"
            className={`mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ${focusRing}`}
            onClick={() => setReloadToken((current) => current + 1)}
          >
            {t("portfolio.editor.retry")}
          </button>
        </div>
      ) : null}

      {phase === "not-found" ? (
        <div data-testid="portfolio-edit-not-found" role="status" className="mt-8 rounded-xl border border-border bg-card px-6 py-12 text-center">
          <p className="text-base text-foreground">{t("portfolio.editor.notFound")}</p>
          <Link
            href="/vendeur/articles"
            className={`mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ${focusRing}`}
          >
            {t("portfolio.editor.back")}
          </Link>
        </div>
      ) : null}

      {phase === "signed-out" ? (
        <div data-testid="portfolio-edit-signed-out" className="mt-8 rounded-xl border border-border bg-card px-6 py-12 text-center">
          <p className="text-base text-foreground">{t("portfolio.signedOut")}</p>
          <Link
            href={`/login?redirect=/vendeur/articles/${encodeURIComponent(id)}`}
            className={`mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ${focusRing}`}
          >
            {t("portfolio.signIn")}
          </Link>
        </div>
      ) : null}

      {phase === "ready" && item ? (
        <form className="mt-8 max-w-2xl" onSubmit={onSubmit} noValidate>
          <p
            data-testid="portfolio-edit-status"
            data-status={item.status}
            className="text-sm text-foreground"
          >
            <span
              className={`mr-2 inline-block h-2 w-2 rounded-full ${
                item.status === "published" ? "bg-emerald-600" : "bg-amber-700"
              }`}
              aria-hidden
            />
            {item.status === "published" ? t("portfolio.statusPublished") : t("portfolio.statusDraft")}
          </p>

          <section className="mt-6" data-testid="portfolio-edit-images" aria-label={t("portfolio.editor.images")}>
            <h2 className="text-sm font-medium text-foreground">{t("portfolio.editor.images")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("portfolio.editor.imagesReadOnly")}</p>
            {item.imageUrls.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{t("portfolio.editor.noImages")}</p>
            ) : (
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {item.imageUrls.map((url, index) => (
                  <li key={`${url}-${index}`} className="overflow-hidden rounded-xl bg-secondary">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={t("realizationDetail.photoAlt", { index: index + 1, total: item.imageUrls.length })}
                      data-testid="portfolio-edit-photo"
                      className="aspect-[4/3] w-full object-cover"
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="mt-6 flex flex-col gap-5">
            <div>
              <label htmlFor="portfolio-edit-title" className="text-sm font-medium text-foreground">
                {t("portfolio.editor.title")}
              </label>
              <input
                id="portfolio-edit-title"
                data-testid="portfolio-edit-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                aria-invalid={fieldError?.field === "title" ? true : undefined}
                aria-describedby={fieldError?.field === "title" ? "portfolio-edit-field-error" : undefined}
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label htmlFor="portfolio-edit-description" className="text-sm font-medium text-foreground">
                {t("portfolio.editor.description")}
              </label>
              <textarea
                id="portfolio-edit-description"
                data-testid="portfolio-edit-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={6}
                aria-invalid={fieldError?.field === "description" ? true : undefined}
                aria-describedby={fieldError?.field === "description" ? "portfolio-edit-field-error" : undefined}
                className={`mt-2 min-h-[8rem] w-full min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-sm ${focusRing}`}
              />
            </div>
            <div>
              <label htmlFor="portfolio-edit-domain" className="text-sm font-medium text-foreground">
                {t("portfolio.editor.domain")}
              </label>
              <select
                id="portfolio-edit-domain"
                data-testid="portfolio-edit-domain"
                value={domainId}
                onChange={(event) => setDomainId(event.target.value)}
                aria-invalid={fieldError?.field === "domainId" ? true : undefined}
                aria-describedby={fieldError?.field === "domainId" ? "portfolio-edit-field-error" : undefined}
                className={`mt-2 ${inputClass}`}
              >
                <option value="">{t("portfolio.editor.domainEmpty")}</option>
                {domainId && !domains.some((domain) => domain.id === domainId) ? (
                  <option value={domainId}>{domainId}</option>
                ) : null}
                {domains.map((domain) => (
                  <option key={domain.id} value={domain.id}>
                    {taxonomyLabel(domain, locale)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="portfolio-edit-completed" className="text-sm font-medium text-foreground">
                {t("portfolio.editor.completedOn")}
              </label>
              <input
                id="portfolio-edit-completed"
                data-testid="portfolio-edit-completed"
                type="date"
                value={completedOn}
                onChange={(event) => setCompletedOn(event.target.value)}
                aria-invalid={fieldError?.field === "completedOn" ? true : undefined}
                aria-describedby={fieldError?.field === "completedOn" ? "portfolio-edit-field-error" : undefined}
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label htmlFor="portfolio-edit-material" className="text-sm font-medium text-foreground">
                {t("portfolio.editor.material")}
              </label>
              <input
                id="portfolio-edit-material"
                data-testid="portfolio-edit-material"
                value={mainMaterial}
                onChange={(event) => setMainMaterial(event.target.value)}
                aria-invalid={fieldError?.field === "mainMaterial" ? true : undefined}
                aria-describedby={fieldError?.field === "mainMaterial" ? "portfolio-edit-field-error" : undefined}
                className={`mt-2 ${inputClass}`}
              />
            </div>
          </div>

          {fieldError ? (
            <p id="portfolio-edit-field-error" role="alert" data-testid="portfolio-edit-field-error" className="field-error mt-4">
              {fieldError.message}
            </p>
          ) : null}
          {formError ? (
            <p role="alert" data-testid="portfolio-edit-save-error" className="field-error mt-4">
              {formError}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
            <Link
              href="/vendeur/articles"
              data-testid="portfolio-edit-cancel"
              className={`inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground ${focusRing}`}
            >
              {t("portfolio.editor.cancel")}
            </Link>
            <button
              type="submit"
              data-testid="portfolio-edit-save"
              disabled={saving}
              aria-busy={saving}
              className={`inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ${focusRing} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {saving ? t("portfolio.editor.saving") : t("portfolio.editor.save")}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
