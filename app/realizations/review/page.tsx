"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { readStoredUser } from "@/app/lib/authUser";
import { listContributorDomains, taxonomyLabel, type TaxonomyItem } from "@/app/lib/apiContributors";
import { commitWorkflowRealizations, type PublicationItem } from "@/app/lib/portfolioPublish";
import {
  getWorkflowSnapshot,
  isRealizationReady,
  prepareReviewHandoff,
  readPublicationHandoff,
  reviewSummary,
  subscribeWorkflow,
  type PublicationHandoff,
  type WorkflowView,
} from "@/app/lib/portfolioWorkflow";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const READY_PREVIEW = 6;

const steps = [
  { key: "importStep", state: "complete", href: "/realizations/import" },
  { key: "organizeStep", state: "complete", href: "/realizations/organize" },
  { key: "completeStep", state: "complete", href: "/realizations/complete" },
  { key: "reviewStep", state: "active" },
] as const;

export default function ReviewRealizationsPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const [ready, setReady] = useState(false);
  const [ownerKey, setOwnerKey] = useState("");
  const [workflow, setWorkflow] = useState<WorkflowView>({ status: "empty" });
  const [handoff, setHandoff] = useState<PublicationHandoff | null>(null);
  const [domains, setDomains] = useState<TaxonomyItem[]>([]);
  const [pending, setPending] = useState<"publish-ready" | "save-drafts" | null>(null);
  const [requestFailed, setRequestFailed] = useState(false);
  const [items, setItems] = useState<PublicationItem[]>([]);

  useEffect(() => {
    const user = readStoredUser();
    if (!user) {
      router.replace("/login?redirect=/realizations/review");
      return;
    }
    const key = user.username;
    setOwnerKey(key);
    const apply = () => {
      setWorkflow(getWorkflowSnapshot(key));
      setHandoff(readPublicationHandoff(key));
    };
    apply();
    if (getWorkflowSnapshot(key).status === "ready") prepareReviewHandoff(key);
    setReady(true);
    return subscribeWorkflow(apply);
  }, [router]);

  useEffect(() => {
    let active = true;
    listContributorDomains().then((result) => {
      if (!active || result.ok !== true) return;
      setDomains(result.domains);
    });
    return () => {
      active = false;
    };
  }, []);

  async function commit(intent: "publish-ready" | "save-drafts") {
    if (pending) return;
    setPending(intent);
    setRequestFailed(false);
    const result = await commitWorkflowRealizations(ownerKey, intent);
    setPending(null);
    if (!result.ok && !result.items) {
      setRequestFailed(true);
      return;
    }
    setItems(result.items || []);
    setHandoff(readPublicationHandoff(ownerKey));
    if (result.ok && result.outcome === "success") {
      router.push("/realizations/confirmation");
      return;
    }
    setRequestFailed(!result.ok || result.outcome === "partial");
  }

  if (!ready) {
    return (
      <div className="wrap py-16">
        <p className="text-muted-foreground" data-testid="portfolio-review-loading">
          {t("common.loading")}
        </p>
      </div>
    );
  }

  const groups = workflow.status === "ready" ? workflow.groups : [];
  const summary = reviewSummary({
    photos: workflow.status === "ready" ? workflow.photos : [],
    groups,
  });

  return (
    <div className="wrap py-8" data-testid="portfolio-review-page">
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="portfolio-stepper">
        {steps.map((step, index) => (
          <li key={step.key} className="flex items-center gap-3">
            {index > 0 ? <span className="hidden h-px w-8 bg-border sm:block" aria-hidden /> : null}
            <Step
              index={index + 1}
              label={t(`portfolio.organize.${step.key}`)}
              state={step.state}
              href={"href" in step ? step.href : undefined}
            />
          </li>
        ))}
      </ol>

      <h1 className="mt-8 font-display text-4xl text-foreground">{t("portfolio.review.title")}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{t("portfolio.review.subtitle")}</p>

      {groups.length === 0 && handoff?.outcome === "success" ? (
        <p className="mt-8 text-muted-foreground" data-testid="portfolio-review-leaving">
          {t("common.loading")}
        </p>
      ) : groups.length === 0 && handoff ? (
        <Handoff handoff={handoff} />
      ) : groups.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-6" data-testid="portfolio-review-recovery" role="status">
          <p className="text-foreground">{t("portfolio.review.recovery")}</p>
          <Link
            href="/realizations/import"
            className={`mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ${focusRing}`}
          >
            {t("portfolio.organize.backToImport")}
          </Link>
        </div>
      ) : (
        <ReviewBatch
          workflow={workflow.status === "ready" ? workflow : { status: "empty" }}
          summary={summary}
          domains={domains}
          locale={locale}
          pending={pending}
          requestFailed={requestFailed}
          handoff={handoff}
          items={items}
          onCommit={commit}
        />
      )}
    </div>
  );
}

function ReviewBatch({
  workflow,
  summary,
  domains,
  locale,
  pending,
  requestFailed,
  handoff,
  items,
  onCommit,
}: {
  workflow: WorkflowView;
  summary: ReturnType<typeof reviewSummary>;
  domains: TaxonomyItem[];
  locale: string;
  pending: "publish-ready" | "save-drafts" | null;
  requestFailed: boolean;
  handoff: PublicationHandoff | null;
  items: PublicationItem[];
  onCommit: (intent: "publish-ready" | "save-drafts") => void;
}) {
  const { t } = useTranslation();
  if (workflow.status !== "ready") return null;
  const readyGroups = workflow.groups.filter((group) => isRealizationReady(group));
  const incompleteGroups = workflow.groups.filter((group) => !isRealizationReady(group));
  const hiddenReady = Math.max(0, readyGroups.length - READY_PREVIEW);

  return (
    <>
      <section className="mt-6" aria-label={t("portfolio.review.summaryLabel")} data-testid="portfolio-review-summary">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            testId="portfolio-review-realization-count"
            value={t(
              summary.realizations === 1
                ? "portfolio.review.realizationsOne"
                : "portfolio.review.realizationsMany",
              { count: summary.realizations }
            )}
          />
          <Stat
            testId="portfolio-review-photo-count"
            value={t(summary.photos === 1 ? "portfolio.review.photosOne" : "portfolio.review.photosMany", {
              count: summary.photos,
            })}
          />
          <Stat
            testId="portfolio-review-ready-count"
            value={t(summary.ready === 1 ? "portfolio.review.readyOne" : "portfolio.review.readyMany", {
              count: summary.ready,
            })}
          />
          <Stat
            testId="portfolio-review-incomplete-count"
            value={t(
              summary.incomplete === 1
                ? "portfolio.review.incompleteOne"
                : "portfolio.review.incompleteMany",
              { count: summary.incomplete }
            )}
          />
        </dl>
      </section>

      {requestFailed ? (
        <p className="mt-4 text-sm text-destructive" role="alert" data-testid="portfolio-review-error">
          {t(handoff?.outcome === "partial" ? "portfolio.review.partialFailure" : "portfolio.review.publicationFailed")}
        </p>
      ) : null}
      {handoff && handoff.outcome !== "failed" ? <Handoff handoff={handoff} /> : null}

      <section className="mt-8" aria-labelledby="ready-heading">
        <h2 id="ready-heading" className="text-xl font-semibold text-foreground">
          {t("portfolio.review.readyToPublish")}
        </h2>
        {readyGroups.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("portfolio.review.readyEmpty")}</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {readyGroups.slice(0, READY_PREVIEW).map((group) => (
              <li key={group.id}>
                <RealizationCard
                  group={group}
                  photos={workflow.photos}
                  domains={domains}
                  locale={locale}
                  failure={items.find((item) => item.clientId === group.id && item.status === "failed")}
                />
              </li>
            ))}
          </ul>
        )}
        {hiddenReady > 0 ? (
          <p className="mt-3 text-sm text-muted-foreground" data-testid="portfolio-review-more">
            {t("portfolio.review.more", { count: hiddenReady })}
          </p>
        ) : null}
      </section>

      <section className="mt-8" aria-labelledby="draft-heading">
        <h2 id="draft-heading" className="text-xl font-semibold text-foreground">
          {t("portfolio.review.remainDrafts")}
        </h2>
        {incompleteGroups.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("portfolio.review.draftsEmpty")}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {incompleteGroups.map((group) => (
              <li key={group.id}>
                <article
                  className="rounded-xl border border-border bg-card p-4"
                  data-testid="portfolio-review-incomplete"
                  data-sequence={group.sequence}
                >
                  <p className="font-medium text-foreground">
                    {t("portfolio.organize.groupLabel", { number: group.sequence })}
                  </p>
                  <p className="mt-1 text-sm text-foreground" data-testid="portfolio-review-missing">
                    {t("portfolio.review.incomplete")}
                    {" · "}
                    {t("portfolio.review.missingImage")}
                  </p>
                  <Link
                    href={`/realizations/complete?group=${group.id}`}
                    data-testid="portfolio-review-complete"
                    className={`mt-3 inline-flex min-h-[44px] items-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground ${focusRing}`}
                  >
                    {t("portfolio.review.complete")}
                  </Link>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/realizations/complete"
          data-testid="portfolio-review-back"
          className={`inline-flex min-h-[44px] items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground ${focusRing}`}
        >
          {t("portfolio.review.back")}
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="portfolio-review-save-drafts"
            className={`inline-flex min-h-[44px] items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50 ${focusRing}`}
            disabled={pending !== null}
            onClick={() => onCommit("save-drafts")}
          >
            {pending === "save-drafts" ? t("portfolio.review.saving") : t("portfolio.review.saveDrafts")}
          </button>
          <button
            type="button"
            data-testid="portfolio-review-publish"
            className={`inline-flex min-h-[44px] items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 ${focusRing}`}
            disabled={pending !== null || summary.ready === 0}
            onClick={() => onCommit("publish-ready")}
          >
            {pending === "publish-ready"
              ? t("portfolio.review.publishing")
              : t("portfolio.review.publish", { count: summary.ready })}
          </button>
        </div>
      </div>
    </>
  );
}

function RealizationCard({
  group,
  photos,
  domains,
  locale,
  failure,
}: {
  group: Extract<WorkflowView, { status: "ready" }>["groups"][number];
  photos: Extract<WorkflowView, { status: "ready" }>["photos"];
  domains: TaxonomyItem[];
  locale: string;
  failure?: PublicationItem;
}) {
  const { t } = useTranslation();
  const images = group.photoIds.flatMap((id) => {
    const photo = photos.find((item) => item.id === id);
    return photo ? [photo] : [];
  });
  const domain = domains.find((item) => item.id === group.domainId);
  return (
    <article
      className="h-full rounded-xl border border-border bg-card p-4"
      data-testid="portfolio-review-ready"
      data-sequence={group.sequence}
    >
      <ul className="flex gap-2 overflow-x-auto">
        {images.slice(0, 3).map((photo) => (
          <li key={photo.id} className="w-16 shrink-0">
            <span
              aria-hidden
              className="block aspect-square rounded-lg bg-secondary bg-cover bg-center"
              style={previewStyle(photo.previewUrl)}
            />
            <span className="mt-1 block truncate text-xs text-muted-foreground">{photo.name}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 font-medium text-foreground">
        {t("portfolio.organize.groupLabel", { number: group.sequence })}
      </p>
      <p className="text-sm font-medium text-foreground">{t("portfolio.review.readyToPublish")}</p>
      {group.description ? (
        <p className="mt-2 line-clamp-3 break-words text-sm text-muted-foreground">{group.description}</p>
      ) : null}
      {domain ? <p className="mt-1 text-sm text-muted-foreground">{taxonomyLabel(domain, locale)}</p> : null}
      {group.completedOn ? <p className="mt-1 text-sm text-muted-foreground">{group.completedOn}</p> : null}
      {failure ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {failureText(failure.code, t)}
        </p>
      ) : null}
    </article>
  );
}

function Handoff({ handoff }: { handoff: PublicationHandoff }) {
  const { t } = useTranslation();
  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-4" role="status" data-testid="portfolio-review-handoff">
      <p data-testid="portfolio-review-published-count">
        {t(handoff.publishedCount === 1 ? "portfolio.review.resultPublishedOne" : "portfolio.review.resultPublished", {
          count: handoff.publishedCount,
        })}
      </p>
      <p data-testid="portfolio-review-draft-count">
        {t(handoff.draftCount === 1 ? "portfolio.review.resultDraftsOne" : "portfolio.review.resultDrafts", {
          count: handoff.draftCount,
        })}
      </p>
      {handoff.failedCount > 0 ? (
        <p>
          {t(handoff.failedCount === 1 ? "portfolio.review.resultFailedOne" : "portfolio.review.resultFailed", {
            count: handoff.failedCount,
          })}
        </p>
      ) : null}
      {handoff.outcome === "success" && handoff.publishedCount === 0 ? (
        <p>{t("portfolio.review.savedDrafts")}</p>
      ) : null}
      <p className="mt-2 text-sm text-muted-foreground">{t("portfolio.review.confirmationPending")}</p>
      <Link
        href="/vendeur/articles"
        data-testid="portfolio-review-my-realizations"
        className={`mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-primary ${focusRing}`}
      >
        {t("portfolio.review.myRealizations")}
      </Link>
    </div>
  );
}

function Stat({ value, testId }: { value: string; testId: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <dd className="text-lg font-semibold text-foreground" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

function Step({
  index,
  label,
  state,
  href,
}: {
  index: number;
  label: string;
  state: "complete" | "active" | "upcoming";
  href?: string;
}) {
  const content = (
    <span className="inline-flex min-h-[44px] items-center gap-2 text-sm">
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
          state === "complete"
            ? "bg-emerald-600 text-white"
            : state === "active"
              ? "bg-primary text-primary-foreground"
              : "border border-border text-muted-foreground"
        }`}
      >
        {state === "complete" ? <Check className="h-4 w-4" aria-hidden /> : index}
      </span>
      <span className={state === "upcoming" ? "text-muted-foreground" : "font-medium text-foreground"}>
        {label}
      </span>
    </span>
  );
  if (href) {
    return (
      <Link href={href} className={`rounded-full ${focusRing}`}>
        {content}
      </Link>
    );
  }
  return (
    <span aria-current={state === "active" ? "step" : undefined} data-step-state={state}>
      {content}
    </span>
  );
}

function failureText(code: string | undefined, t: (key: string, params?: Record<string, string | number>) => string) {
  if (code === "DESCRIPTION_TOO_LONG") return t("portfolio.complete.descriptionTooLong", { max: 2000 });
  if (code === "DATE_INVALID") return t("portfolio.complete.dateInvalid");
  if (code === "DOMAIN_INVALID") return t("portfolio.review.categoryInvalid");
  if (code === "UNSUPPORTED_IMAGE_TYPE" || code === "IMAGE_TOO_LARGE" || code === "IMAGE_MISSING") {
    return t("portfolio.review.imageRejected");
  }
  return t("portfolio.review.itemFailed");
}

function previewStyle(url: string): { backgroundImage: string } | undefined {
  if (!url.startsWith("blob:")) return undefined;
  return { backgroundImage: `url("${url}")` };
}
