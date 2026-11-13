"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { createProjectDraft, SAVED_PROJECT_STORAGE_KEY, type ProjectDraftInput } from "@/app/lib/projects";
import ProjectDraftForm from "../ProjectDraftForm";
import { useRequireMember } from "../useRequireMember";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function NewProjectPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const ready = useRequireMember();

  if (!ready) {
    return (
      <div className="wrap py-8">
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="wrap py-8" data-testid="project-create">
      <Link
        href="/mes-projets"
        className={`inline-flex min-h-[44px] items-center text-sm font-medium text-primary ${focusRing}`}
      >
        {t("myProjects.back")}
      </Link>
      <ProjectDraftForm
        heading={t("myProjects.create")}
        onSubmit={async (input: ProjectDraftInput) => {
          const result = await createProjectDraft(input);
          if (!result.ok) return result;
          sessionStorage.setItem(SAVED_PROJECT_STORAGE_KEY, result.project.id);
          router.replace(`/mes-projets/${result.project.id}/modifier`);
          return { ok: true };
        }}
      />
    </div>
  );
}
