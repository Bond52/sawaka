"use client";

import Link from "next/link";
import { Edit3, Plus, Search, Target } from "lucide-react";
import { useTranslation } from "@/src/i18n/I18nProvider";

type QuickAction = {
  id: string;
  labelKey: string;
  href?: string;
  primary?: boolean;
  icon: "plus" | "search" | "target" | "edit";
};

const ACTIONS: QuickAction[] = [
  {
    id: "add-realization",
    labelKey: "dashboard.actions.addRealization",
    primary: true,
    icon: "plus",
    // Realizations page is not implemented yet
  },
  {
    id: "create-project",
    labelKey: "dashboard.actions.createProject",
    href: "/projets/creer",
    icon: "plus",
  },
  {
    id: "find-supplier",
    labelKey: "dashboard.actions.findSupplier",
    href: "/fournisseurs",
    icon: "search",
  },
  {
    id: "explore-projects",
    labelKey: "dashboard.actions.exploreProjects",
    href: "/projets",
    icon: "target",
  },
  {
    id: "edit-profile",
    labelKey: "dashboard.actions.editProfile",
    href: "/profile",
    icon: "edit",
  },
  {
    id: "create-contributor",
    labelKey: "dashboard.actions.createContributor",
    href: "/contributor/create",
    icon: "plus",
  },
];

function ActionIcon({ icon }: { icon: QuickAction["icon"] }) {
  const className = "h-4 w-4 shrink-0";
  switch (icon) {
    case "search":
      return <Search className={className} aria-hidden />;
    case "target":
      return <Target className={className} aria-hidden />;
    case "edit":
      return <Edit3 className={className} aria-hidden />;
    default:
      return <Plus className={className} aria-hidden />;
  }
}

type Props = {
  /** Desktop sidebar vs mobile grid layout from the prototype */
  variant: "sidebar" | "mobile";
};

export default function DashboardQuickActions({ variant }: Props) {
  const { t } = useTranslation();
  const isSidebar = variant === "sidebar";

  const shellClass = isSidebar
    ? "hidden rounded-lg bg-secondary p-5 lg:block"
    : "rounded-lg bg-secondary p-5 lg:hidden";

  const listClass = isSidebar
    ? "space-y-2"
    : "grid grid-cols-2 gap-3";

  const linkBase =
    "flex min-h-[44px] items-center gap-2 rounded-lg px-4 py-3 text-sm transition-colors";
  const primaryClass = `${linkBase} ${
    isSidebar ? "w-full" : "justify-center"
  } bg-primary text-primary-foreground hover:bg-primary/90`;
  const secondaryClass = `${linkBase} ${
    isSidebar ? "w-full" : "justify-center"
  } border border-border bg-card text-foreground hover:bg-background`;
  const disabledClass = `${linkBase} ${
    isSidebar ? "w-full" : "justify-center"
  } cursor-not-allowed border border-border bg-card/60 text-muted-foreground opacity-70`;

  return (
    <section
      className={shellClass}
      data-testid={`dashboard-quick-actions-${variant}`}
      aria-labelledby={`dashboard-quick-actions-title-${variant}`}
    >
      <h2
        id={`dashboard-quick-actions-title-${variant}`}
        className="mb-4 text-lg font-semibold text-foreground"
      >
        {t("dashboard.actions.title")}
      </h2>
      <div className={listClass}>
        {ACTIONS.map((action) => {
          const content = (
            <>
              <ActionIcon icon={action.icon} />
              {t(action.labelKey)}
            </>
          );

          if (!action.href) {
            return (
              <button
                key={action.id}
                type="button"
                disabled
                className={disabledClass}
                data-testid={`dashboard-action-${action.id}`}
                title={t("dashboard.actionUnavailable")}
                aria-disabled="true"
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={action.id}
              href={action.href}
              className={action.primary ? primaryClass : secondaryClass}
              data-testid={`dashboard-action-${action.id}`}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
