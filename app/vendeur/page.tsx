"use client";

import { useTranslation } from "@/src/i18n/I18nProvider";

export default function VendeurPage() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t("seller.welcome")}</h1>
      <p>{t("seller.connected")}</p>
    </div>
  );
}
