"use client";

import { useTranslation } from "@/src/i18n/I18nProvider";
import type { StoredUser } from "@/app/lib/authUser";
import { getGreetingName } from "@/app/lib/authUser";
import DashboardSummaryCards from "./DashboardSummaryCards";
import DashboardQuickActions from "./DashboardQuickActions";
import DashboardRecentActivity from "./DashboardRecentActivity";
import DashboardBadges from "./DashboardBadges";

type Props = {
  user: StoredUser;
};

/**
 * Authenticated user dashboard adapted from Prototypesawakav1
 * ArtisanDashboardScreen — excluded detailed reputation / public profile /
 * progress / challenges sections intentionally.
 */
export default function UserDashboard({ user }: Props) {
  const { t } = useTranslation();
  const name = getGreetingName(user);
  const greeting = name
    ? t("dashboard.greetingNamed", { name })
    : t("dashboard.greetingFallback");

  return (
    <div className="min-h-screen bg-background" data-testid="user-dashboard">
      <div className="border-b border-border bg-card">
        <div className="container mx-auto max-w-6xl px-4 py-8 lg:px-8">
          <h1
            className="mb-2 text-3xl lg:text-4xl"
            data-testid="dashboard-greeting"
          >
            {greeting}
          </h1>
          <p
            className="text-muted-foreground"
            data-testid="dashboard-subtitle"
          >
            {t("dashboard.subtitle")}
          </p>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-6 lg:px-8">
        <DashboardSummaryCards />

        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          <div className="space-y-6 lg:col-span-2">
            <DashboardRecentActivity />
            <DashboardQuickActions variant="mobile" />
          </div>

          <div className="mt-6 space-y-6 lg:mt-0">
            <DashboardQuickActions variant="sidebar" />
            <DashboardBadges />
          </div>
        </div>
      </div>
    </div>
  );
}
