"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ContributorProfileConsultation from "@/app/profile/ContributorProfileConsultation";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  getPublicContributor,
  type ContributorProfileDetail,
} from "@/app/lib/apiContributors";

export default function PublicContributorPage() {
  const { t } = useTranslation();
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ContributorProfileDetail | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    getPublicContributor(id).then((result) => {
      if (cancelled) return;
      setProfile(result.ok ? result.profile : null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center bg-white">
        <p className="text-muted-foreground" data-testid="contributor-profile-loading">
          {t("common.loading")}
        </p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen flex-1 bg-white" data-testid="contributor-profile-unavailable">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <Link
            href="/reseau"
            className="mb-8 inline-flex text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ← {t("contributorDirectory.back")}
          </Link>
          <p className="text-muted-foreground">{t("contributorDirectory.unavailable")}</p>
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
          href="/reseau"
          className="mb-8 inline-flex text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="contributor-public-back"
        >
          ← {t("contributorDirectory.back")}
        </Link>
        <ContributorProfileConsultation profile={profile} />
      </div>
    </main>
  );
}
