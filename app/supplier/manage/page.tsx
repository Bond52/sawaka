"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  establishSupplierManagementSession,
  setSupplierManagementToken,
} from "@/app/lib/apiSuppliers";

type Phase = "loading" | "success" | "error";

function SupplierManageContent() {
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const token = searchParams.get("token")?.trim() ?? "";
  const [phase, setPhase] = useState<Phase>(() => (token ? "loading" : "error"));
  const [supplierId, setSupplierId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      console.error("[supplier/manage] missing token in URL");
      setPhase("error");
      return;
    }

    let cancelled = false;
    setPhase("loading");

    (async () => {
      const result = await establishSupplierManagementSession(token);
      if (cancelled) return;

      if (!result.ok) {
        setPhase("error");
        return;
      }

      try {
        setSupplierManagementToken(result.token);
        setSupplierId(result.supplierId);
        setPhase("success");
      } catch (err) {
        console.error("[supplier/manage] failed to persist session", err);
        setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 py-12 sm:py-16">
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-8 text-center shadow-soft sm:p-10"
        data-testid="supplier-manage-page"
      >
        {phase === "loading" && (
          <>
            <div
              className="mx-auto mb-6 h-11 w-11 animate-spin rounded-full border-2 border-sawaka-200 border-t-sawaka-600"
              aria-hidden
            />
            <p className="text-base font-semibold text-slate-900">
              {t("suppliers.manage.establishing")}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {t("suppliers.manage.pleaseWait")}
            </p>
          </>
        )}

        {phase === "success" && (
          <div role="status" className="space-y-6" data-testid="supplier-manage-success">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <svg
                className="h-7 w-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-lg font-semibold text-slate-900">
              {t("suppliers.manage.sessionReady")}
            </p>
            <p className="text-sm text-slate-600">
              {t("suppliers.manage.sessionReadyHint")}
            </p>
            {supplierId && (
              <Link
                href={`/fournisseurs/${encodeURIComponent(supplierId)}`}
                className="btn btn-outline inline-flex w-full min-h-[48px] items-center justify-center rounded-xl font-semibold"
                data-testid="supplier-manage-view-profile"
              >
                {t("suppliers.manage.viewProfile")}
              </Link>
            )}
          </div>
        )}

        {phase === "error" && (
          <div role="alert" className="space-y-6" data-testid="supplier-manage-error">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
              <svg
                className="h-7 w-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <p className="text-base font-semibold text-red-900">
              {t("suppliers.manage.invalidLink")}
            </p>
            <p className="text-sm text-slate-600">
              {t("suppliers.manage.invalidLinkHint")}
            </p>
            <Link
              href="/fournisseurs"
              className="btn btn-outline inline-flex w-full min-h-[48px] items-center justify-center rounded-xl font-semibold"
              data-testid="supplier-manage-back-directory"
            >
              {t("suppliers.backToDirectory")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function SupplierManageFallback() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-8 text-center shadow-soft">
        <div
          className="mx-auto mb-6 h-11 w-11 animate-spin rounded-full border-2 border-sawaka-200 border-t-sawaka-600"
          aria-hidden
        />
        <p className="text-base font-semibold text-slate-900">
          {t("suppliers.manage.establishing")}
        </p>
      </div>
    </div>
  );
}

export default function SupplierManagePage() {
  return (
    <div className="min-h-screen bg-cream-100">
      <Suspense fallback={<SupplierManageFallback />}>
        <SupplierManageContent />
      </Suspense>
    </div>
  );
}
