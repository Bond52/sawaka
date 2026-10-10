"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, LayoutGrid, Plus, Sparkles } from "lucide-react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { readStoredUser } from "@/app/lib/authUser";
import { readPublicationHandoff, type PublicationHandoff } from "@/app/lib/portfolioWorkflow";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function PublicationConfirmationPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [result, setResult] = useState<PublicationHandoff | null>(null);

  useEffect(() => {
    const user = readStoredUser();
    if (!user) {
      router.replace("/login?redirect=/realizations/confirmation");
      return;
    }
    const handoff = readPublicationHandoff(user.username);
    if (!handoff || handoff.outcome !== "success") {
      router.replace("/vendeur/articles");
      return;
    }
    setResult(handoff);
  }, [router]);

  if (!result) {
    return (
      <div className="wrap py-16">
        <p className="text-muted-foreground" data-testid="portfolio-confirmation-loading">
          {t("common.loading")}
        </p>
      </div>
    );
  }

  const published = result.publishedCount > 0;
  const publishedLabel = t(
    result.publishedCount === 1
      ? "portfolio.confirmation.publishedOne"
      : "portfolio.confirmation.publishedMany"
  );
  const draftLabel = t(
    result.draftCount === 1 ? "portfolio.confirmation.draftOne" : "portfolio.confirmation.draftMany"
  );

  return (
    <div className="wrap py-12 sm:py-16" data-testid="portfolio-confirmation-page">
      <div className="mx-auto max-w-2xl text-center" role="status">
        <div className="relative mx-auto h-16 w-16">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <Check className="h-8 w-8" aria-hidden />
          </span>
          <Sparkles className="absolute -right-3 -top-2 h-5 w-5 text-primary" aria-hidden />
        </div>

        <p
          className="mt-6 text-sm font-semibold tracking-[0.14em] text-primary"
          data-testid="portfolio-confirmation-eyebrow"
        >
          {t(published ? "portfolio.confirmation.eyebrowPublished" : "portfolio.confirmation.eyebrowDrafts")}
        </p>
        <h1 className="mt-3 font-display text-4xl text-foreground sm:text-5xl">
          {t(published ? "portfolio.confirmation.titlePublished" : "portfolio.confirmation.titleDrafts")}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{t("portfolio.confirmation.explanation")}</p>

        <div className="mt-8 grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-2">
          <CountCard
            count={result.publishedCount}
            label={publishedLabel}
            summary={t(
              result.publishedCount === 1
                ? "portfolio.confirmation.publishedSummaryOne"
                : "portfolio.confirmation.publishedSummaryMany",
              { count: result.publishedCount }
            )}
            tone="published"
            countTestId="portfolio-confirmation-published-count"
            labelTestId="portfolio-confirmation-published-label"
          />
          <CountCard
            count={result.draftCount}
            label={draftLabel}
            summary={t(
              result.draftCount === 1
                ? "portfolio.confirmation.draftSummaryOne"
                : "portfolio.confirmation.draftSummaryMany",
              { count: result.draftCount }
            )}
            tone="draft"
            countTestId="portfolio-confirmation-draft-count"
            labelTestId="portfolio-confirmation-draft-label"
            divider
          />
        </div>

        <div className="mt-4 flex gap-3 rounded-xl bg-sky-50 px-4 py-3 text-left text-sky-950">
          <Eye className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p data-testid="portfolio-confirmation-privacy">
            <span className="block font-medium">{t("portfolio.confirmation.privacyTitle")}</span>
            <span className="mt-1 block text-sm">{t("portfolio.confirmation.privacyBody")}</span>
          </p>
        </div>

        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link
            href="/realizations/import"
            data-testid="portfolio-confirmation-add"
            className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground ${focusRing}`}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("portfolio.confirmation.addMore")}
          </Link>
          <Link
            href="/vendeur/articles"
            data-testid="portfolio-confirmation-portfolio"
            className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ${focusRing}`}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
            {t("portfolio.confirmation.viewPortfolio")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function CountCard({
  count,
  label,
  summary,
  tone,
  countTestId,
  labelTestId,
  divider,
}: {
  count: number;
  label: string;
  summary: string;
  tone: "published" | "draft";
  countTestId: string;
  labelTestId: string;
  divider?: boolean;
}) {
  return (
    <div
      className={`px-4 py-8 ${divider ? "border-t border-border sm:border-l sm:border-t-0" : ""}`}
      aria-label={summary}
    >
      <p
        className={`text-4xl font-semibold ${tone === "published" ? "text-emerald-700" : "text-amber-700"}`}
        data-testid={countTestId}
      >
        {count}
      </p>
      <p className="mt-1 text-sm text-muted-foreground" data-testid={labelTestId}>
        {label}
      </p>
    </div>
  );
}
