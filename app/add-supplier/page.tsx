"use client";

import { useTranslation } from "@/src/i18n/I18nProvider";
import SupplierForm from "./components/SupplierForm";

export default function AddSupplierPage() {
  const { t } = useTranslation();

  return (
    <div className="bg-cream-100 min-h-[70vh] py-10 md:py-14">
      <div className="wrap max-w-3xl">
        <h1
          data-testid="add-supplier-page-title"
          className="text-2xl md:text-3xl font-bold text-sawaka-800 mb-2"
        >
          {t("suppliers.addTitle")}
        </h1>
        <p
          data-testid="add-supplier-page-subtitle"
          className="text-sawaka-700 text-sm md:text-base mb-8"
        >
          {t("suppliers.addSubtitle")}
        </p>
        <SupplierForm />
      </div>
    </div>
  );
}
