"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  activityMessage,
  formatActivityTime,
  loadOwnActivity,
  type ContributorActivityItem,
} from "@/app/lib/contributorActivity";

type Phase = "loading" | "ready" | "error";

/**
 * Owner recent activity. Rows are text; they do not link to realizations.
 * View full history stays unavailable until a history page exists.
 */
export default function DashboardRecentActivity() {
  const { t, locale } = useTranslation();
  const [phase, setPhase] = useState<Phase>("loading");
  const [activities, setActivities] = useState<ContributorActivityItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadOwnActivity().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setActivities(result.activities);
        setPhase("ready");
        return;
      }
      setActivities([]);
      setPhase("error");
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

      {phase === "loading" ? (
        <div data-testid="dashboard-activity-loading" role="status" aria-busy="true">
          <span className="sr-only">{t("dashboard.activity.loading")}</span>
          <span className="mb-3 block h-4 w-4/5 animate-pulse rounded bg-muted" />
          <span className="block h-4 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      ) : null}

      {phase === "error" ? (
        <p role="alert" className="text-sm text-muted-foreground" data-testid="dashboard-activity-error">
          {t("dashboard.activity.unavailable")}
        </p>
      ) : null}

      {phase === "ready" && activities.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="dashboard-activity-empty">
          {t("dashboard.activity.empty")}
        </p>
      ) : null}

      {phase === "ready" && activities.length > 0 ? (
        <ul className="space-y-3" data-testid="dashboard-activity-list">
          {activities.map((item) => {
            const message = activityMessage(item.type, item.title);
            const sentence = message.title
              ? t(message.key, { title: message.title })
              : t(message.key);
            return (
              <li key={item.id} className="min-w-0" data-testid="dashboard-activity-item">
                <p className="break-words text-sm text-foreground">{sentence}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <time dateTime={item.createdAt}>{formatActivityTime(item.createdAt, locale)}</time>
                </p>
              </li>
            );
          })}
        </ul>
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
