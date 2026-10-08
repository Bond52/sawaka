"use client";

import { useState, type ReactNode } from "react";
import { MapPin } from "lucide-react";
import ContributorAvatar from "./ContributorAvatar";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  taxonomyLabel,
  type ContributorProfileDetail,
  type ContributorSkillPayload,
} from "@/app/lib/apiContributors";

type ActivityTab = "realizations" | "collaborations";

const ACTIVITY_TABS: ActivityTab[] = ["realizations", "collaborations"];

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

type Props = {
  profile: ContributorProfileDetail;
  hideIdentity?: boolean;
  hideSkills?: boolean;
  headerAction?: ReactNode;
  footer?: ReactNode;
};

/**
 * Shared read-only contributor consultation.
 * Owner-only actions are supplied by the caller and are omitted on the public route.
 */
export default function ContributorProfileConsultation({
  profile,
  hideIdentity = false,
  hideSkills = false,
  headerAction = null,
  footer = null,
}: Props) {
  const { t, locale } = useTranslation();
  const [activeTab, setActiveTab] = useState<ActivityTab>("realizations");
  const domainLabel = profile.domain ? taxonomyLabel(profile.domain, locale) : "";
  const location = formatLocation(profile, t);
  const skills = profile.skills || [];

  return (
    <>
      {!hideIdentity ? (
        <header className="mb-8" data-testid="contributor-profile-header">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <ContributorAvatar
              name={profile.displayName}
              photoUrl={profile.photoUrl}
              alt={t("contributorProfile.photoAlt", { name: profile.displayName })}
              imageTestId="contributor-profile-photo"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <h1
                  className="text-3xl font-semibold text-foreground lg:text-4xl"
                  data-testid="contributor-profile-display-name"
                >
                  {profile.displayName}
                </h1>
                {headerAction}
              </div>
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
      ) : null}

      {!hideSkills ? (
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
      ) : null}

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

      <div
        role="tablist"
        aria-label={t("contributorProfile.tabs.label")}
        data-testid="contributor-profile-tabs"
        className="mb-8 flex gap-1 overflow-x-auto border-b border-border"
        onKeyDown={(event) => {
          const index = ACTIVITY_TABS.indexOf(activeTab);
          let next = index;
          if (event.key === "ArrowRight") next = (index + 1) % ACTIVITY_TABS.length;
          else if (event.key === "ArrowLeft") {
            next = (index - 1 + ACTIVITY_TABS.length) % ACTIVITY_TABS.length;
          } else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = ACTIVITY_TABS.length - 1;
          else return;
          event.preventDefault();
          const tab = ACTIVITY_TABS[next];
          setActiveTab(tab);
          document.getElementById(`contributor-profile-tab-${tab}`)?.focus();
        }}
      >
        {ACTIVITY_TABS.map((tab) => {
          const selected = activeTab === tab;
          return (
            <button
              key={tab}
              id={`contributor-profile-tab-${tab}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`contributor-profile-panel-${tab}`}
              tabIndex={selected ? 0 : -1}
              data-testid={`contributor-profile-tab-${tab}`}
              className={`min-h-11 shrink-0 border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                selected
                  ? "-mb-px border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {t(`contributorProfile.tabs.${tab}`)}
            </button>
          );
        })}
      </div>

      <section
        id="contributor-profile-panel-realizations"
        role="tabpanel"
        aria-labelledby="contributor-profile-tab-realizations"
        hidden={activeTab !== "realizations"}
        data-testid="contributor-profile-realizations"
        className="mb-10"
      >
        <h2 className="mb-3 text-xl font-semibold text-foreground">
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

      <section
        id="contributor-profile-panel-collaborations"
        role="tabpanel"
        aria-labelledby="contributor-profile-tab-collaborations"
        hidden={activeTab !== "collaborations"}
        data-testid="contributor-profile-collaborations"
        className="mb-10"
      >
        <h2 className="mb-3 text-xl font-semibold text-foreground">
          {t("contributorProfile.collaborationsTitle")}
        </h2>
        <p
          className="text-sm text-muted-foreground"
          data-testid="contributor-profile-collaborations-empty"
        >
          {t("contributorProfile.collaborationsEmpty")}
        </p>
      </section>

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

      {footer}
    </>
  );
}
