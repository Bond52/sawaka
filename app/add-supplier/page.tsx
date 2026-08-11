"use client";

import { useTranslation } from "@/src/i18n/I18nProvider";
import SupplierForm from "./components/SupplierForm";

export default function AddSupplierPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-[70vh] bg-background py-10 md:py-14">
      <div className="wrap max-w-3xl">
        <h1
          data-testid="add-supplier-page-title"
          className="mb-2 font-display text-2xl text-foreground md:text-3xl"
        >
          {t("suppliers.addTitle")}
        </h1>
        <p
          data-testid="add-supplier-page-subtitle"
          className="mb-8 text-sm text-muted-foreground md:text-base"
        >
          {t("suppliers.addSubtitle")}
        </p>
        <SupplierForm />
      </div>
    </div>
  );
}
