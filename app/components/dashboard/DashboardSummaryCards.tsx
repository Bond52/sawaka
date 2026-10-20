"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Check, Circle } from "lucide-react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  classifyOwnProfileResult,
  getOwnContributor,
} from "@/app/lib/apiContributors";
import {
  countPublishedRealizations,
  loadOwnerPortfolio,
} from "@/app/lib/portfolioRealizations";

type MetricPhase = "loading" | "ready" | "unavailable";

type CompletionCriterion = {
  key: string;
  complete: boolean;
};

type ProfileMetric = {
  phase: MetricPhase;
  percent: number;
  id: string | null;
  criteria: CompletionCriterion[] | null;
};

type RealizationMetric = {
  phase: MetricPhase;
  count: number;
};

type SummaryCard = {
  id: string;
  labelKey: string;
  value: string;
  phase: MetricPhase;
  subKey: string;
  subText?: string;
  valueClassName: string;
  ctaKey: string;
  href?: string;
};

const CRITERION_KEYS = [
  "displayName",
  "domain",
  "skills",
  "country",
  "biography",
  "photo",
] as const;

const MISSING_PROFILE_CRITERIA: CompletionCriterion[] = CRITERION_KEYS.map((key) => ({
  key,
  complete: false,
}));

function isCompletionPercent(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;
}

function readCompletionCriteria(value: unknown): CompletionCriterion[] | null {
  if (!Array.isArray(value) || value.length !== CRITERION_KEYS.length) return null;
  const seen = new Set<string>();
  const criteria: CompletionCriterion[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const key = (item as { key?: unknown }).key;
    const complete = (item as { complete?: unknown }).complete;
    if (typeof key !== "string" || typeof complete !== "boolean") return null;
    if (!CRITERION_KEYS.includes(key as (typeof CRITERION_KEYS)[number])) return null;
    if (seen.has(key)) return null;
    seen.add(key);
    criteria.push({ key, complete });
  }
  return seen.size === CRITERION_KEYS.length ? criteria : null;
}

/**
 * Top-row overview metrics.
 * Profile completion and the published realization count come from the
 * authenticated owner endpoints. Projects and reputation stay neutral
 * until their own APIs exist.
 */
export default function DashboardSummaryCards() {
  const { t } = useTranslation();
  const criteriaPanelId = useId();
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileMetric>({
    phase: "loading",
    percent: 0,
    id: null,
    criteria: null,
  });
  const [realizations, setRealizations] = useState<RealizationMetric>({
    phase: "loading",
    count: 0,
  });

  useEffect(() => {
    let active = true;

    getOwnContributor().then((result) => {
      if (!active) return;
      const outcome = classifyOwnProfileResult(result);
      if (outcome.kind === "missing") {
        setProfile({
          phase: "ready",
          percent: 0,
          id: null,
          criteria: MISSING_PROFILE_CRITERIA,
        });
        return;
      }
      if (
        outcome.kind === "success" &&
        isCompletionPercent(outcome.profile.completionPercent)
      ) {
        setProfile({
          phase: "ready",
          percent: outcome.profile.completionPercent,
          id: outcome.profile.id,
          criteria: readCompletionCriteria(outcome.profile.completionCriteria),
        });
        return;
      }
      setProfile({ phase: "unavailable", percent: 0, id: null, criteria: null });
    });

    loadOwnerPortfolio().then((result) => {
      if (!active) return;
      if (!result.ok) {
        setRealizations({ phase: "unavailable", count: 0 });
        return;
      }
      setRealizations({
        phase: "ready",
        count: countPublishedRealizations(result.items),
      });
    });

    return () => {
      active = false;
    };
  }, []);

  const completedCount = profile.criteria
    ? profile.criteria.filter((item) => item.complete).length
    : 0;
  const profileSubText =
    profile.phase === "ready" && profile.criteria
      ? t("dashboard.summary.completionCount", {
          completed: completedCount,
          total: profile.criteria.length,
        })
      : undefined;

  const cards: SummaryCard[] = [
    {
      id: "profile",
      labelKey: "dashboard.summary.profile",
      value: profile.phase === "ready" ? `${profile.percent}%` : t("common.na"),
      phase: profile.phase,
      subKey: "dashboard.summary.profileSub",
      subText: profileSubText,
      valueClassName: "text-primary",
      ctaKey:
        profile.phase === "ready" && profile.percent === 100
          ? "dashboard.summary.profileCtaEdit"
          : "dashboard.summary.profileCta",
      href: "/profile",
    },
    {
      id: "realizations",
      labelKey: "dashboard.summary.realizations",
      value: realizations.phase === "ready" ? String(realizations.count) : t("common.na"),
      phase: realizations.phase,
      subKey:
        realizations.phase === "ready" && realizations.count === 1
          ? "dashboard.summary.realizationsSubOne"
          : "dashboard.summary.realizationsSub",
      valueClassName: "text-foreground",
      ctaKey: "dashboard.summary.realizationsCta",
      href: "/vendeur/articles",
    },
    {
      id: "projects",
      labelKey: "dashboard.summary.projects",
      value: "0",
      phase: "ready",
      subKey: "dashboard.summary.projectsSub",
      valueClassName: "text-foreground",
      ctaKey: "dashboard.summary.projectsCta",
      href: "/projets",
    },
    {
      id: "reputation",
      labelKey: "dashboard.summary.reputation",
      value: t("common.na"),
      phase: "ready",
      subKey: "dashboard.summary.reputationSub",
      valueClassName: "text-yellow-600",
      ctaKey: "dashboard.summary.reputationCta",
      href: profile.id ? `/contributors/${profile.id}` : undefined,
    },
  ];

  return (
    <div
      className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4"
      data-testid="dashboard-summary-cards"
    >
      {cards.map((card) => (
        <div
          key={card.id}
          className="rounded-lg border border-border bg-card p-4"
          data-testid={`dashboard-summary-${card.id}`}
        >
          <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
            {t(card.labelKey)}
          </div>
          {card.phase === "loading" ? (
            <div
              className="mb-0.5 flex h-8 items-center"
              data-testid={`dashboard-summary-${card.id}-value`}
              aria-busy="true"
            >
              <span
                className="inline-block h-7 w-14 animate-pulse rounded bg-muted"
                aria-label={t("common.loading")}
              />
            </div>
          ) : (
            <div
              className={`mb-0.5 text-2xl font-bold leading-8 ${card.valueClassName}`}
              data-testid={`dashboard-summary-${card.id}-value`}
              aria-busy="false"
            >
              {card.value}
            </div>
          )}
          <div className="mb-3 text-sm text-muted-foreground">
            {card.subText ?? t(card.subKey)}
          </div>
          {card.id === "profile" && profile.criteria ? (
            <div className="mb-3">
              <button
                type="button"
                className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-expanded={criteriaOpen}
                aria-controls={criteriaPanelId}
                data-testid="dashboard-summary-profile-criteria-toggle"
                onClick={() => setCriteriaOpen((open) => !open)}
              >
                {criteriaOpen
                  ? t("dashboard.summary.criteriaToggleHide")
                  : t("dashboard.summary.criteriaToggle")}
              </button>
              {criteriaOpen ? (
                <ul
                  id={criteriaPanelId}
                  className="mt-2 space-y-1 text-sm text-foreground"
                  data-testid="dashboard-summary-profile-criteria"
                >
                  {profile.criteria.map((item) => {
                    const label = t(`dashboard.summary.criteria.${item.key}`);
                    const status = item.complete
                      ? t("dashboard.summary.criterionComplete")
                      : t("dashboard.summary.criterionIncomplete");
                    return (
                      <li
                        key={item.key}
                        className="flex items-start gap-2"
                        data-testid={`dashboard-summary-profile-criterion-${item.key}`}
                        data-complete={item.complete ? "true" : "false"}
                      >
                        {item.complete ? (
                          <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        ) : (
                          <Circle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        )}
                        <span>
                          <span className="sr-only">{status}. </span>
                          {label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          ) : null}
          {card.href ? (
            <Link
              href={card.href}
              className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid={`dashboard-summary-${card.id}-cta`}
            >
              {t(card.ctaKey)} →
            </Link>
          ) : (
            <span
              className="cursor-not-allowed text-sm text-muted-foreground"
              aria-disabled="true"
              title={t("dashboard.actionUnavailable")}
              data-testid={`dashboard-summary-${card.id}-cta`}
            >
              {t(card.ctaKey)} →
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
