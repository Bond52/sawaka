"use client";

import { useTranslation } from "@/src/i18n/I18nProvider";

export default function DebugPage() {
  const { t } = useTranslation();

  return (
    <div style={{ padding: 40 }}>
      <h1>✅ {t("debug.ok")}</h1>
      <p>{t("debug.hint")}</p>
    </div>
  );
}
