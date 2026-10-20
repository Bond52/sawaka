"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

type ProfileMetric = {
  phase: MetricPhase;
  percent: number;
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
  valueClassName: string;
  ctaKey: string;
  href?: string;
};

function isCompletionPercent(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;
}

/**
 * Top-row overview metrics.
 * Profile completion and the published realization count come from the
 * authenticated owner endpoints. Projects and reputation stay neutral
 * until their own APIs exist.
 */
export default function DashboardSummaryCards() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<ProfileMetric>({
    phase: "loading",
    percent: 0,
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
        setProfile({ phase: "ready", percent: 0 });
        return;
      }
      if (
        outcome.kind === "success" &&
        isCompletionPercent(outcome.profile.completionPercent)
      ) {
        setProfile({ phase: "ready", percent: outcome.profile.completionPercent });
        return;
      }
      setProfile({ phase: "unavailable", percent: 0 });
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

  const cards: SummaryCard[] = [
    {
      id: "profile",
      labelKey: "dashboard.summary.profile",
      value: profile.phase === "ready" ? `${profile.percent}%` : t("common.na"),
      phase: profile.phase,
      subKey: "dashboard.summary.profileSub",
      valueClassName: "text-primary",
      ctaKey:
        profile.phase === "ready" && profile.percent === 100
          ? "dashboard.summary.profileCtaView"
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
            {t(card.subKey)}
          </div>
          {card.href ? (
            <Link
              href={card.href}
              className="text-sm text-primary hover:underline"
              data-testid={`dashboard-summary-${card.id}-cta`}
            >
              {t(card.ctaKey)} →
            </Link>
          ) : (
            <span
              className="cursor-not-allowed text-sm text-muted-foreground"
              aria-disabled="true"
              title={t("dashboard.actionUnavailable")}
            >
              {t(card.ctaKey)} →
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
