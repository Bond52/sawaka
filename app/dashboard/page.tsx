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

  useEffect(() => {
    const stored = readStoredUser();
    if (!stored) {
      router.replace("/login?redirect=/dashboard");
      return;
    }
    setUser(stored);
    setReady(true);

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
      <UserDashboard user={user} />
    </main>
  );
}
