"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import ContributorDeactivation from "./ContributorDeactivation";
import ContributorProfileConsultation from "./ContributorProfileConsultation";
import ContributorProfileEditor from "./ContributorProfileEditor";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { readStoredUser } from "@/app/lib/authUser";
import {
  classifyOwnProfileResult,
  getOwnContributor,
  type ContributorProfileDetail,
} from "@/app/lib/apiContributors";

/**
 * Authenticated Contributor Profile overview at `/profile`.
 * Uses real ContributorProfile data; empty states for unavailable capabilities.
 * Does not render private User/account fields (email, password, etc.).
 */
export default function ContributorProfilePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ContributorProfileDetail | null>(null);
  const [missingProfile, setMissingProfile] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

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

      const outcome = classifyOwnProfileResult(result);
      switch (outcome.kind) {
        case "success":
          setProfile(outcome.profile);
          setLoading(false);
          return;
        case "missing":
          setMissingProfile(true);
          setProfile(null);
          setLoading(false);
          return;
        case "unauthorized":
          router.replace("/login?redirect=/profile");
          return;
        case "error":
          setError(t("contributorProfile.loadError"));
          setLoading(false);
          return;
      }
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

  return (
    <main
      className="min-h-screen flex-1 bg-white"
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
        {savedNotice && !editing ? (
          <p
            role="status"
            className="mb-6 text-sm text-foreground"
            data-testid="contributor-profile-save-success"
          >
            {t("contributorProfile.edit.success")}
          </p>
        ) : null}

        {editing ? (
          <ContributorProfileEditor
            profile={profile}
            onSaved={(next) => {
              setProfile(next);
              setEditing(false);
              setSavedNotice(true);
            }}
            onDraftPersisted={(next) => setProfile(next)}
            onCancel={() => setEditing(false)}
          />
        ) : null}

        <ContributorProfileConsultation
          profile={profile}
          hideIdentity={editing}
          hideSkills={editing}
          headerAction={
            editing ? null : (
              <button
                type="button"
                className="btn btn-secondary inline-flex shrink-0 items-center gap-2 self-start"
                onClick={() => {
                  setSavedNotice(false);
                  setEditing(true);
                }}
                data-testid="contributor-profile-edit"
              >
                <Pencil className="h-4 w-4" aria-hidden />
                {t("contributorProfile.edit.action")}
              </button>
            )
          }
          footer={
            <ContributorDeactivation
              profile={profile}
              editing={editing}
              onDeactivated={(next) => {
                setProfile(next);
                setEditing(false);
                router.push("/dashboard?profileDeactivated=1");
              }}
              onAlreadyInactive={() => {
                setProfile((current) =>
                  current
                    ? { ...current, status: "Inactive", isVisible: false }
                    : current
                );
                setEditing(false);
              }}
            />
          }
        />
      </div>
    </main>
  );
}
