"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createPortal } from "react-dom";
import { Camera, ChevronLeft, ChevronRight, MapPin, MessageCircle, UserRound, X } from "lucide-react";
import { taxonomyLabel } from "@/app/lib/apiContributors";
import {
  formatCompletedMonth,
  loadRealizationDetail,
  type RealizationContributor,
  type RealizationDetail,
  type TaxonomyName,
} from "@/app/lib/realizationDetail";
import { useTranslation } from "@/src/i18n/I18nProvider";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Phase = "loading" | "ready" | "error" | "not-found";

function labelOf(item: TaxonomyName | null, locale: string): string {
  if (!item) return "";
  return taxonomyLabel(item, locale);
}

function placeOf(person: RealizationContributor): string {
  return [person.city, person.region, person.country].map((part) => part.trim()).filter(Boolean).join(", ");
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part.slice(0, 1).toUpperCase());
  return letters.join("") || "?";
}

function Gallery({ urls }: { urls: string[] }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<number | null>(null);
  const count = urls.length;
  const safeIndex = Math.min(index, Math.max(count - 1, 0));
  const current = urls[safeIndex] ?? "";

  useEffect(() => {
    if (!open) return;
    const opener = openerRef.current;
    const dialog = dialogRef.current;
    const inerted: HTMLElement[] = [];
    for (const node of Array.from(document.body.children)) {
      if (!(node instanceof HTMLElement)) continue;
      if (dialog && (node === dialog || node.contains(dialog))) continue;
      if (node.hasAttribute("inert")) continue;
      node.setAttribute("inert", "");
      inerted.push(node);
    }
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    closeRef.current?.focus();
    function focusableControls(): HTMLElement[] {
      const root = dialogRef.current;
      if (!root) return [];
      return Array.from(root.querySelectorAll<HTMLElement>("button:not([disabled])"));
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (count > 1 && event.key === "ArrowRight") {
        event.preventDefault();
        setIndex((value) => (value + 1) % count);
      }
      if (count > 1 && event.key === "ArrowLeft") {
        event.preventDefault();
        setIndex((value) => (value - 1 + count) % count);
      }
      if (event.key !== "Tab") return;
      const controls = focusableControls();
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      const active = document.activeElement;
      if (controls.length === 1 || event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (!event.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
      inerted.forEach((node) => node.removeAttribute("inert"));
      opener?.focus();
    };
  }, [open, count]);

  function move(delta: number) {
    setIndex((value) => (value + delta + count) % count);
  }

  function onTouchStart(event: React.TouchEvent) {
    touchStart.current = event.changedTouches[0]?.clientX ?? null;
  }

  function onTouchEnd(event: React.TouchEvent) {
    if (touchStart.current === null || count < 2) return;
    const end = event.changedTouches[0]?.clientX ?? touchStart.current;
    const delta = end - touchStart.current;
    if (Math.abs(delta) > 40) move(delta < 0 ? 1 : -1);
    touchStart.current = null;
  }

  if (count === 0) return null;
  const extra = count > 4;
  const side = urls.slice(1, extra ? 3 : undefined);
  const viewAllImage = extra ? urls[3] : "";

  return (
    <div data-testid="realization-detail-gallery">
      <div className={`grid grid-cols-1 gap-3 ${count > 1 ? "md:grid-cols-[minmax(0,1.7fr)_minmax(220px,1fr)]" : ""}`}>
        <div className="relative min-h-[240px] overflow-hidden rounded-2xl bg-secondary md:min-h-[460px]">
          <button
            type="button"
            ref={openerRef}
            data-testid="realization-detail-open"
            className={`absolute inset-0 ${focusRing}`}
            onClick={() => setOpen(true)}
            onTouchStart={count > 1 ? onTouchStart : undefined}
            onTouchEnd={count > 1 ? onTouchEnd : undefined}
          >
            {/* Remote realization photos are not covered by a next/image pattern. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current}
              alt={t("realizationDetail.photoAlt", { index: safeIndex + 1, total: count })}
              className="h-full w-full object-cover"
              data-testid="realization-detail-hero"
            />
          </button>
        </div>
        {count > 1 ? (
          <div className="grid grid-cols-3 gap-3 md:grid-cols-2">
            {side.map((url, offset) => {
              const photoIndex = offset + 1;
              return (
                <button
                  key={url}
                  type="button"
                  data-testid="realization-detail-thumb"
                  aria-pressed={safeIndex === photoIndex}
                  className={`relative aspect-square overflow-hidden rounded-2xl bg-secondary ${focusRing} ${
                    safeIndex === photoIndex ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => setIndex(photoIndex)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={t("realizationDetail.photoAlt", { index: photoIndex + 1, total: count })}
                    className="h-full w-full object-cover"
                  />
                </button>
              );
            })}
            {extra ? (
              <button
                type="button"
                data-testid="realization-detail-view-all"
                className={`relative aspect-square overflow-hidden rounded-2xl ${focusRing}`}
                onClick={() => setOpen(true)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={viewAllImage} alt="" className="h-full w-full object-cover" />
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-foreground/70 px-3 text-center text-sm font-medium text-card">
                  <Camera className="h-5 w-5" aria-hidden />
                  {t("realizationDetail.viewAll", { count })}
                </span>
              </button>
            ) : (
              <button
                type="button"
                data-testid="realization-detail-view-all"
                className={`col-span-full min-h-[44px] rounded-2xl border border-border bg-card px-3 text-sm font-medium text-foreground md:col-span-2 ${focusRing}`}
                onClick={() => setOpen(true)}
              >
                {t("realizationDetail.viewAll", { count })}
              </button>
            )}
          </div>
        ) : null}
      </div>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label={t("realizationDetail.gallery")}
              data-testid="realization-detail-lightbox"
              className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 px-3 text-white sm:px-6"
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              <button
                type="button"
                ref={closeRef}
                data-testid="realization-detail-close"
                className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" aria-hidden />
                <span className="sr-only">{t("realizationDetail.close")}</span>
              </button>
              <div className="flex w-full max-w-6xl items-center justify-center gap-3 sm:gap-6">
                {count > 1 ? (
                  <button
                    type="button"
                    data-testid="realization-detail-previous"
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    onClick={() => move(-1)}
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden />
                    <span className="sr-only">{t("realizationDetail.previous")}</span>
                  </button>
                ) : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current}
                  alt={t("realizationDetail.photoAlt", { index: safeIndex + 1, total: count })}
                  className="max-h-[calc(100vh-8rem)] max-w-[calc(100vw-8.5rem)] object-contain"
                />
                {count > 1 ? (
                  <button
                    type="button"
                    data-testid="realization-detail-next"
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    onClick={() => move(1)}
                  >
                    <ChevronRight className="h-5 w-5" aria-hidden />
                    <span className="sr-only">{t("realizationDetail.next")}</span>
                  </button>
                ) : null}
              </div>
              <p
                data-testid="realization-detail-position"
                className="absolute bottom-5 left-1/2 -translate-x-1/2 text-sm font-medium text-white"
              >
                {t("realizationDetail.position", { index: safeIndex + 1, total: count })}
              </p>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function DetailView({ detail }: { detail: RealizationDetail }) {
  const { t, locale } = useTranslation();
  const unavailable = t("dashboard.actionUnavailable");
  const title = detail.title.trim();
  const description = detail.description.trim();
  const material = detail.mainMaterial.trim();
  const domain = labelOf(detail.domain, locale);
  const completed = detail.completedOn ? formatCompletedMonth(detail.completedOn, locale) : "";
  const contributorDomain = labelOf(detail.contributor.domain, locale);
  const place = placeOf(detail.contributor);
  const facts = [
    domain ? { key: "domain", label: t("realizationDetail.domain"), value: domain } : null,
    material ? { key: "material", label: t("realizationDetail.material"), value: material } : null,
    completed ? { key: "date", label: t("realizationDetail.completion"), value: completed } : null,
  ].filter((fact): fact is { key: string; label: string; value: string } => Boolean(fact));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {domain ? (
          <p
            className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
            data-testid="realization-detail-badge"
          >
            {domain}
          </p>
        ) : (
          <span />
        )}
        {detail.imageUrls.length > 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="realization-detail-count">
            {t(detail.imageUrls.length === 1 ? "realizationDetail.imageCountOne" : "realizationDetail.imageCount", {
              count: detail.imageUrls.length,
            })}
          </p>
        ) : null}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <h1 className="break-words font-display text-4xl text-foreground" data-testid="realization-detail-heading">
            {title || t("realizationDetail.title")}
          </h1>
          {completed ? (
            <p className="mt-3 text-sm text-muted-foreground" data-testid="realization-detail-date">
              {t("realizationDetail.completedIn", { date: completed })}
            </p>
          ) : null}
          {description ? (
            <section className="mt-8 border-t border-border pt-6" aria-labelledby="realization-about">
              <h2 id="realization-about" className="font-display text-2xl text-foreground">
                {t("realizationDetail.about")}
              </h2>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm text-foreground" data-testid="realization-detail-description">
                {description}
              </p>
            </section>
          ) : null}
          {facts.length > 0 ? (
            <dl className="mt-8 grid grid-cols-1 gap-4 border-t border-border pt-6 sm:grid-cols-3">
              {facts.map((fact) => (
                <div key={fact.key}>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">{fact.label}</dt>
                  <dd
                    className="mt-1 text-sm font-medium text-foreground"
                    data-testid={`realization-detail-fact-${fact.key}`}
                  >
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        <aside className="h-fit rounded-2xl border border-border bg-secondary/40 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">
            {t("realizationDetail.createdBy")}
          </p>
          <div className="mt-4 flex items-center gap-3">
            {detail.contributor.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={detail.contributor.photoUrl}
                alt={detail.contributor.displayName}
                className="h-14 w-14 rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-sm font-medium text-card"
              >
                {initialsOf(detail.contributor.displayName)}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground" data-testid="realization-detail-contributor">
                {detail.contributor.displayName}
              </p>
              {contributorDomain ? <p className="text-sm text-muted-foreground">{contributorDomain}</p> : null}
              {place ? (
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span data-testid="realization-detail-place">{place}</span>
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            data-testid="realization-detail-contact"
            className={`mt-5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground opacity-70 ${focusRing}`}
            aria-disabled="true"
            title={unavailable}
            onClick={(event) => event.preventDefault()}
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            {t("realizationDetail.contact")}
          </button>
          <Link
            href={`/contributors/${detail.contributor.id}`}
            data-testid="realization-detail-profile"
            className={`mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground ${focusRing}`}
          >
            <UserRound className="h-4 w-4" aria-hidden />
            {t("realizationDetail.viewProfile")}
          </Link>
          <p className="mt-3 text-center text-xs text-muted-foreground">{t("realizationDetail.privacy")}</p>
        </aside>
      </div>
      <section className="mt-12" aria-labelledby="realization-project" data-testid="realization-detail-project">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          {t("realizationDetail.projectEyebrow")}
        </p>
        <h2 id="realization-project" className="mt-2 font-display text-3xl text-foreground">
          {t("realizationDetail.projectTitle")}
        </h2>
        <p className="mt-4 max-w-3xl text-sm text-muted-foreground">{t("realizationDetail.projectEmpty")}</p>
      </section>
      <section className="mt-12" aria-labelledby="realization-reviews" data-testid="realization-detail-reviews">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          {t("realizationDetail.reviewsEyebrow")}
        </p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="realization-reviews" className="font-display text-3xl text-foreground">
            {t("realizationDetail.reviewsTitle")}
          </h2>
          <button
            type="button"
            data-testid="realization-detail-review-action"
            className={`inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground opacity-70 ${focusRing}`}
            aria-disabled="true"
            title={unavailable}
            onClick={(event) => event.preventDefault()}
          >
            {t("realizationDetail.giveReview")}
          </button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{t("realizationDetail.reviewsEmpty")}</p>
      </section>
    </>
  );
}

export default function RealizationDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>("loading");
  const [detail, setDetail] = useState<RealizationDetail | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    loadRealizationDetail(id).then((result) => {
      if (cancelled) return;
      if ("detail" in result) {
        setDetail(result.detail);
        setPhase("ready");
        return;
      }
      setDetail(null);
      setPhase(result.status === 404 ? "not-found" : "error");
    });
    return () => {
      cancelled = true;
    };
  }, [id, reloadToken]);

  return (
    <div className="wrap py-8" data-testid="realization-detail">
      <nav aria-label={t("realizationDetail.breadcrumb")} className="mb-6 text-sm">
        <Link href="/realisations" className={`text-primary ${focusRing}`}>
          {t("realizationDetail.realizations")}
        </Link>
        <span className="mx-2 text-muted-foreground" aria-hidden>
          /
        </span>
        <span aria-current="page" className="break-words text-muted-foreground">
          {phase === "ready" && detail?.title.trim() ? detail.title.trim() : t("realizationDetail.title")}
        </span>
      </nav>
      {phase === "loading" ? (
        <p role="status" data-testid="realization-detail-loading" className="text-sm text-muted-foreground">
          {t("realizationDetail.loading")}
        </p>
      ) : null}
      {phase === "error" ? (
        <div role="alert" data-testid="realization-detail-error" className="rounded-xl border border-border bg-card px-6 py-12 text-center">
          <p className="text-base text-foreground">{t("realizationDetail.error")}</p>
          <button
            type="button"
            data-testid="realization-detail-retry"
            className={`mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground ${focusRing}`}
            onClick={() => setReloadToken((value) => value + 1)}
          >
            {t("realizationDetail.retry")}
          </button>
        </div>
      ) : null}
      {phase === "not-found" ? (
        <p role="status" data-testid="realization-detail-not-found" className="text-base text-foreground">
          {t("realizationDetail.notFound")}
        </p>
      ) : null}
      {phase === "ready" && detail ? (
        <>
          <Gallery urls={detail.imageUrls} />
          <div className="mt-8">
            <DetailView detail={detail} />
          </div>
        </>
      ) : null}
    </div>
  );
}
