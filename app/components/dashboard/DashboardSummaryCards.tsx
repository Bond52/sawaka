"use client";

import Link from "next/link";
import { useTranslation } from "@/src/i18n/I18nProvider";

type SummaryCard = {
  id: string;
  labelKey: string;
  value: string;
  subKey: string;
  valueClassName: string;
  ctaKey: string;
  href?: string;
};

/**
 * Top-row overview metrics. Values stay neutral (zero / unavailable)
 * until real dashboard APIs exist — no invented statistics.
 */
export default function DashboardSummaryCards() {
  const { t } = useTranslation();

  const cards: SummaryCard[] = [
    {
      id: "profile",
      labelKey: "dashboard.summary.profile",
      value: "0%",
      subKey: "dashboard.summary.profileSub",
      valueClassName: "text-primary",
      ctaKey: "dashboard.summary.profileCta",
      href: "/profile",
    },
    {
      id: "realizations",
      labelKey: "dashboard.summary.realizations",
      value: "0",
      subKey: "dashboard.summary.realizationsSub",
      valueClassName: "text-foreground",
      ctaKey: "dashboard.summary.realizationsCta",
    },
    {
      id: "projects",
      labelKey: "dashboard.summary.projects",
      value: "0",
      subKey: "dashboard.summary.projectsSub",
      valueClassName: "text-foreground",
      ctaKey: "dashboard.summary.projectsCta",
      href: "/projets",
    },
    {
      id: "reputation",
      labelKey: "dashboard.summary.reputation",
      value: t("common.na"),
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
          <div className={`mb-0.5 text-2xl font-bold ${card.valueClassName}`}>
            {card.value}
          </div>
          <div className="mb-3 text-sm text-muted-foreground">
            {t(card.subKey)}
          </div>
          {card.href ? (
            <Link
              href={card.href}
              className="text-sm text-primary hover:underline"
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
