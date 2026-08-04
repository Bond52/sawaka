"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/src/i18n/I18nProvider";
import ManageSupplierForm from "@/app/components/suppliers/ManageSupplierForm";
import {
  clearSupplierManagementToken,
  establishSupplierManagementSession,
  getEditableSupplier,
  getSupplierManagementToken,
  setSupplierManagementToken,
  type EditableSupplier,
} from "@/app/lib/apiSuppliers";

type Phase =
  | "exchanging"
  | "loading"
  | "ready"
  | "invalidLink"
  | "expired"
  | "loadError";

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 py-12 sm:py-16">
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-8 text-center shadow-soft sm:p-10"
        data-testid="supplier-manage-page"
      >
        {children}
      </div>
    </div>
  );
}

function ErrorIcon() {
  return (
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
  );
}

function SupplierManageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const urlToken = searchParams.get("token")?.trim() ?? "";

  const [phase, setPhase] = useState<Phase>(() =>
    urlToken ? "exchanging" : "loading"
  );
  const [token, setToken] = useState<string | null>(null);
  const [supplier, setSupplier] = useState<EditableSupplier | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPhase(urlToken ? "exchanging" : "loading");

    (async () => {
      let sessionToken: string | null = null;

      if (urlToken) {
        const session = await establishSupplierManagementSession(urlToken);
        if (cancelled) return;

        if (!session.ok) {
          setPhase("invalidLink");
          return;
        }

        try {
          setSupplierManagementToken(session.token);
        } catch (err) {
          console.error("[supplier/manage] failed to persist session", err);
        }
        sessionToken = session.token;
        // Drop single-use token from the URL so refresh uses the session JWT.
        router.replace("/supplier/manage");
      } else {
        sessionToken = getSupplierManagementToken();
      }

      if (!sessionToken) {
        setPhase("expired");
        return;
      }

      setPhase("loading");
      const loaded = await getEditableSupplier(sessionToken);
      if (cancelled) return;

      if (!loaded.ok) {
        const fail = loaded as { ok: false; status: number; detail: string };
        if (fail.status === 401 || fail.status === 403) {
          clearSupplierManagementToken();
          setPhase("expired");
          return;
        }
        setPhase("loadError");
        return;
      }

      setToken(sessionToken);
      setSupplier(loaded.supplier);
      setPhase("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey, urlToken, router]);

  const handleSessionExpired = useCallback(() => {
    clearSupplierManagementToken();
    setToken(null);
    setSupplier(null);
    setPhase("expired");
  }, []);

  if (phase === "exchanging" || phase === "loading") {
    return (
      <CenteredCard>
        <div
          className="mx-auto mb-6 h-11 w-11 animate-spin rounded-full border-2 border-sawaka-200 border-t-sawaka-600"
          aria-hidden
        />
        <p
          className="text-base font-semibold text-slate-900"
          data-testid="supplier-manage-loading"
        >
          {phase === "exchanging"
            ? t("suppliers.manage.establishing")
            : t("suppliers.manage.loadingProfile")}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          {t("suppliers.manage.pleaseWait")}
        </p>
      </CenteredCard>
    );
  }

  if (phase === "invalidLink") {
    return (
      <CenteredCard>
        <div
          role="alert"
          className="space-y-6"
          data-testid="supplier-manage-error"
        >
          <ErrorIcon />
          <p className="text-base font-semibold text-red-900">
            {t("suppliers.manage.invalidLink")}
          </p>
          <p className="text-sm text-slate-600">
            {t("suppliers.manage.invalidLinkHint")}
          </p>
          <Link
            href="/fournisseurs"
            className="btn btn-outline inline-flex min-h-[48px] w-full items-center justify-center rounded-xl font-semibold"
            data-testid="supplier-manage-back-directory"
          >
            {t("suppliers.backToDirectory")}
          </Link>
        </div>
      </CenteredCard>
    );
  }

  if (phase === "expired") {
    return (
      <CenteredCard>
        <div
          role="alert"
          className="space-y-6"
          data-testid="supplier-manage-session-expired"
        >
          <ErrorIcon />
          <p className="text-base font-semibold text-red-900">
            {t("suppliers.manage.sessionExpired")}
          </p>
          <p className="text-sm text-slate-600">
            {t("suppliers.manage.sessionExpiredHint")}
          </p>
          <Link
            href="/fournisseurs"
            className="btn btn-outline inline-flex min-h-[48px] w-full items-center justify-center rounded-xl font-semibold"
            data-testid="supplier-manage-back-directory"
          >
            {t("suppliers.backToDirectory")}
          </Link>
        </div>
      </CenteredCard>
    );
  }

  if (phase === "loadError" || !supplier || !token) {
    return (
      <CenteredCard>
        <div
          role="alert"
          className="space-y-6"
          data-testid="supplier-manage-load-error"
        >
          <ErrorIcon />
          <p className="text-base font-semibold text-red-900">
            {t("suppliers.manage.loadError")}
          </p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="btn btn-primary inline-flex min-h-[48px] w-full items-center justify-center rounded-xl font-semibold"
              data-testid="supplier-manage-retry"
            >
              {t("suppliers.manage.retry")}
            </button>
            <Link
              href="/fournisseurs"
              className="btn btn-outline inline-flex min-h-[48px] w-full items-center justify-center rounded-xl font-semibold"
              data-testid="supplier-manage-back-directory"
            >
              {t("suppliers.backToDirectory")}
            </Link>
          </div>
        </div>
      </CenteredCard>
    );
  }

  return (
    <div className="py-10 md:py-14" data-testid="supplier-manage-page">
      <div className="wrap max-w-3xl">
        <h1
          data-testid="supplier-manage-title"
          className="mb-2 text-2xl font-bold text-sawaka-800 md:text-3xl"
        >
          {t("suppliers.manage.pageTitle")}
        </h1>
        <p
          data-testid="supplier-manage-subtitle"
          className="mb-8 text-sm text-sawaka-700 md:text-base"
        >
          {t("suppliers.manage.pageSubtitle")}
        </p>
        <ManageSupplierForm
          initial={supplier}
          token={token}
          onSessionExpired={handleSessionExpired}
        />
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
