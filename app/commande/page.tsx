"use client";

import { useTranslation } from "@/src/i18n/I18nProvider";

export default function Paiement() {
  const { t } = useTranslation();

  return (
    <main className="p-6">
      <h1 className="text-3xl font-semibold mb-4">{t("payment.title")}</h1>
      <p>{t("payment.comingSoon")}</p>
    </main>
  );
}
