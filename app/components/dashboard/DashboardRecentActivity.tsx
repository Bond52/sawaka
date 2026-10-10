"use client";

import { useTranslation } from "@/src/i18n/I18nProvider";

/**
 * Recent activity list. No mock activities — empty until a real feed exists.
 */
export default function DashboardRecentActivity() {
  const { t } = useTranslation();
  const activities: never[] = [];

  return (
    <section
      className="rounded-lg border border-border bg-card p-5"
      data-testid="dashboard-recent-activity"
      aria-labelledby="dashboard-recent-activity-title"
    >
      <h2
        id="dashboard-recent-activity-title"
        className="mb-4 text-lg font-semibold text-foreground"
      >
        {t("dashboard.activity.title")}
      </h2>

      {activities.length === 0 ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="dashboard-activity-empty"
        >
          {t("dashboard.activity.empty")}
        </p>
      ) : null}

      <button
        type="button"
        disabled
        className="mt-4 cursor-not-allowed text-sm text-muted-foreground"
        data-testid="dashboard-activity-history"
        title={t("dashboard.actionUnavailable")}
        aria-disabled="true"
      >
        {t("dashboard.activity.viewHistory")} →
      </button>
    </section>
  );
}
