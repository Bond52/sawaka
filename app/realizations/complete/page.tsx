"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { readStoredUser } from "@/app/lib/authUser";
import { listContributorDomains, taxonomyLabel, type TaxonomyItem } from "@/app/lib/apiContributors";
import {
  completionDateIssue,
  descriptionIssue,
  getWorkflowSnapshot,
  isRealizationReady,
  prepareReviewHandoff,
  REALIZATION_DESCRIPTION_MAX,
  subscribeWorkflow,
  updateWorkflowGroupDetails,
  type WorkflowView,
} from "@/app/lib/portfolioWorkflow";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const steps = [
  { key: "importStep", state: "complete", href: "/realizations/import" },
  { key: "organizeStep", state: "complete", href: "/realizations/organize" },
  { key: "completeStep", state: "active" },
  { key: "reviewStep", state: "upcoming", href: "/realizations/review" },
] as const;

export default function CompleteRealizationMetadataPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const [ready, setReady] = useState(false);
  const [ownerKey, setOwnerKey] = useState("");
  const [workflow, setWorkflow] = useState<WorkflowView>({ status: "empty" });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [domains, setDomains] = useState<TaxonomyItem[]>([]);
  const [domainsFailed, setDomainsFailed] = useState(false);
  const appliedGroup = useRef(false);

  useEffect(() => {
    const user = readStoredUser();
    if (!user) {
      router.replace("/login?redirect=/realizations/complete");
      return;
    }
    const key = user.username;
    setOwnerKey(key);
    const apply = () => setWorkflow(getWorkflowSnapshot(key));
    apply();
    setReady(true);
    return subscribeWorkflow(apply);
  }, [router]);

  useEffect(() => {
    if (appliedGroup.current || workflow.status !== "ready") return;
    const id = new URLSearchParams(window.location.search).get("group");
    if (!id) return;
    const index = workflow.groups.findIndex((group) => group.id === id);
    if (index < 0) return;
    appliedGroup.current = true;
    setSelectedIndex(index);
  }, [workflow]);

  useEffect(() => {
    let active = true;
    listContributorDomains().then((result) => {
      if (!active) return;
      if (result.ok !== true) {
        setDomainsFailed(true);
        return;
      }
      setDomains(result.domains);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!ready) {
    return (
      <div className="wrap py-16">
        <p className="text-muted-foreground" data-testid="portfolio-complete-loading">
          {t("common.loading")}
        </p>
      </div>
    );
  }

  return (
    <div className="wrap py-8" data-testid="portfolio-complete-page">
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

      <h1 className="mt-8 font-display text-4xl text-foreground">{t("portfolio.complete.title")}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{t("portfolio.complete.subtitle")}</p>

      {workflow.status !== "ready" ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-6" data-testid="portfolio-complete-recovery" role="status">
          <p className="text-foreground">{t("portfolio.complete.recovery")}</p>
          <Link
            href="/realizations/import"
            className={`mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ${focusRing}`}
          >
            {t("portfolio.organize.backToImport")}
          </Link>
        </div>
      ) : (
        <CompleteWorkspace
          ownerKey={ownerKey}
          workflow={workflow}
          selectedIndex={selectedIndex}
          setSelectedIndex={setSelectedIndex}
          domains={domains}
          domainsFailed={domainsFailed}
          locale={locale}
        />
      )}
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

function CompleteWorkspace({
  ownerKey,
  workflow,
  selectedIndex,
  setSelectedIndex,
  domains,
  domainsFailed,
  locale,
}: {
  ownerKey: string;
  workflow: Extract<WorkflowView, { status: "ready" }>;
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  domains: TaxonomyItem[];
  domainsFailed: boolean;
  locale: string;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const groups = workflow.groups;
  const index = groups.length === 0 ? 0 : Math.min(selectedIndex, groups.length - 1);
  const current = groups[index];
  const readyCount = groups.filter((group) => isRealizationReady(group)).length;
  const incompleteCount = groups.length - readyCount;

  if (!current) {
    return (
      <div className="mt-8 rounded-xl border border-border bg-card p-6" data-testid="portfolio-complete-empty" role="status">
        <p className="text-foreground">{t("portfolio.complete.noGroups")}</p>
        <Link
          href="/realizations/organize"
          data-testid="portfolio-complete-back"
          className={`mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ${focusRing}`}
        >
          {t("portfolio.complete.backToOrganize")}
        </Link>
      </div>
    );
  }

  const photos = current.photoIds.flatMap((id) => {
    const photo = workflow.photos.find((item) => item.id === id);
    return photo ? [photo] : [];
  });
  const descriptionError = descriptionIssue(current.description);
  const dateError = completionDateIssue(current.completedOn);
  const ready = isRealizationReady(current);

  return (
    <>
      <p className="mt-4 text-sm text-muted-foreground" data-testid="portfolio-complete-summary">
        {`${t(readyCount === 1 ? "portfolio.complete.readyOne" : "portfolio.complete.readyMany", {
          count: readyCount,
        })} · ${t(
          incompleteCount === 1 ? "portfolio.complete.incompleteOne" : "portfolio.complete.incompleteMany",
          { count: incompleteCount }
        )}`}
      </p>

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-xl border border-border bg-card p-3" aria-label={t("portfolio.complete.listLabel")}>
          <h2 className="px-2 text-sm font-semibold text-foreground">{t("portfolio.complete.listLabel")}</h2>
          <p className="px-2 text-sm text-muted-foreground" data-testid="portfolio-complete-progress">
            {t("portfolio.complete.progress", { current: index + 1, total: groups.length })}
          </p>
          <ul className="mt-2 space-y-2">
            {groups.map((group, groupIndex) => {
              const groupReady = isRealizationReady(group);
              const label = t("portfolio.organize.groupLabel", { number: group.sequence });
              return (
                <li key={group.id}>
                  <button
                    type="button"
                    data-testid="portfolio-complete-group"
                    data-sequence={group.sequence}
                    data-ready={groupReady ? "true" : "false"}
                    aria-pressed={groupIndex === index}
                    className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left ${
                      groupIndex === index ? "border-primary bg-primary/10" : "border-border"
                    } ${focusRing}`}
                    onClick={() => setSelectedIndex(groupIndex)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">{label}</span>
                      <span className="block text-sm text-muted-foreground">
                        {t(
                          group.photoIds.length === 1
                            ? "portfolio.organize.photoCountOne"
                            : "portfolio.organize.photoCountMany",
                          { count: group.photoIds.length }
                        )}
                      </span>
                    </span>
                    <span className={`shrink-0 text-sm font-medium ${groupReady ? "text-emerald-700" : "text-foreground"}`}>
                      {t(groupReady ? "portfolio.complete.ready" : "portfolio.complete.incomplete")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section
          className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5"
          data-testid="portfolio-complete-editor"
          aria-labelledby="realization-details-heading"
        >
          <h2 id="realization-details-heading" className="text-xl font-semibold text-foreground">
            {t("portfolio.complete.details")}
          </h2>
          <p className="mt-1 text-sm font-medium text-foreground" data-testid="portfolio-complete-status">
            {t(ready ? "portfolio.complete.ready" : "portfolio.complete.incomplete")}
          </p>
          <ul className="mt-4 flex gap-2 overflow-x-auto" data-testid="portfolio-complete-photos">
            {photos.map((photo) => (
              <li key={photo.id} className="w-24 shrink-0">
                <span
                  aria-hidden
                  className="block aspect-square rounded-lg bg-secondary bg-cover bg-center"
                  style={previewStyle(photo.previewUrl)}
                />
                <span className="mt-1 block truncate text-xs text-muted-foreground">{photo.name}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5">
            <label htmlFor="realization-description" className="text-sm font-medium text-foreground">
              {t("portfolio.complete.description")}
            </label>
            <textarea
              id="realization-description"
              data-testid="portfolio-complete-description"
              rows={4}
              value={current.description}
              aria-invalid={descriptionError ? "true" : "false"}
              aria-describedby={descriptionError ? "realization-description-error" : undefined}
              className={`mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground ${focusRing}`}
              onChange={(event) =>
                updateWorkflowGroupDetails(ownerKey, current.id, { description: event.target.value })
              }
            />
            {descriptionError ? (
              <p id="realization-description-error" className="mt-1 text-sm text-destructive" role="alert">
                {t("portfolio.complete.descriptionTooLong", { max: REALIZATION_DESCRIPTION_MAX })}
              </p>
            ) : null}
          </div>

          <div className="mt-4">
            <label htmlFor="realization-category" className="text-sm font-medium text-foreground">
              {t("portfolio.complete.category")}
            </label>
            <select
              id="realization-category"
              data-testid="portfolio-complete-category"
              value={current.domainId ?? ""}
              className={`mt-1 min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground ${focusRing}`}
              onChange={(event) =>
                updateWorkflowGroupDetails(ownerKey, current.id, {
                  domainId: event.target.value || null,
                })
              }
            >
              <option value="">{t("portfolio.complete.categoryEmpty")}</option>
              {current.domainId && !domains.some((domain) => domain.id === current.domainId) ? (
                <option value={current.domainId}>{current.domainId}</option>
              ) : null}
              {domains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {taxonomyLabel(domain, locale)}
                </option>
              ))}
            </select>
            {domainsFailed ? (
              <p className="mt-1 text-sm text-muted-foreground" role="status">
                {t("portfolio.complete.categoriesUnavailable")}
              </p>
            ) : null}
          </div>

          <div className="mt-4">
            <label htmlFor="realization-date" className="text-sm font-medium text-foreground">
              {t("portfolio.complete.date")}
            </label>
            <input
              id="realization-date"
              data-testid="portfolio-complete-date"
              type="date"
              value={current.completedOn ?? ""}
              aria-invalid={dateError ? "true" : "false"}
              aria-describedby={dateError ? "realization-date-error" : undefined}
              className={`mt-1 min-h-[44px] w-full max-w-xs rounded-lg border border-border bg-background px-3 text-sm text-foreground ${focusRing}`}
              onChange={(event) =>
                updateWorkflowGroupDetails(ownerKey, current.id, {
                  completedOn: event.target.value || null,
                })
              }
            />
            {dateError ? (
              <p id="realization-date-error" className="mt-1 text-sm text-destructive" role="alert">
                {t("portfolio.complete.dateInvalid")}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/realizations/organize"
          data-testid="portfolio-complete-back"
          className={`inline-flex min-h-[44px] items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground ${focusRing}`}
        >
          {t("portfolio.complete.back")}
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="portfolio-complete-previous"
            className={`inline-flex min-h-[44px] items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50 ${focusRing}`}
            disabled={index === 0}
            onClick={() => setSelectedIndex(index - 1)}
          >
            {t("portfolio.complete.previous")}
          </button>
          <button
            type="button"
            data-testid="portfolio-complete-next"
            className={`inline-flex min-h-[44px] items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50 ${focusRing}`}
            disabled={index >= groups.length - 1}
            onClick={() => setSelectedIndex(index + 1)}
          >
            {t("portfolio.complete.next")}
          </button>
          <button
            type="button"
            data-testid="portfolio-complete-continue"
            className={`inline-flex min-h-[44px] items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ${focusRing}`}
            onClick={() => {
              prepareReviewHandoff(ownerKey);
              router.push("/realizations/review");
            }}
          >
            {t("portfolio.complete.continue")}
          </button>
        </div>
      </div>
    </>
  );
}

function previewStyle(url: string): { backgroundImage: string } | undefined {
  if (!url.startsWith("blob:")) return undefined;
  return { backgroundImage: `url("${url}")` };
}
