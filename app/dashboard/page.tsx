"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { readStoredUser, type StoredUser } from "@/app/lib/authUser";
import UserDashboard from "@/app/components/dashboard/UserDashboard";

/**
 * Protected authenticated-user dashboard at `/dashboard`.
 * Unauthenticated visitors are redirected to login with a return URL.
 */
export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [ready, setReady] = useState(false);
  const [profileDeactivated, setProfileDeactivated] = useState(false);

  useEffect(() => {
    const stored = readStoredUser();
    if (!stored) {
      router.replace("/login?redirect=/dashboard");
      return;
    }
    setUser(stored);
    setReady(true);
    const params = new URLSearchParams(window.location.search);
    if (params.get("profileDeactivated") === "1") {
      setProfileDeactivated(true);
      params.delete("profileDeactivated");
      const next = params.toString();
      window.history.replaceState(
        null,
        "",
        next ? `/dashboard?${next}` : "/dashboard"
      );
    }

    const sync = () => {
      const next = readStoredUser();
      if (!next) {
        router.replace("/login?redirect=/dashboard");
        return;
      }
      setUser(next);
    };

    window.addEventListener("storage", sync);
    window.addEventListener("sawaka-auth-changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("sawaka-auth-changed", sync);
    };
  }, [router]);

  if (!ready || !user) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground" data-testid="dashboard-loading">
          {t("common.loading")}
        </p>
      </main>
    );
  }

  return (
    <main>
      {profileDeactivated ? (
        <div className="container mx-auto max-w-5xl px-4 pt-6">
          <p
            role="status"
            className="alert alert-success"
            data-testid="dashboard-profile-deactivated"
          >
            {t("dashboard.profileDeactivated")}
          </p>
        </div>
      ) : null}
      <UserDashboard user={user} />
    </main>
  );
}
