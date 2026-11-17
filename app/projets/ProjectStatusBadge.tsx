"use client";

import { useTranslation } from "@/src/i18n/I18nProvider";
import type { DiscoveryStatus } from "@/app/lib/projects";

const STYLES: Record<DiscoveryStatus, string> = {
  not_started: "border-border bg-secondary text-foreground",
  in_progress: "border-orange-300 bg-orange-50 text-orange-900",
  blocked: "border-red-300 bg-red-50 text-red-900",
  completed: "border-emerald-300 bg-emerald-50 text-emerald-900",
  proposed: "border-sky-300 bg-sky-50 text-sky-900",
};

type ProjectStatusBadgeProps = {
  status: DiscoveryStatus;
  className?: string;
  testId?: string;
};

export default function ProjectStatusBadge({
  status,
  className = "",
  testId = "project-status-badge",
}: ProjectStatusBadgeProps) {
  const { t } = useTranslation();
  return (
    <span
      data-testid={testId}
      data-status={status}
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${STYLES[status]} ${className}`}
    >
      {t(`projects.discoveryStatus.${status}`)}
    </span>
  );
}
