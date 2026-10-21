"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { readStoredUser } from "@/app/lib/authUser";
import {
  ACTIVITY_LIMIT,
  activityMessage,
  formatActivityTime,
  loadOwnActivity,
  type OwnActivityPage,
} from "@/app/lib/contributorActivity";

type Phase = "loading" | "ready" | "error";

const enabledControl =
  "inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const disabledControl =
  "inline-flex min-h-11 cursor-not-allowed items-center rounded-md px-3 py-2 text-sm text-muted-foreground";

function pageHref(page: number) {
  return page <= 1 ? "/dashboard/activity" : `/dashboard/activity?page=${page}`;
}

/**
 * Owner activity history. Rows stay text. Pagination asks the server for one page.
 */
export default function ActivityHistory() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get("page");
  const { t, locale } = useTranslation();
  const [authed, setAuthed] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [result, setResult] = useState<OwnActivityPage | null>(null);

  useEffect(() => {
    if (!readStoredUser()) {
      router.replace("/login?redirect=/dashboard/activity");
      return;
    }
    setAuthed(true);
    const sync = () => {
      if (!readStoredUser()) router.replace("/login?redirect=/dashboard/activity");
    };
    window.addEventListener("storage", sync);
    window.addEventListener("sawaka-auth-changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("sawaka-auth-changed", sync);
    };
  }, [router]);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    setPhase("loading");
    loadOwnActivity({ page: requested ?? 1, limit: ACTIVITY_LIMIT }).then((loaded) => {
      if (cancelled) return;
      if (!loaded.ok) {
        setResult(null);
        setPhase("error");
        return;
      }
      setResult({
        activities: loaded.activities,
        page: loaded.page,
        limit: loaded.limit,
        total: loaded.total,
        totalPages: loaded.totalPages,
      });
      setPhase("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [authed, requested]);

  if (!authed) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground" data-testid="activity-history-auth-loading">
          {t("common.loading")}
        </p>
      </div>
    );
  }

  const page = result?.page ?? 1;
  const totalPages = result?.totalPages ?? 0;
  const total = result?.total ?? 0;

  return (
    <div className="min-h-screen bg-background" data-testid="activity-history">
      <div className="border-b border-border bg-card">
        <div className="container mx-auto max-w-6xl px-4 py-8 lg:px-8">
          <h1 id="activity-history-title" className="text-3xl lg:text-4xl" data-testid="activity-history-title">
            {t("dashboard.activity.historyTitle")}
          </h1>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-6 lg:px-8">
        <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="activity-history-title">
          {phase === "loading" ? (
            <div data-testid="activity-history-loading" role="status" aria-busy="true">
              <span className="sr-only">{t("dashboard.activity.historyLoading")}</span>
              <span className="mb-3 block h-4 w-4/5 animate-pulse rounded bg-muted" />
              <span className="block h-4 w-2/3 animate-pulse rounded bg-muted" />
            </div>
          ) : null}

          {phase === "error" ? (
            <p role="alert" className="text-sm text-muted-foreground" data-testid="activity-history-error">
              {t("dashboard.activity.historyUnavailable")}
            </p>
          ) : null}

          {phase === "ready" && total === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="activity-history-empty">
              {t("dashboard.activity.historyEmpty")}
            </p>
          ) : null}

          {phase === "ready" && result && result.activities.length > 0 ? (
            <ul className="space-y-3" data-testid="activity-history-list">
              {result.activities.map((item) => {
                const message = activityMessage(item.type, item.title);
                const sentence = message.title
                  ? t(message.key, { title: message.title })
                  : t(message.key);
                return (
                  <li key={item.id} className="min-w-0" data-testid="activity-history-item">
                    <p className="break-words text-sm text-foreground">{sentence}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <time dateTime={item.createdAt}>{formatActivityTime(item.createdAt, locale)}</time>
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {phase === "ready" && total > 0 ? (
            <nav
              aria-label={t("dashboard.activity.pagination")}
              className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2"
              data-testid="activity-history-pagination"
            >
              {page <= 1 ? (
                <button type="button" disabled className={disabledControl} data-testid="activity-history-previous">
                  {t("dashboard.activity.previous")}
                </button>
              ) : (
                <Link href={pageHref(page - 1)} className={enabledControl} data-testid="activity-history-previous">
                  {t("dashboard.activity.previous")}
                </Link>
              )}
              <p className="text-sm text-muted-foreground" data-testid="activity-history-page-status">
                {t("dashboard.activity.pageStatus", { page, totalPages })}
              </p>
              {totalPages === 0 || page >= totalPages ? (
                <button type="button" disabled className={disabledControl} data-testid="activity-history-next">
                  {t("dashboard.activity.next")}
                </button>
              ) : (
                <Link href={pageHref(page + 1)} className={enabledControl} data-testid="activity-history-next">
                  {t("dashboard.activity.next")}
                </Link>
              )}
            </nav>
          ) : null}
        </section>
      </div>
    </div>
  );
}
