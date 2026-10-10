"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ContributorAvatar from "@/app/profile/ContributorAvatar";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  listContributorDomains,
  listContributorSkills,
  listPublicContributors,
  taxonomyLabel,
  type ContributorProfileDetail,
  type TaxonomyItem,
} from "@/app/lib/apiContributors";

function skillLabels(profile: ContributorProfileDetail, locale: string): string[] {
  return (profile.skills || [])
    .map((skill) => {
      if (skill.isCustom) return skill.customLabel || "";
      if (!skill.nameFR && !skill.nameEN) return "";
      return taxonomyLabel(
        { id: skill.id || "", nameFR: skill.nameFR || "", nameEN: skill.nameEN || "" },
        locale
      );
    })
    .filter(Boolean);
}

function locationLabel(profile: ContributorProfileDetail): string {
  return [profile.city, profile.region, profile.country]
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(", ");
}

function excerpt(value: string): string {
  const text = value.trim();
  if (text.length <= 140) return text;
  return `${text.slice(0, 137).trimEnd()}…`;
}

export default function ReseauPage() {
  const { t, locale } = useTranslation();
  const [domains, setDomains] = useState<TaxonomyItem[]>([]);
  const [skills, setSkills] = useState<TaxonomyItem[]>([]);
  const [profiles, setProfiles] = useState<ContributorProfileDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [domainId, setDomainId] = useState("");
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");

  const filtersActive = Boolean(
    q.trim() || domainId || skillIds.length || country.trim() || region.trim() || city.trim()
  );

  useEffect(() => {
    let cancelled = false;
    listContributorDomains().then((result) => {
      if (!cancelled && result.ok) setDomains(result.domains);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!domainId) {
      setSkills([]);
      return;
    }
    let cancelled = false;
    listContributorSkills(domainId).then((result) => {
      if (!cancelled && result.ok) setSkills(result.skills);
    });
    return () => {
      cancelled = true;
    };
  }, [domainId]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(false);
      const result = await listPublicContributors({
        q: q.trim(),
        domainId,
        skillIds,
        country: country.trim(),
        region: region.trim(),
        city: city.trim(),
      });
      if (cancelled) return;
      if (!result.ok) {
        setError(true);
        setProfiles([]);
      } else {
        setProfiles(result.profiles);
      }
      setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q, domainId, skillIds, country, region, city]);

  function resetFilters() {
    setQ("");
    setDomainId("");
    setSkillIds([]);
    setCountry("");
    setRegion("");
    setCity("");
  }

  function toggleSkill(id: string) {
    setSkillIds((current) =>
      current.includes(id) ? current.filter((skillId) => skillId !== id) : [...current, id]
    );
  }

  return (
    <div className="wrap py-8" data-testid="contributor-directory">
      <h1 className="mb-6 text-3xl font-semibold text-foreground">{t("contributorDirectory.title")}</h1>

      <form
        className="mb-8 space-y-4"
        role="search"
        onSubmit={(event) => event.preventDefault()}
      >
        <div>
          <label htmlFor="contributor-directory-search" className="mb-1 block text-sm font-medium">
            {t("contributorDirectory.searchLabel")}
          </label>
          <input
            id="contributor-directory-search"
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={t("contributorDirectory.searchPlaceholder")}
            data-testid="contributor-directory-search"
            className="w-full rounded-lg border border-border bg-white px-4 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <details className="rounded-lg border border-border bg-white p-4" data-testid="contributor-directory-filters">
          <summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {t("contributorDirectory.filters")}
          </summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="contributor-directory-domain" className="mb-1 block text-sm font-medium">
                {t("contributor.create.domain")}
              </label>
              <select
                id="contributor-directory-domain"
                value={domainId}
                data-testid="contributor-directory-domain"
                onChange={(event) => {
                  setDomainId(event.target.value);
                  setSkillIds([]);
                }}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{t("contributorDirectory.domainAll")}</option>
                {domains.map((domain) => (
                  <option key={domain.id} value={domain.id}>
                    {taxonomyLabel(domain, locale)}
                  </option>
                ))}
              </select>
            </div>

            <fieldset>
              <legend className="mb-1 text-sm font-medium">{t("contributor.create.skills")}</legend>
              <p className="mb-2 text-sm text-muted-foreground" data-testid="contributor-directory-skill-rule">
                {t("contributorDirectory.skillMatch")}
              </p>
              {!domainId ? (
                <p className="text-sm text-muted-foreground">{t("contributor.create.skillsNeedDomain")}</p>
              ) : (
                <ul className="max-h-40 space-y-2 overflow-y-auto">
                  {skills.map((skill) => (
                    <li key={skill.id}>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={skillIds.includes(skill.id)}
                          onChange={() => toggleSkill(skill.id)}
                          data-testid={`contributor-directory-skill-${skill.id}`}
                          className="h-4 w-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        {taxonomyLabel(skill, locale)}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>

            <div>
              <label htmlFor="contributor-directory-country" className="mb-1 block text-sm font-medium">
                {t("contributor.create.country")}
              </label>
              <input
                id="contributor-directory-country"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                data-testid="contributor-directory-country"
                className="w-full rounded-lg border border-border bg-white px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="contributor-directory-region" className="mb-1 block text-sm font-medium">
                {t("contributor.create.region")}
              </label>
              <input
                id="contributor-directory-region"
                value={region}
                onChange={(event) => setRegion(event.target.value)}
                data-testid="contributor-directory-region"
                className="w-full rounded-lg border border-border bg-white px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="contributor-directory-city" className="mb-1 block text-sm font-medium">
                {t("contributor.create.city")}
              </label>
              <input
                id="contributor-directory-city"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                data-testid="contributor-directory-city"
                className="w-full rounded-lg border border-border bg-white px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        </details>

        {filtersActive ? (
          <button
            type="button"
            onClick={resetFilters}
            data-testid="contributor-directory-reset"
            className="btn btn-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("contributorDirectory.reset")}
          </button>
        ) : null}
      </form>

      {loading ? (
        <p className="text-muted-foreground" data-testid="contributor-directory-loading">
          {t("contributorDirectory.loading")}
        </p>
      ) : null}

      {!loading && error ? (
        <p className="text-destructive" role="alert" data-testid="contributor-directory-error">
          {t("contributorDirectory.loadError")}
        </p>
      ) : null}

      {!loading && !error && profiles.length === 0 ? (
        <div className="space-y-4 text-center">
          <p data-testid={filtersActive ? "contributor-directory-no-results" : "contributor-directory-empty"}>
            {filtersActive ? t("contributorDirectory.noResults") : t("contributorDirectory.empty")}
          </p>
          {filtersActive ? (
            <button
              type="button"
              onClick={resetFilters}
              className="btn btn-secondary"
            >
              {t("contributorDirectory.reset")}
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && profiles.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => {
            const skillsText = skillLabels(profile, locale).slice(0, 3).join(", ");
            const place = locationLabel(profile);
            return (
              <li key={profile.id}>
                <Link
                  href={`/contributors/${profile.id}`}
                  data-testid="contributor-directory-card"
                  className="block h-full rounded-lg border border-border bg-white p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ContributorAvatar
                    name={profile.displayName}
                    photoUrl={profile.photoUrl}
                    alt={t("contributorProfile.photoAlt", { name: profile.displayName })}
                    imageTestId={`contributor-directory-photo-${profile.id}`}
                  />
                  <h2 className="mt-4 text-xl font-semibold text-foreground">{profile.displayName}</h2>
                  {profile.domain ? (
                    <p className="mt-1 text-sm font-medium text-primary">
                      {taxonomyLabel(profile.domain, locale)}
                    </p>
                  ) : null}
                  {skillsText ? <p className="mt-2 text-sm text-foreground">{skillsText}</p> : null}
                  {place ? <p className="mt-2 text-sm text-muted-foreground">{place}</p> : null}
                  {profile.biography ? (
                    <p className="mt-3 text-sm text-foreground">{excerpt(profile.biography)}</p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
