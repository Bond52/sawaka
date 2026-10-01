'use client';

import Link from "next/link";
import { useTranslation } from "@/src/i18n/I18nProvider";

export default function AcheteurPage() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t("buyer.welcome")}</h1>
      <p>{t("buyer.connected")}</p>

      <Link href="/acheteur/commandes">
        <button style={{ marginTop: "1rem" }}>
          📦 {t("buyer.viewOrders")}
        </button>
      </Link>
    </div>
  );
}
