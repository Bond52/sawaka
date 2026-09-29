"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { readStoredUser } from "@/app/lib/authUser";
import {
  getOwnContributor,
  taxonomyLabel,
  type ContributorProfileDetail,
  type ContributorSkillPayload,
} from "@/app/lib/apiContributors";

function skillLabel(skill: ContributorSkillPayload, locale: string): string {
  if (skill.isCustom) return skill.customLabel || "";
  return taxonomyLabel(
    { id: skill.id || "", nameFR: skill.nameFR || "", nameEN: skill.nameEN || "" },
    locale
  );
}

function formatLocation(
  profile: ContributorProfileDetail,
  t: (key: string) => string
): string {
  const parts = [profile.city, profile.region, profile.country]
    .map((part) => (part || "").trim())
    .filter(Boolean);
  return parts.join(", ") || t("contributorProfile.locationUnavailable");
}

function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}

/**
 * Authenticated Contributor Profile overview at `/profile`.
 * Uses real ContributorProfile data; empty states for unavailable capabilities.
 * Does not render private User/account fields (email, password, etc.).
 */
export default function ContributorProfilePage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ContributorProfileDetail | null>(null);
  const [missingProfile, setMissingProfile] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = readStoredUser();
    if (!stored) {
      router.replace("/login?redirect=/profile");
      return;
    }
    setReady(true);

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setMissingProfile(false);
      const result = await getOwnContributor();
      if (cancelled) return;
      if (result.ok) {
        setProfile(result.profile);
        setLoading(false);
        return;
      }
      if (result.status === 404 || result.code === "CONTRIBUTOR_PROFILE_NOT_FOUND") {
        setMissingProfile(true);
        setProfile(null);
        setLoading(false);
        return;
      }
      if (result.status === 401) {
        router.replace("/login?redirect=/profile");
        return;
      }
      setError(t("contributorProfile.loadError"));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [router, t]);

  if (!ready || loading) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground" data-testid="contributor-profile-loading">
          {t("common.loading")}
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="wrap py-12">
        <p className="text-center text-destructive" data-testid="contributor-profile-error">
          {error}
        </p>
      </main>
    );
  }

  if (missingProfile || !profile) {
    return (
      <main className="wrap py-12" data-testid="contributor-profile-empty">
        <Link
          href="/dashboard"
          className="mb-8 inline-flex text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← {t("contributorProfile.backToDashboard")}
        </Link>
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <h1 className="mb-3 text-2xl font-semibold text-foreground">
            {t("contributorProfile.noProfileTitle")}
          </h1>
          <p className="mb-6 text-muted-foreground">
            {t("contributorProfile.noProfileBody")}
          </p>
          <Link
            href="/contributor/create"
            className="btn btn-primary inline-flex px-5 py-2"
            data-testid="contributor-profile-create-cta"
          >
            {t("contributorProfile.createCta")}
          </Link>
        </div>
      </main>
    );
  }

  const domainLabel = profile.domain
    ? taxonomyLabel(profile.domain, locale)
    : "";
  const location = formatLocation(profile, t);
  const skills = profile.skills || [];

  return (
    <main
      className="min-h-screen bg-background"
      data-testid="contributor-profile-overview"
    >
      <div className="container mx-auto max-w-4xl px-4 py-8 lg:px-8">
        <Link
          href="/dashboard"
          className="mb-8 inline-flex text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="contributor-profile-back"
        >
          ← {t("contributorProfile.backToDashboard")}
        </Link>

        {/* 1. Identity header */}
        <header className="mb-8" data-testid="contributor-profile-header">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground"
              aria-hidden
              data-testid="contributor-profile-avatar"
            >
              {initials(profile.displayName)}
            </div>
            <div className="min-w-0 flex-1">
              <h1
                className="text-3xl font-semibold text-foreground lg:text-4xl"
                data-testid="contributor-profile-display-name"
              >
                {profile.displayName}
              </h1>
              {domainLabel ? (
                <p
                  className="mt-1 text-lg font-medium text-primary"
                  data-testid="contributor-profile-domain"
                >
                  {domainLabel}
                </p>
              ) : null}
              <p
                className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"
                data-testid="contributor-profile-location"
              >
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                <span>{location}</span>
              </p>
              {profile.biography ? (
                <p
                  className="mt-4 max-w-2xl text-base text-foreground"
                  data-testid="contributor-profile-biography"
                >
                  {profile.biography}
                </p>
              ) : null}
            </div>
          </div>
        </header>

        {/* 2. Skills */}
        <section
          className="mb-10"
          aria-labelledby="contributor-skills-heading"
          data-testid="contributor-profile-skills"
        >
          <h2 id="contributor-skills-heading" className="sr-only">
            {t("contributorProfile.skillsTitle")}
          </h2>
          {skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("contributorProfile.skillsEmpty")}
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {skills.map((skill, index) => {
                const label = skillLabel(skill, locale);
                if (!label) return null;
                return (
                  <li
                    key={skill.id || `custom-${index}-${label}`}
                    className="rounded-full border border-border bg-secondary px-3 py-1 text-sm text-foreground"
                  >
                    {label}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 3. Badges — immediately below Skills */}
        <section
          className="mb-10"
          aria-labelledby="contributor-badges-heading"
          data-testid="contributor-profile-badges"
        >
          <h2
            id="contributor-badges-heading"
            className="mb-3 text-xl font-semibold text-foreground"
          >
            {t("contributorProfile.badgesTitle")}
          </h2>
          <p
            className="text-sm text-muted-foreground"
            data-testid="contributor-profile-badges-empty"
          >
            {t("contributorProfile.badgesEmpty")}
          </p>
        </section>

        {/* 4. Reputation */}
        <section
          className="mb-10"
          aria-labelledby="contributor-reputation-heading"
          data-testid="contributor-profile-reputation"
        >
          <h2
            id="contributor-reputation-heading"
            className="mb-4 text-xl font-semibold text-foreground"
          >
            {t("contributorProfile.reputationTitle")}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                "ratings",
                "projects",
                "collaborations",
                "realizations",
              ] as const
            ).map((metric) => (
              <div
                key={metric}
                className="rounded-lg border border-border bg-card p-4"
                data-testid={`contributor-profile-reputation-${metric}`}
              >
                <p className="text-sm text-muted-foreground">
                  {t(`contributorProfile.reputation.${metric}`)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("contributorProfile.reputation.unavailable")}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Realizations */}
        <section
          className="mb-10"
          aria-labelledby="contributor-realizations-heading"
          data-testid="contributor-profile-realizations"
        >
          <h2
            id="contributor-realizations-heading"
            className="mb-3 text-xl font-semibold text-foreground"
          >
            {t("contributorProfile.realizationsTitle")}
          </h2>
          <p
            className="text-sm text-muted-foreground"
            data-testid="contributor-profile-realizations-empty"
          >
            {t("contributorProfile.realizationsEmpty")}
          </p>
          <button
            type="button"
            disabled
            className="mt-4 cursor-not-allowed text-sm font-medium text-muted-foreground"
            title={t("navigation.menuUnavailable")}
            aria-disabled="true"
            data-testid="contributor-profile-realizations-view-all"
          >
            {t("contributorProfile.viewAllRealizations")} →
          </button>
        </section>

        {/* 6. Collaborations */}
        <section
          className="mb-10"
          aria-labelledby="contributor-collaborations-heading"
          data-testid="contributor-profile-collaborations"
        >
          <h2
            id="contributor-collaborations-heading"
            className="mb-3 text-xl font-semibold text-foreground"
          >
            {t("contributorProfile.collaborationsTitle")}
          </h2>
          <p
            className="text-sm text-muted-foreground"
            data-testid="contributor-profile-collaborations-empty"
          >
            {t("contributorProfile.collaborationsEmpty")}
          </p>
        </section>

        {/* 7. Community Reviews */}
        <section
          className="mb-6"
          aria-labelledby="contributor-reviews-heading"
          data-testid="contributor-profile-reviews"
        >
          <h2
            id="contributor-reviews-heading"
            className="mb-3 text-xl font-semibold text-foreground"
          >
            {t("contributorProfile.reviewsTitle")}
          </h2>
          <p
            className="text-sm text-muted-foreground"
            data-testid="contributor-profile-reviews-empty"
          >
            {t("contributorProfile.reviewsEmpty")}
          </p>
        </section>
      </div>
    </main>
  );
}
