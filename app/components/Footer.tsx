"use client";

import Link from "next/link";
import { useTranslation } from "@/src/i18n/I18nProvider";

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="bg-sawaka-900 text-sm">
      <div className="wrap flex flex-col md:flex-row items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-3 text-white">
          <span>
            © {new Date().getFullYear()} {t("common.brand")}
          </span>
          <span className="opacity-50">|</span>
          <span>{t("common.cameroon")}</span>
        </div>

        <div className="flex flex-wrap items-center gap-5 justify-center">
          <Link
            href="/notre-mission"
            className="!text-white hover:underline hover:!text-white"
          >
            {t("footer.mission")}
          </Link>
          <Link
            href="/conditions-utilisation"
            className="!text-white hover:underline hover:!text-white"
          >
            {t("footer.terms")}
          </Link>
          <Link
            href="/confidentialite"
            className="!text-white hover:underline hover:!text-white"
          >
            {t("footer.privacy")}
          </Link>
          <Link
            href="/publicite"
            className="!text-white hover:underline hover:!text-white"
          >
            {t("footer.advertising")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
