"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Lightbulb, Sparkles } from "lucide-react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  PROJECT_CATEGORY_OPTIONS,
  PROJECT_COUNTRY_OPTIONS,
  projectCategoryLabel,
  projectCountryLabel,
} from "@/app/lib/projectReferenceData";
import { readStoredUser } from "@/app/lib/authUser";
import {
  convertIdeaPayloadToProject,
  deleteSavedProjectIdea,
  generateProjectIdeas,
  listSavedProjectIdeas,
  saveProjectIdea,
  storeIdeaPrefill,
  type GeneratedIdea,
  type IdeationCriteria,
} from "@/app/lib/projectIdeas";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const EMPTY_CRITERIA: IdeationCriteria = {
  interests: "",
  objective: "",
  category: "",
  skills: "",
  country: "",
  city: "",
  budgetAmount: "",
  budgetCurrency: "XAF",
  resources: "",
  constraints: "",
};

export default function CreerProjetPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [criteria, setCriteria] = useState<IdeationCriteria>(EMPTY_CRITERIA);
  const [ideas, setIdeas] = useState<GeneratedIdea[]>([]);
  const [saved, setSaved] = useState<GeneratedIdea[]>([]);
  const [view, setView] = useState<"form" | "results">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 0: true });
  const [refineText, setRefineText] = useState<Record<number, string>>({});
  const [busyIdea, setBusyIdea] = useState<string>("");
  const signedIn = Boolean(readStoredUser());

  const localeCode = locale === "en" ? "en" : "fr";

  useEffect(() => {
    if (!signedIn) return;
    listSavedProjectIdeas().then((result) => {
      if (result.ok) setSaved(result.ideas);
    });
  }, [signedIn]);

  const categoryOptions = useMemo(() => PROJECT_CATEGORY_OPTIONS, []);
  const countryOptions = useMemo(() => PROJECT_COUNTRY_OPTIONS, []);

  const runGenerate = async (extra: Partial<IdeationCriteria> = {}) => {
    setLoading(true);
    setError("");
    const payload = {
      ...criteria,
      ...extra,
      locale: localeCode as "fr" | "en",
      limit: 3,
    };
    const result = await generateProjectIdeas(payload);
    setLoading(false);
    if (!result.ok) {
      setError(
        result.code === "RATE_LIMIT"
          ? t("projects.ideation.errorRateLimit")
          : t("projects.ideation.errorGeneric")
      );
      return;
    }
    setIdeas(result.ideas);
    setView("results");
    setExpanded({ 0: true });
  };

  const onSave = async (idea: GeneratedIdea, index: number) => {
    if (!signedIn) {
      storeIdeaPrefill(idea);
      router.push(`/login?next=${encodeURIComponent("/projets/creer")}`);
      return;
    }
    setBusyIdea(`save-${index}`);
    const result = await saveProjectIdea(idea, criteria, localeCode);
    setBusyIdea("");
    if (!result.ok) {
      if (result.status === 401) {
        storeIdeaPrefill(idea);
        router.push(`/login?next=${encodeURIComponent("/projets/creer")}`);
        return;
      }
      setError(t("projects.ideation.errorGeneric"));
      return;
    }
    setSaved((current) => [result.idea, ...current.filter((item) => item.id !== result.idea.id)]);
  };

  const onCreateProject = async (idea: GeneratedIdea) => {
    if (!signedIn) {
      storeIdeaPrefill(idea);
      router.push(`/login?next=${encodeURIComponent("/mes-projets/nouveau")}`);
      return;
    }
    setBusyIdea(`create-${idea.title}`);
    // Prefer client-side prefill into the existing editor so the user reviews before publish.
    storeIdeaPrefill(idea);
    const converted = await convertIdeaPayloadToProject(idea);
    setBusyIdea("");
    if (converted.ok && converted.project?.id) {
      clearAndGoEdit(converted.project.id);
      return;
    }
    // Fallback: open new project form with prefilled session data.
    router.push("/mes-projets/nouveau?fromIdea=1");
  };

  const clearAndGoEdit = (projectId: string) => {
    router.push(`/mes-projets/${projectId}/modifier`);
  };

  const onDeleteSaved = async (id: string) => {
    const result = await deleteSavedProjectIdea(id);
    if (result.ok) setSaved((current) => current.filter((item) => item.id !== id));
  };

  return (
    <div className="wrap py-8 sm:py-12" data-testid="project-ideation">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" aria-hidden />
          <h1 className="font-display text-3xl text-foreground">
            {t("projects.ideation.title")}
          </h1>
        </div>
        <p className="mb-8 text-muted-foreground">{t("projects.ideation.subtitle")}</p>

        {signedIn && saved.length > 0 ? (
          <section className="mb-10 rounded-2xl border border-border bg-card p-4" data-testid="saved-ideas">
            <h2 className="text-lg font-semibold">{t("projects.ideation.savedIdeas")}</h2>
            <ul className="mt-3 space-y-2">
              {saved.map((idea) => (
                <li key={idea.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 last:border-0">
                  <span className="font-medium text-foreground">{idea.title}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={`min-h-[40px] rounded-lg border border-border px-3 text-sm ${focusRing}`}
                      onClick={() => {
                        setIdeas([idea]);
                        setView("results");
                      }}
                    >
                      {t("projects.ideation.expand")}
                    </button>
                    <button
                      type="button"
                      className={`min-h-[40px] rounded-lg px-3 text-sm text-destructive ${focusRing}`}
                      onClick={() => idea.id && onDeleteSaved(idea.id)}
                    >
                      {t("projects.ideation.delete")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {view === "form" ? (
          <form
            className="space-y-4"
            data-testid="ideation-form"
            onSubmit={(event) => {
              event.preventDefault();
              void runGenerate();
            }}
          >
            <Field
              id="interests"
              label={t("projects.ideation.interests")}
              value={criteria.interests}
              placeholder={t("projects.ideation.interestsPlaceholder")}
              onChange={(value) => setCriteria((c) => ({ ...c, interests: value }))}
            />
            <Field
              id="objective"
              label={t("projects.ideation.objective")}
              value={criteria.objective}
              placeholder={t("projects.ideation.objectivePlaceholder")}
              onChange={(value) => setCriteria((c) => ({ ...c, objective: value }))}
            />
            <div>
              <label htmlFor="category" className="mb-2 block text-sm font-medium">
                {t("projects.ideation.category")}
              </label>
              <select
                id="category"
                data-testid="ideation-category"
                className={`h-11 w-full rounded-xl border border-border bg-card px-3 text-sm ${focusRing}`}
                value={criteria.category}
                onChange={(event) => setCriteria((c) => ({ ...c, category: event.target.value }))}
              >
                <option value="">{t("projects.ideation.anyCategory")}</option>
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {projectCategoryLabel(option.value, localeCode)}
                  </option>
                ))}
              </select>
            </div>
            <Field
              id="skills"
              label={t("projects.ideation.skills")}
              value={criteria.skills}
              placeholder={t("projects.ideation.skillsPlaceholder")}
              onChange={(value) => setCriteria((c) => ({ ...c, skills: value }))}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="country" className="mb-2 block text-sm font-medium">
                  {t("projects.ideation.country")}
                </label>
                <select
                  id="country"
                  data-testid="ideation-country"
                  className={`h-11 w-full rounded-xl border border-border bg-card px-3 text-sm ${focusRing}`}
                  value={criteria.country}
                  onChange={(event) => setCriteria((c) => ({ ...c, country: event.target.value }))}
                >
                  <option value="">{t("projects.ideation.anyCountry")}</option>
                  {countryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {projectCountryLabel(option.value, localeCode)}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                id="city"
                label={t("projects.ideation.city")}
                value={criteria.city}
                placeholder={t("projects.ideation.cityPlaceholder")}
                onChange={(value) => setCriteria((c) => ({ ...c, city: value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="budgetAmount"
                label={t("projects.ideation.budgetAmount")}
                value={criteria.budgetAmount}
                inputMode="numeric"
                onChange={(value) =>
                  setCriteria((c) => ({ ...c, budgetAmount: value.replace(/\D/g, "") }))
                }
              />
              <div>
                <label htmlFor="budgetCurrency" className="mb-2 block text-sm font-medium">
                  {t("projects.ideation.budgetCurrency")}
                </label>
                <select
                  id="budgetCurrency"
                  className={`h-11 w-full rounded-xl border border-border bg-card px-3 text-sm ${focusRing}`}
                  value={criteria.budgetCurrency}
                  onChange={(event) =>
                    setCriteria((c) => ({ ...c, budgetCurrency: event.target.value }))
                  }
                >
                  {["XAF", "CAD", "USD", "EUR"].map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Field
              id="resources"
              label={t("projects.ideation.resources")}
              value={criteria.resources}
              placeholder={t("projects.ideation.resourcesPlaceholder")}
              onChange={(value) => setCriteria((c) => ({ ...c, resources: value }))}
            />
            <Field
              id="constraints"
              label={t("projects.ideation.constraints")}
              value={criteria.constraints}
              placeholder={t("projects.ideation.constraintsPlaceholder")}
              onChange={(value) => setCriteria((c) => ({ ...c, constraints: value }))}
            />

            {error ? (
              <p role="alert" className="text-sm text-destructive" data-testid="ideation-error">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              data-testid="ideation-generate"
              disabled={loading}
              className={`inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60 ${focusRing}`}
            >
              <Lightbulb className="h-4 w-4" aria-hidden />
              {loading ? t("projects.ideation.generating") : t("projects.ideation.generate")}
            </button>
            {loading ? (
              <p className="text-center text-sm text-muted-foreground" data-testid="ideation-progress">
                {t("projects.ideation.generateProgress")}
              </p>
            ) : null}
          </form>
        ) : (
          <div data-testid="ideation-results">
            <button
              type="button"
              className={`mb-4 text-sm font-medium text-primary ${focusRing}`}
              onClick={() => setView("form")}
            >
              ← {t("projects.ideation.backToForm")}
            </button>
            <h2 className="text-2xl font-semibold text-foreground">
              {t("projects.ideation.resultsTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("projects.ideation.resultsHint")}</p>

            <div className="mt-6 space-y-4">
              {ideas.map((idea, index) => {
                const open = Boolean(expanded[index]);
                return (
                  <article
                    key={`${idea.title}-${index}`}
                    className="rounded-2xl border border-border bg-card p-5"
                    data-testid={`idea-card-${index}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {t("projects.ideation.aiSuggestion")}
                        </p>
                        <h3 className="mt-1 text-xl font-semibold text-foreground">{idea.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {[
                            idea.category
                              ? projectCategoryLabel(idea.category, localeCode)
                              : "",
                            idea.city,
                            idea.country ? projectCountryLabel(idea.country, localeCode) : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-expanded={open}
                        className={`inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-border px-3 text-sm ${focusRing}`}
                        onClick={() =>
                          setExpanded((current) => ({ ...current, [index]: !open }))
                        }
                      >
                        {open ? t("projects.ideation.collapse") : t("projects.ideation.expand")}
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                          aria-hidden
                        />
                      </button>
                    </div>
                    <p className="mt-3 text-sm text-foreground">{idea.summary}</p>

                    {open ? (
                      <div className="mt-4 space-y-4">
                        <p className="text-sm text-muted-foreground">{idea.objective}</p>
                        {idea.relevance ? (
                          <Block title={t("projects.ideation.relevance")} text={idea.relevance} />
                        ) : null}
                        {idea.budgetNotes ? (
                          <Block title={t("projects.ideation.budgetNotes")} text={idea.budgetNotes} />
                        ) : null}
                        {idea.challenges?.length ? (
                          <div>
                            <h4 className="text-sm font-semibold">{t("projects.ideation.challenges")}</h4>
                            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
                              {idea.challenges.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        <div>
                          <h4 className="text-sm font-semibold">{t("projects.ideation.stages")}</h4>
                          <ol className="mt-2 space-y-3">
                            {idea.stages.map((stage, stageIndex) => (
                              <li
                                key={`${stage.title}-${stageIndex}`}
                                className="rounded-xl border border-border/80 bg-background p-3"
                                data-testid={`idea-stage-${index}-${stageIndex}`}
                              >
                                <p className="font-medium text-foreground">
                                  {stageIndex + 1}. {stage.title}
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">{stage.description}</p>
                                <div className="mt-3 space-y-2">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    {t("projects.ideation.needs")}
                                  </p>
                                  {stage.needs.map((need, needIndex) => (
                                    <div
                                      key={`${need.title}-${needIndex}`}
                                      className="rounded-lg border border-dashed border-border p-3"
                                      data-testid={`idea-need-${index}-${stageIndex}-${needIndex}`}
                                    >
                                      <p className="text-sm font-medium">
                                        {need.title}{" "}
                                        <span className="text-xs text-muted-foreground">({need.kind})</span>
                                      </p>
                                      <p className="mt-1 text-sm text-muted-foreground">{need.description}</p>
                                      <MatchList
                                        title={t("projects.ideation.contributors")}
                                        items={need.matchedContributors}
                                        empty={t("projects.ideation.emptyMatches")}
                                        verifiedLabel={t("projects.ideation.verifiedMatch")}
                                      />
                                      <MatchList
                                        title={t("projects.ideation.suppliers")}
                                        items={need.matchedSuppliers}
                                        empty={t("projects.ideation.emptyMatches")}
                                        verifiedLabel={t("projects.ideation.verifiedMatch")}
                                      />
                                      {need.missingCapabilities?.length ? (
                                        <div className="mt-2">
                                          <p className="text-xs font-semibold text-amber-800">
                                            {t("projects.ideation.missing")}
                                          </p>
                                          <ul className="mt-1 list-disc pl-5 text-xs text-amber-900">
                                            {need.missingCapabilities.map((item) => (
                                              <li key={item}>{item}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              </li>
                            ))}
                          </ol>
                        </div>

                        <div className="space-y-2">
                          <label
                            htmlFor={`refine-${index}`}
                            className="block text-sm font-medium"
                          >
                            {t("projects.ideation.refineLabel")}
                          </label>
                          <input
                            id={`refine-${index}`}
                            data-testid={`ideation-refine-${index}`}
                            className={`h-11 w-full rounded-xl border border-border px-3 text-sm ${focusRing}`}
                            value={refineText[index] || ""}
                            placeholder={t("projects.ideation.refinePlaceholder")}
                            onChange={(event) =>
                              setRefineText((current) => ({
                                ...current,
                                [index]: event.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            data-testid={`ideation-refine-submit-${index}`}
                            className={`min-h-[44px] rounded-xl border border-border px-4 text-sm font-medium ${focusRing}`}
                            onClick={() =>
                              void runGenerate({
                                refineInstruction: refineText[index] || "",
                                focusTitle: idea.title,
                                limit: 1,
                              })
                            }
                          >
                            {t("projects.ideation.refineAction")}
                          </button>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            data-testid={`ideation-save-${index}`}
                            className={`min-h-[44px] flex-1 rounded-xl border border-border px-4 text-sm font-medium ${focusRing}`}
                            onClick={() => void onSave(idea, index)}
                            disabled={busyIdea === `save-${index}`}
                          >
                            {busyIdea === `save-${index}`
                              ? t("projects.ideation.saving")
                              : signedIn
                                ? t("projects.ideation.save")
                                : t("projects.ideation.loginToSave")}
                          </button>
                          <button
                            type="button"
                            data-testid={`ideation-create-${index}`}
                            className={`min-h-[44px] flex-1 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground ${focusRing}`}
                            onClick={() => void onCreateProject(idea)}
                            disabled={busyIdea.startsWith("create-")}
                          >
                            {t("projects.ideation.createProject")}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>

            <button
              type="button"
              data-testid="ideation-alternatives"
              className={`mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-border px-4 text-sm font-medium ${focusRing}`}
              onClick={() => void runGenerate()}
              disabled={loading}
            >
              {t("projects.ideation.alternatives")}
            </button>
            {error ? (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        )}

        <p className="mt-10 text-center text-sm text-muted-foreground">
          <Link href="/mes-projets/nouveau" className={`text-primary underline-offset-4 hover:underline ${focusRing}`}>
            {t("myProjects.create")}
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        data-testid={`ideation-${id}`}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        className={`h-11 w-full rounded-xl border border-border bg-card px-3 text-sm ${focusRing}`}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function MatchList({
  title,
  items,
  empty,
  verifiedLabel,
}: {
  title: string;
  items: { id: string; label: string; detail: string; location: string; href: string }[];
  empty: string;
  verifiedLabel: string;
}) {
  return (
    <div className="mt-2">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {items.map((item) => (
            <li key={item.id} className="text-xs">
              <Link href={item.href} className={`font-medium text-primary ${focusRing}`}>
                {item.label}
              </Link>
              <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-800">
                {verifiedLabel}
              </span>
              <span className="mt-0.5 block text-muted-foreground">
                {[item.detail, item.location].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
