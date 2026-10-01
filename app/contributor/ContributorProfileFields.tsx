"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  listContributorDomains,
  listContributorSkills,
  taxonomyLabel,
  type ContributorProfileDetail,
  type TaxonomyItem,
} from "@/app/lib/apiContributors";
import {
  BIOGRAPHY_MAX,
  CUSTOM_SKILL_MAX,
  MAX_CUSTOM_SKILLS,
  MAX_SELECTED_SKILLS,
  type ContributorFieldErrors,
} from "@/app/lib/contributorValidation";

export type ContributorProfileFieldValues = {
  displayName: string;
  domainId: string;
  skillIds: string[];
  customSkills: string[];
  country: string;
  region: string;
  city: string;
  biography: string;
};

type SkillsState = "idle" | "loading" | "error" | "ready";

function messageFor(
  code: string,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  const key = `contributor.create.errors.${code}`;
  const message = t(key);
  return message === key ? t("contributor.create.errors.generic") : message;
}

export function useContributorProfileFields(
  fieldErrors: ContributorFieldErrors,
  setFieldErrors: Dispatch<SetStateAction<ContributorFieldErrors>>
) {
  const [displayName, setDisplayName] = useState("");
  const [domainId, setDomainId] = useState("");
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [customSkills, setCustomSkills] = useState<string[]>([]);
  const [customDraft, setCustomDraft] = useState("");
  const [customDraftError, setCustomDraftError] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [biography, setBiography] = useState("");
  const [domains, setDomains] = useState<TaxonomyItem[]>([]);
  const [domainsError, setDomainsError] = useState(false);
  const [skills, setSkills] = useState<TaxonomyItem[]>([]);
  const [skillsState, setSkillsState] = useState<SkillsState>("idle");
  const [selectedSkills, setSelectedSkills] = useState<TaxonomyItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadDomains() {
      const result = await listContributorDomains();
      if (cancelled) return;
      if (!result.ok) {
        setDomainsError(true);
        return;
      }
      setDomains(result.domains);
      setDomainsError(false);
    }
    loadDomains();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!domainId) {
      setSkills([]);
      setSkillsState("idle");
      return;
    }
    let cancelled = false;
    setSkillsState("loading");
    listContributorSkills(domainId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setSkills([]);
        setSkillsState("error");
        return;
      }
      setSkills(result.skills);
      setSkillsState("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [domainId]);

  function onDomainChange(nextDomainId: string) {
    setDomainId(nextDomainId);
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.domainId;
      return next;
    });
  }

  function toggleSkill(skill: TaxonomyItem) {
    const skillId = skill.id;
    if (skillIds.includes(skillId)) {
      setSkillIds(skillIds.filter((id) => id !== skillId));
      setSelectedSkills((current) => current.filter((item) => item.id !== skillId));
      return;
    }
    if (skillIds.length + customSkills.length >= MAX_SELECTED_SKILLS) {
      setFieldErrors((errors) => ({ ...errors, skillIds: "SKILL_LIMIT" }));
      return;
    }
    setFieldErrors((errors) => {
      const next = { ...errors };
      delete next.skillIds;
      return next;
    });
    setSkillIds([...skillIds, skillId]);
    setSelectedSkills((current) =>
      current.some((item) => item.id === skillId) ? current : [...current, skill]
    );
  }

  function addCustomSkill() {
    const label = customDraft.trim();
    if (!label) {
      setCustomDraftError("CUSTOM_SKILL_INVALID");
      return;
    }
    if (label.length > CUSTOM_SKILL_MAX) {
      setCustomDraftError("CUSTOM_SKILL_LENGTH");
      return;
    }
    const key = label.toLocaleLowerCase();
    if (customSkills.some((item) => item.toLocaleLowerCase() === key)) {
      setCustomDraftError("CUSTOM_SKILL_DUPLICATE");
      return;
    }
    if (customSkills.length >= MAX_CUSTOM_SKILLS) {
      setCustomDraftError("CUSTOM_SKILL_LIMIT");
      return;
    }
    if (skillIds.length + customSkills.length >= MAX_SELECTED_SKILLS) {
      setCustomDraftError("SKILL_LIMIT");
      return;
    }
    setCustomSkills((current) => [...current, label]);
    setCustomDraft("");
    setCustomDraftError("");
    setFieldErrors((errors) => {
      const next = { ...errors };
      delete next.customSkills;
      delete next.skillIds;
      return next;
    });
  }

  function removeCustomSkill(label: string) {
    setCustomSkills((current) => current.filter((item) => item !== label));
  }

  function snapshot(): ContributorProfileFieldValues {
    return {
      displayName,
      domainId,
      skillIds,
      customSkills,
      country,
      region,
      city,
      biography,
    };
  }

  function seedFromProfile(profile: ContributorProfileDetail) {
    const canonical = (profile.skills || []).filter(
      (skill) => !skill.isCustom && skill.id
    );
    setDisplayName(profile.displayName || "");
    setDomainId(profile.domain?.id || "");
    setSkillIds(canonical.map((skill) => skill.id as string));
    setSelectedSkills(
      canonical.map((skill) => ({
        id: skill.id as string,
        nameFR: skill.nameFR || "",
        nameEN: skill.nameEN || "",
      }))
    );
    setCustomSkills(
      (profile.skills || [])
        .filter((skill) => skill.isCustom)
        .map((skill) => (skill.customLabel || "").trim())
        .filter(Boolean)
    );
    setCustomDraft("");
    setCustomDraftError("");
    setCountry(profile.country || "");
    setRegion(profile.region || "");
    setCity(profile.city || "");
    setBiography(profile.biography || "");
  }

  return {
    setDisplayName,
    snapshot,
    seedFromProfile,
    fieldProps: {
      displayName,
      domainId,
      skillIds,
      selectedSkills,
      customSkills,
      customDraft,
      customDraftError,
      country,
      region,
      city,
      biography,
      domains,
      domainsError,
      skills,
      skillsState,
      fieldErrors,
      onDisplayNameChange: setDisplayName,
      onDomainChange,
      onToggleSkill: toggleSkill,
      onCustomDraftChange: (value: string) => {
        setCustomDraft(value);
        setCustomDraftError("");
      },
      onAddCustomSkill: addCustomSkill,
      onRemoveCustomSkill: removeCustomSkill,
      onCountryChange: setCountry,
      onRegionChange: setRegion,
      onCityChange: setCity,
      onBiographyChange: setBiography,
    },
  };
}

type FieldProps = ReturnType<typeof useContributorProfileFields>["fieldProps"] & {
  showIntro?: boolean;
};

export function ContributorProfileFields({
  displayName,
  domainId,
  skillIds,
  selectedSkills,
  customSkills,
  customDraft,
  customDraftError,
  country,
  region,
  city,
  biography,
  domains,
  domainsError,
  skills,
  skillsState,
  fieldErrors,
  onDisplayNameChange,
  onDomainChange,
  onToggleSkill,
  onCustomDraftChange,
  onAddCustomSkill,
  onRemoveCustomSkill,
  onCountryChange,
  onRegionChange,
  onCityChange,
  onBiographyChange,
  showIntro = true,
}: FieldProps) {
  const { locale, t } = useTranslation();
  const labelClass = "field-label";
  const inputClass = "field";

  function fieldError(field: string) {
    const code = fieldErrors[field];
    if (!code) return null;
    return (
      <p id={`err-${field}`} className="text-sm text-destructive" role="alert">
        {messageFor(code, t)}
      </p>
    );
  }

  function removableSkillChip(label: string, onRemove: () => void, testId?: string) {
    return (
      <button
        type="button"
        data-testid={testId}
        className="min-h-[44px] rounded-full border border-border bg-secondary px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        onClick={onRemove}
        aria-pressed={testId ? true : undefined}
        aria-label={t("contributor.create.customRemove", { label })}
      >
        {label} ×
      </button>
    );
  }

  return (
    <fieldset className="space-y-4">
      {showIntro ? (
        <>
          <legend className="font-display text-lg font-semibold text-foreground">
            {t("contributor.create.profileSection")}
          </legend>
          <p className="text-sm text-muted-foreground">
            {t("contributor.create.profileHint")}
          </p>
        </>
      ) : (
        <legend className="sr-only">{t("contributor.create.profileSection")}</legend>
      )}

      <div className="space-y-2">
        <label htmlFor="contributor-display-name" className={labelClass}>
          {t("contributor.create.displayName")}
        </label>
        <input
          id="contributor-display-name"
          className={inputClass}
          value={displayName}
          maxLength={80}
          aria-invalid={Boolean(fieldErrors.displayName)}
          aria-describedby={
            fieldErrors.displayName
              ? "err-displayName contributor-display-hint"
              : "contributor-display-hint"
          }
          onChange={(event) => onDisplayNameChange(event.target.value)}
        />
        <p id="contributor-display-hint" className="text-sm text-muted-foreground">
          {t("contributor.create.displayNameHint")}
        </p>
        {fieldError("displayName")}
      </div>

      <div className="space-y-2">
        <label htmlFor="contributor-domain" className={labelClass}>
          {t("contributor.create.domain")}
        </label>
        {domainsError ? (
          <p role="alert" className="text-sm text-destructive">
            {t("contributor.create.taxonomyError")}
          </p>
        ) : (
          <select
            id="contributor-domain"
            className={inputClass}
            value={domainId}
            aria-invalid={Boolean(fieldErrors.domainId)}
            aria-describedby={fieldErrors.domainId ? "err-domainId" : undefined}
            onChange={(event) => onDomainChange(event.target.value)}
          >
            <option value="">{t("contributor.create.domainPlaceholder")}</option>
            {domains.map((domain) => (
              <option key={domain.id} value={domain.id}>
                {taxonomyLabel(domain, locale)}
              </option>
            ))}
          </select>
        )}
        {fieldError("domainId")}
      </div>

      <div className="space-y-2">
        <fieldset
          id="contributor-skills"
          tabIndex={-1}
          className="space-y-3"
          aria-invalid={Boolean(fieldErrors.skillIds)}
          aria-describedby="contributor-skills-hint"
        >
          <legend className={labelClass}>{t("contributor.create.skills")}</legend>
          <p id="contributor-skills-hint" className="text-sm text-muted-foreground">
            {t("contributor.create.skillsHint")}
          </p>
          {!domainId && (
            <p className="text-sm text-muted-foreground">
              {t("contributor.create.skillsNeedDomain")}
            </p>
          )}
          {skillsState === "loading" && (
            <p role="status" className="text-sm text-muted-foreground">
              {t("contributor.create.skillsLoading")}
            </p>
          )}
          {skillsState === "error" && (
            <p role="alert" className="text-sm text-destructive">
              {t("contributor.create.skillsError")}
            </p>
          )}
          {skillsState === "ready" && skills.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("contributor.create.skillsEmpty")}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => {
              const selected = skillIds.includes(skill.id);
              return (
                <button
                  key={skill.id}
                  type="button"
                  data-testid={`contributor-skill-${skill.id}`}
                  aria-pressed={selected}
                  className={`min-h-[44px] rounded-full border px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    selected
                      ? "border-primary bg-primary/10 font-semibold text-foreground"
                      : "border-border bg-card text-foreground"
                  }`}
                  onClick={() => onToggleSkill(skill)}
                >
                  {taxonomyLabel(skill, locale)}
                </button>
              );
            })}
          </div>
          {selectedSkills.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {selectedSkills.map((skill) => (
                <li key={skill.id}>
                  {removableSkillChip(
                    taxonomyLabel(skill, locale),
                    () => onToggleSkill(skill),
                    `contributor-selected-${skill.id}`
                  )}
                </li>
              ))}
            </ul>
          )}
        </fieldset>
        {fieldError("skillIds")}
      </div>

      <div className="space-y-2">
        <label htmlFor="contributor-custom-skill" className={labelClass}>
          {t("contributor.create.customSkills")}
        </label>
        <p className="text-sm text-muted-foreground">{t("contributor.create.customHint")}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="contributor-custom-skill"
            className={inputClass}
            value={customDraft}
            maxLength={CUSTOM_SKILL_MAX}
            aria-invalid={Boolean(customDraftError || fieldErrors.customSkills)}
            aria-describedby={
              customDraftError || fieldErrors.customSkills ? "err-customSkills" : undefined
            }
            placeholder={t("contributor.create.customPlaceholder")}
            onChange={(event) => onCustomDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAddCustomSkill();
              }
            }}
          />
          <button
            type="button"
            className="btn btn-secondary shrink-0"
            onClick={onAddCustomSkill}
            data-testid="contributor-add-custom-skill"
          >
            {t("contributor.create.customAdd")}
          </button>
        </div>
        {(customDraftError || fieldErrors.customSkills) && (
          <p id="err-customSkills" className="text-sm text-destructive" role="alert">
            {messageFor(customDraftError || fieldErrors.customSkills || "", t)}
          </p>
        )}
        {customSkills.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {customSkills.map((label) => (
              <li key={label}>
                {removableSkillChip(label, () => onRemoveCustomSkill(label))}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="contributor-country" className={labelClass}>
            {t("contributor.create.country")}
          </label>
          <input
            id="contributor-country"
            className={inputClass}
            autoComplete="country-name"
            value={country}
            maxLength={120}
            aria-invalid={Boolean(fieldErrors.country)}
            aria-describedby={fieldErrors.country ? "err-country" : undefined}
            onChange={(event) => onCountryChange(event.target.value)}
          />
          {fieldError("country")}
        </div>
        <div className="space-y-2">
          <label htmlFor="contributor-region" className={labelClass}>
            {t("contributor.create.region")}
          </label>
          <input
            id="contributor-region"
            className={inputClass}
            value={region}
            maxLength={120}
            aria-invalid={Boolean(fieldErrors.region)}
            aria-describedby={
              fieldErrors.region
                ? "err-region contributor-region-hint"
                : "contributor-region-hint"
            }
            onChange={(event) => onRegionChange(event.target.value)}
          />
          <p id="contributor-region-hint" className="text-sm text-muted-foreground">
            {t("contributor.create.regionHint")}
          </p>
          {fieldError("region")}
        </div>
        <div className="space-y-2">
          <label htmlFor="contributor-city" className={labelClass}>
            {t("contributor.create.city")}
          </label>
          <input
            id="contributor-city"
            className={inputClass}
            autoComplete="address-level2"
            value={city}
            maxLength={120}
            aria-invalid={Boolean(fieldErrors.city)}
            aria-describedby={
              fieldErrors.city ? "err-city contributor-city-hint" : "contributor-city-hint"
            }
            onChange={(event) => onCityChange(event.target.value)}
          />
          <p id="contributor-city-hint" className="text-sm text-muted-foreground">
            {t("contributor.create.cityHint")}
          </p>
          {fieldError("city")}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="contributor-biography" className={labelClass}>
          {t("contributor.create.biography")}
        </label>
        <textarea
          id="contributor-biography"
          className={`${inputClass} min-h-32`}
          value={biography}
          maxLength={BIOGRAPHY_MAX}
          aria-invalid={Boolean(fieldErrors.biography)}
          aria-describedby="contributor-biography-hint"
          onChange={(event) => onBiographyChange(event.target.value)}
        />
        <p id="contributor-biography-hint" className="text-sm text-muted-foreground">
          {t("contributor.create.biographyHint", {
            count: biography.length,
            max: BIOGRAPHY_MAX,
          })}
        </p>
        {fieldError("biography")}
      </div>
    </fieldset>
  );
}
