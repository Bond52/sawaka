"use client";

import { useTranslation } from "@/src/i18n/I18nProvider";

/**
 * Badge overview. No prototype sample badges — empty until badge data exists.
 */
export default function DashboardBadges() {
  const { t } = useTranslation();
  const badges: never[] = [];

  return (
    <section
      className="rounded-lg border border-border bg-card p-5"
      data-testid="dashboard-badges"
      aria-labelledby="dashboard-badges-title"
    >
      <h2
        id="dashboard-badges-title"
        className="mb-4 text-lg font-semibold text-foreground"
      >
        {t("dashboard.badges.title")}
      </h2>

      {badges.length === 0 ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="dashboard-badges-empty"
        >
          {t("dashboard.badges.empty")}
        </p>
      ) : null}

      <button
        type="button"
        disabled
        className="mt-4 cursor-not-allowed text-sm text-muted-foreground"
        data-testid="dashboard-badges-view-all"
        title={t("dashboard.actionUnavailable")}
        aria-disabled="true"
      >
        {t("dashboard.badges.viewAll")} →
      </button>
    </section>
  );
}
