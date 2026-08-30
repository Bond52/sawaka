"use client";

import Link from "next/link";
import { useTranslation } from "@/src/i18n/I18nProvider";

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="bg-foreground py-6 text-sm text-white">
      <div className="wrap flex flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex items-center gap-3">
          <span>
            © {new Date().getFullYear()} {t("common.brand")}
          </span>
          <span className="opacity-50">|</span>
          <span>{t("common.cameroon")}</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
          <Link
            href="/notre-mission"
            className="!text-white transition-colors hover:!text-primary hover:underline"
          >
            {t("footer.mission")}
          </Link>
          <Link
            href="/terms"
            className="!text-white transition-colors hover:!text-primary hover:underline"
          >
            {t("footer.terms")}
          </Link>
          <Link
            href="/privacy"
            className="!text-white transition-colors hover:!text-primary hover:underline"
          >
            {t("footer.privacy")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
