"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listContributorDomains, taxonomyLabel, type TaxonomyItem } from "@/app/lib/apiContributors";
import {
  formatCompletedOn,
  loadPublicRealizations,
  type PublicRealization,
} from "@/app/lib/publicRealizations";
import { useTranslation } from "@/src/i18n/I18nProvider";

type Phase = "loading" | "empty" | "error" | "ready";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function domainLabel(
  item: PublicRealization,
  domains: TaxonomyItem[],
  locale: string
): string {
  if (!item.domainId) return "";
  const domain = domains.find((entry) => entry.id === item.domainId);
  return domain ? taxonomyLabel(domain, locale) : "";
}

function RealizationCard({
  item,
  category,
}: {
  item: PublicRealization;
  category: string;
}) {
  const { t, locale } = useTranslation();
  const description = item.description.trim();
  const completed = item.completedOn ? formatCompletedOn(item.completedOn, locale) : "";
  const preview = item.imageUrls[0] ?? "";
  const count = item.imageUrls.length;

  return (
    <article
      className="relative min-w-0 overflow-hidden rounded-xl border border-border bg-card"
      data-testid="contributor-profile-realization"
    >
      <Link
        href={`/realisations/${item.id}`}
        data-testid="contributor-profile-realization-link"
        aria-label={t("realizationDetail.open")}
        className={`absolute inset-0 z-10 ${focusRing}`}
      />
      {preview ? (
        <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
          {/* Contributor photo URLs are not covered by a next/image remote pattern. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={t(
              count === 1
                ? "contributorProfile.realizationsPhotoAltOne"
                : "contributorProfile.realizationsPhotoAlt",
              { count }
            )}
            className="h-full w-full object-cover"
            data-testid="contributor-profile-realization-image"
          />
          {count > 0 ? (
            <p className="absolute bottom-3 right-3 rounded-full bg-foreground/80 px-2 py-1 text-xs text-card">
              <span data-testid="contributor-profile-realization-count">
                {t(
                  count === 1
                    ? "contributorProfile.realizationsImageCountOne"
                    : "contributorProfile.realizationsImageCount",
                  { count }
                )}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="flex min-w-0 flex-col gap-2 p-4">
        {category ? (
          <p
            className="text-sm font-medium text-primary"
            data-testid="contributor-profile-realization-domain"
          >
            {category}
          </p>
        ) : null}
        {description ? (
          <p
            className="break-words text-sm text-foreground"
            data-testid="contributor-profile-realization-description"
          >
            {description}
          </p>
        ) : null}
        {completed ? (
          <p className="text-sm text-muted-foreground">
            <time
              dateTime={item.completedOn || undefined}
              data-testid="contributor-profile-realization-date"
            >
              {t("contributorProfile.realizationsCompleted", { date: completed })}
            </time>
          </p>
        ) : null}
        {!preview && count > 0 ? (
          <p
            className="text-sm text-muted-foreground"
            data-testid="contributor-profile-realization-count"
          >
            {t(
              count === 1
                ? "contributorProfile.realizationsImageCountOne"
                : "contributorProfile.realizationsImageCount",
              { count }
            )}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export default function PublicRealizations({ profileId }: { profileId: string }) {
  const { t, locale } = useTranslation();
  const [phase, setPhase] = useState<Phase>("loading");
  const [items, setItems] = useState<PublicRealization[]>([]);
  const [domains, setDomains] = useState<TaxonomyItem[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    Promise.all([loadPublicRealizations(profileId), listContributorDomains()]).then(
      ([realizations, taxonomy]) => {
        if (cancelled) return;
        if (!realizations.ok) {
          setItems([]);
          setPhase("error");
          return;
        }
        setItems(realizations.items);
        setDomains(taxonomy.ok ? taxonomy.domains : []);
        setPhase(realizations.items.length === 0 ? "empty" : "ready");
      }
    );
    return () => {
      cancelled = true;
    };
  }, [profileId, reloadToken]);

  if (phase === "loading") {
    return (
      <p
        role="status"
        className="text-sm text-muted-foreground"
        data-testid="contributor-profile-realizations-loading"
      >
        {t("contributorProfile.realizationsLoading")}
      </p>
    );
  }

  if (phase === "error") {
    return (
      <div role="alert" data-testid="contributor-profile-realizations-error">
        <p className="text-sm text-destructive">
          {t("contributorProfile.realizationsError")}
        </p>
        <button
          type="button"
          className={`mt-3 inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-medium text-foreground ${focusRing}`}
          data-testid="contributor-profile-realizations-retry"
          onClick={() => setReloadToken((value) => value + 1)}
        >
          {t("contributorProfile.realizationsRetry")}
        </button>
      </div>
    );
  }

  if (phase === "empty") {
    return (
      <p
        className="text-sm text-muted-foreground"
        data-testid="contributor-profile-realizations-empty"
      >
        {t("contributorProfile.realizationsEmpty")}
      </p>
    );
  }

  return (
    <ul
      className="grid grid-cols-1 gap-4 md:grid-cols-2"
      aria-labelledby="contributor-realizations-heading"
      data-testid="contributor-profile-realizations-list"
    >
      {items.map((item) => (
        <li key={item.id} className="min-w-0">
          <RealizationCard
            item={item}
            category={domainLabel(item, domains, locale)}
          />
        </li>
      ))}
    </ul>
  );
}
