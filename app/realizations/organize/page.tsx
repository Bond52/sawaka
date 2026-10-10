"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Folder, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { readStoredUser } from "@/app/lib/authUser";
import {
  addSelectedToWorkflowGroup,
  createEmptyWorkflowGroup,
  dissolveWorkflowGroup,
  getWorkflowSnapshot,
  groupSelectedIntoOne,
  groupSelectedPerPhoto,
  removeWorkflowPhotos,
  subscribeWorkflow,
  unassignedPhotoIds,
  ungroupWorkflowPhoto,
  type WorkflowView,
} from "@/app/lib/portfolioWorkflow";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const steps = [
  { key: "importStep", state: "complete" },
  { key: "organizeStep", state: "active" },
  { key: "completeStep", state: "upcoming" },
  { key: "reviewStep", state: "upcoming" },
] as const;

export default function OrganizeImportedPhotosPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const [ownerKey, setOwnerKey] = useState("");
  const [workflow, setWorkflow] = useState<WorkflowView>({ status: "empty" });
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    const user = readStoredUser();
    if (!user) {
      router.replace("/login?redirect=/realizations/organize");
      return;
    }
    const key = user.username;
    setOwnerKey(key);
    const apply = () => setWorkflow(getWorkflowSnapshot(key));
    apply();
    setReady(true);
    return subscribeWorkflow(apply);
  }, [router]);

  if (!ready) {
    return (
      <div className="wrap py-16">
        <p className="text-muted-foreground" data-testid="portfolio-organize-loading">
          {t("common.loading")}
        </p>
      </div>
    );
  }

  return (
    <div className="wrap py-8" data-testid="portfolio-organize-page">
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="portfolio-stepper">
        {steps.map((step, index) => (
          <li key={step.key} className="flex items-center gap-3">
            {index > 0 ? <span className="hidden h-px w-8 bg-border sm:block" aria-hidden /> : null}
            <Step
              index={index + 1}
              label={t(`portfolio.organize.${step.key}`)}
              state={step.state}
            />
          </li>
        ))}
      </ol>

      <h1 className="mt-8 font-display text-4xl text-foreground">{t("portfolio.organize.title")}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{t("portfolio.organize.subtitle")}</p>

      {workflow.status !== "ready" ? (
        <div
          className="mt-8 rounded-xl border border-border bg-card p-6"
          data-testid="portfolio-organize-recovery"
          role="status"
        >
          <p className="text-foreground">{t("portfolio.organize.recovery")}</p>
          <Link
            href="/realizations/import"
            data-testid="portfolio-organize-back"
            className={`mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ${focusRing}`}
          >
            {t("portfolio.organize.backToImport")}
          </Link>
        </div>
      ) : (
        <OrganizeWorkspace
          ownerKey={ownerKey}
          workflow={workflow}
          selected={selected}
          setSelected={setSelected}
        />
      )}
    </div>
  );
}

function Step({
  index,
  label,
  state,
}: {
  index: number;
  label: string;
  state: "complete" | "active" | "upcoming";
}) {
  const content = (
    <span className="inline-flex min-h-[44px] items-center gap-2 text-sm">
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
          state === "complete"
            ? "bg-emerald-600 text-white"
            : state === "active"
              ? "bg-primary text-primary-foreground"
              : "border border-border text-muted-foreground"
        }`}
      >
        {state === "complete" ? <Check className="h-4 w-4" aria-hidden /> : index}
      </span>
      <span className={state === "upcoming" ? "text-muted-foreground" : "font-medium text-foreground"}>
        {label}
      </span>
    </span>
  );

  if (state === "complete") {
    return (
      <Link href="/realizations/import" className={`rounded-full ${focusRing}`}>
        {content}
      </Link>
    );
  }

  return (
    <span aria-current={state === "active" ? "step" : undefined} data-step-state={state}>
      {content}
    </span>
  );
}

function OrganizeWorkspace({
  ownerKey,
  workflow,
  selected,
  setSelected,
}: {
  ownerKey: string;
  workflow: Extract<WorkflowView, { status: "ready" }>;
  selected: string[];
  setSelected: (next: string[]) => void;
}) {
  const { t } = useTranslation();
  const grouping = { photos: workflow.photos.map(({ id, name }) => ({ id, name })), groups: workflow.groups };
  const unassigned = unassignedPhotoIds(grouping);
  const unassignedPhotos = unassigned.flatMap((id) => {
    const photo = workflow.photos.find((item) => item.id === id);
    return photo ? [photo] : [];
  });
  const selectedSet = new Set(selected.filter((id) => unassigned.includes(id)));
  const allSelected = unassigned.length > 0 && unassigned.every((id) => selectedSet.has(id));
  const assignedCount = workflow.groups.reduce((total, group) => total + group.photoIds.length, 0);

  function toggle(id: string) {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(unassigned.filter((photoId) => next.has(photoId)));
  }

  return (
    <>
      <div className="mt-8 grid items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.9fr)]">
        <section
          className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5"
          data-testid="portfolio-imported-panel"
          aria-labelledby="imported-photos-heading"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="imported-photos-heading" className="text-xl font-semibold text-foreground">
                {t("portfolio.organize.imported")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground" data-testid="portfolio-unassigned-count">
                {t(
                  unassigned.length === 1
                    ? "portfolio.organize.unassignedOne"
                    : "portfolio.organize.unassignedMany",
                  { count: unassigned.length }
                )}
              </p>
            </div>
            <button
              type="button"
              data-testid="portfolio-select-all"
              className={`min-h-[44px] rounded-md px-2 text-sm font-medium text-primary ${focusRing}`}
              disabled={unassigned.length === 0}
              onClick={() => setSelected(allSelected ? [] : unassigned)}
            >
              {allSelected ? t("portfolio.clearSelection") : t("portfolio.organize.selectAll")}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2" aria-live="polite">
            <span
              className="inline-flex min-h-[44px] items-center rounded-lg bg-primary/15 px-3 text-sm font-semibold text-primary"
              data-testid="portfolio-organize-selected-count"
            >
              {t(
                selectedSet.size === 1 ? "portfolio.organize.selectedOne" : "portfolio.organize.selectedMany",
                { count: selectedSet.size }
              )}
            </span>
            <button
              type="button"
              data-testid="portfolio-group-one"
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 ${focusRing}`}
              disabled={selectedSet.size === 0}
              onClick={() => {
                groupSelectedIntoOne(ownerKey, Array.from(selectedSet));
                setSelected([]);
              }}
            >
              <Folder className="h-4 w-4" aria-hidden />
              {t("portfolio.organize.groupOne")}
            </button>
            <button
              type="button"
              data-testid="portfolio-group-each"
              className={`inline-flex min-h-[44px] items-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground disabled:opacity-50 ${focusRing}`}
              disabled={selectedSet.size === 0}
              onClick={() => {
                groupSelectedPerPhoto(ownerKey, Array.from(selectedSet));
                setSelected([]);
              }}
            >
              {t("portfolio.organize.groupEach")}
            </button>
            <button
              type="button"
              data-testid="portfolio-remove-selected"
              className={`inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border text-foreground disabled:opacity-50 ${focusRing}`}
              disabled={selectedSet.size === 0}
              aria-label={t("portfolio.organize.removeSelected")}
              onClick={() => {
                removeWorkflowPhotos(ownerKey, Array.from(selectedSet));
                setSelected([]);
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {unassignedPhotos.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground" data-testid="portfolio-all-grouped">
              {t("portfolio.organize.allGrouped")}
            </p>
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" data-testid="portfolio-photo-grid">
              {unassignedPhotos.map((photo) => {
                const isSelected = selectedSet.has(photo.id);
                return (
                  <li key={photo.id}>
                    <button
                      type="button"
                      data-testid="portfolio-photo"
                      data-name={photo.name}
                      aria-pressed={isSelected}
                      aria-label={t("portfolio.organize.selectPhoto", { name: photo.name })}
                      className={`relative aspect-square w-full overflow-hidden rounded-xl border-2 text-left ${
                        isSelected ? "border-primary" : "border-border"
                      } ${focusRing}`}
                      onClick={() => toggle(photo.id)}
                    >
                      <span
                        aria-hidden
                        className="absolute inset-0 bg-secondary bg-cover bg-center"
                        style={previewStyle(photo.previewUrl)}
                      />
                      <span
                        aria-hidden
                        className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-transparent"
                        }`}
                      >
                        <Check className="h-4 w-4" />
                      </span>
                      <span className="sr-only">
                        {t(isSelected ? "portfolio.organize.selectedState" : "portfolio.organize.unselectedState")}
                      </span>
                      <span className="absolute inset-x-0 bottom-0 truncate bg-foreground/70 px-2 py-1 text-xs text-background">
                        {photo.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section
          className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5"
          data-testid="portfolio-created-panel"
          aria-labelledby="created-groups-heading"
        >
          <h2 id="created-groups-heading" className="text-xl font-semibold text-foreground">
            {t("portfolio.organize.created")}
          </h2>
          {workflow.groups.length === 0 ? (
            <div className="mt-4" data-testid="portfolio-groups-empty">
              <p className="font-medium text-foreground">{t("portfolio.organize.noGroups")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("portfolio.organize.groupsAppear")}</p>
              <p className="mt-3 text-sm text-muted-foreground">{t("portfolio.organize.groupsHint")}</p>
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground" data-testid="portfolio-groups-summary">
                {`${t(
                  workflow.groups.length === 1
                    ? "portfolio.organize.groupCountOne"
                    : "portfolio.organize.groupCountMany",
                  { count: workflow.groups.length }
                )} · ${t(
                  assignedCount === 1 ? "portfolio.organize.photoCountOne" : "portfolio.organize.photoCountMany",
                  { count: assignedCount }
                )}`}
              </p>
              <ul className="mt-4 space-y-3" aria-live="polite">
                {workflow.groups.map((group) => {
                  const label = t("portfolio.organize.groupLabel", { number: group.sequence });
                  const members = group.photoIds.flatMap((id) => {
                    const photo = workflow.photos.find((item) => item.id === id);
                    return photo ? [photo] : [];
                  });
                  const cover = members[0];
                  return (
                    <li key={group.id}>
                      <article
                        className="rounded-xl border border-border p-3"
                        data-testid="portfolio-group"
                        data-sequence={group.sequence}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            aria-hidden
                            className="h-16 w-16 shrink-0 rounded-lg bg-secondary bg-cover bg-center"
                            style={cover ? previewStyle(cover.previewUrl) : undefined}
                          />
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-foreground">{label}</h3>
                            <p className="text-sm text-muted-foreground">
                              {t(
                                members.length === 1
                                  ? "portfolio.organize.photoCountOne"
                                  : "portfolio.organize.photoCountMany",
                                { count: members.length }
                              )}
                            </p>
                            {members.length > 0 ? (
                              <p className="mt-1 inline-flex items-center gap-1 text-sm text-emerald-700">
                                <Check className="h-4 w-4" aria-hidden />
                                {t("portfolio.organize.grouped")}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <details className="mt-3">
                          <summary
                            className={`cursor-pointer rounded-md text-sm font-medium text-foreground ${focusRing}`}
                            data-testid="portfolio-group-actions"
                          >
                            {t("portfolio.organize.actions", { name: label })}
                          </summary>
                          <div className="mt-2 space-y-2">
                            {members.map((photo) => (
                              <button
                                key={photo.id}
                                type="button"
                                data-testid="portfolio-ungroup-photo"
                                data-name={photo.name}
                                className={`flex min-h-[44px] w-full items-center rounded-md px-2 text-left text-sm text-foreground ${focusRing}`}
                                onClick={() => ungroupWorkflowPhoto(ownerKey, group.id, photo.id)}
                              >
                                {t("portfolio.organize.removeFromGroup", { name: photo.name })}
                              </button>
                            ))}
                            <button
                              type="button"
                              data-testid="portfolio-add-to-group"
                              className={`flex min-h-[44px] w-full items-center rounded-md px-2 text-left text-sm text-foreground disabled:opacity-50 ${focusRing}`}
                              disabled={selectedSet.size === 0}
                              onClick={() => {
                                addSelectedToWorkflowGroup(ownerKey, group.id, Array.from(selectedSet));
                                setSelected([]);
                              }}
                            >
                              {t("portfolio.organize.addSelected")}
                            </button>
                            <button
                              type="button"
                              data-testid="portfolio-dissolve"
                              className={`flex min-h-[44px] w-full items-center rounded-md px-2 text-left text-sm text-destructive ${focusRing}`}
                              onClick={() => dissolveWorkflowGroup(ownerKey, group.id)}
                            >
                              {t("portfolio.organize.dissolve")}
                            </button>
                          </div>
                        </details>
                      </article>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <button
            type="button"
            data-testid="portfolio-new-group"
            className={`mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground ${focusRing}`}
            onClick={() => createEmptyWorkflowGroup(ownerKey)}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("portfolio.organize.newEmpty")}
          </button>
        </section>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/realizations/import"
          data-testid="portfolio-organize-back"
          className={`inline-flex min-h-[44px] items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground ${focusRing}`}
        >
          {t("portfolio.organize.back")}
        </Link>
        <button
          type="button"
          data-testid="portfolio-organize-continue"
          className={`inline-flex min-h-[44px] cursor-not-allowed items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-70 ${focusRing}`}
          aria-disabled="true"
          title={t("dashboard.actionUnavailable")}
          onClick={(event) => event.preventDefault()}
        >
          {t("portfolio.organize.continue")}
        </button>
      </div>
    </>
  );
}

function previewStyle(url: string): { backgroundImage: string } | undefined {
  if (!url.startsWith("blob:")) return undefined;
  return { backgroundImage: `url("${url}")` };
}
