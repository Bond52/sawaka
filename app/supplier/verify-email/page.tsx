"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { verifyContactEmail } from "@/app/lib/apiSuppliers";

type Phase = "loading" | "success" | "error" | "networkError";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const token = searchParams.get("token")?.trim() ?? "";
  const [phase, setPhase] = useState<Phase>(() => (token ? "loading" : "error"));
  const [retryKey, setRetryKey] = useState(0);
  const attemptRef = useRef<{
    id: string;
    request: ReturnType<typeof verifyContactEmail>;
  } | null>(null);

  useEffect(() => {
    if (!token) {
      setPhase("error");
      return;
    }

    // The token is single-use, so an attempt must reach the API only once even
    // when the effect is replayed (strict mode, remounts).
    const attemptId = `${retryKey}:${token}`;
    if (!attemptRef.current || attemptRef.current.id !== attemptId) {
      attemptRef.current = {
        id: attemptId,
        request: verifyContactEmail(token),
      };
    }

    let cancelled = false;
    setPhase("loading");

    attemptRef.current.request.then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setPhase("success");
        return;
      }
      const fail = result as { ok: false; status: number; detail: string };
      setPhase(fail.status === 0 ? "networkError" : "error");
    });

    return () => {
      cancelled = true;
    };
  }, [retryKey, token]);

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 py-12 sm:py-16">
      <div
        className="card w-full max-w-md p-8 text-center shadow-soft sm:p-10"
        data-testid="supplier-verify-email-page"
      >
        {phase === "loading" && (
          <>
            <div
              className="mx-auto mb-6 h-11 w-11 animate-spin rounded-full border-2 border-muted border-t-primary"
              aria-hidden
            />
            <p className="text-base font-semibold text-foreground">
              {t("suppliers.verifyEmail.verifying")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("suppliers.verifyEmail.pleaseWait")}
            </p>
          </>
        )}

        {phase === "success" && (
          <div
            role="status"
            className="space-y-6"
            data-testid="supplier-verify-email-success"
          >
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
            <p className="text-lg font-semibold text-foreground">
              {t("suppliers.verifyEmail.success")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("suppliers.verifyEmail.successHint")}
            </p>
            <Link
              href="/supplier/manage"
              className="btn btn-primary inline-flex w-full items-center justify-center"
              data-testid="supplier-verify-email-manage"
            >
              {t("suppliers.verifyEmail.goToManage")}
            </Link>
          </div>
        )}

        {(phase === "error" || phase === "networkError") && (
          <div
            role="alert"
            className="space-y-6"
            data-testid="supplier-verify-email-error"
          >
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
            <p className="text-base font-semibold text-destructive">
              {phase === "networkError"
                ? t("suppliers.verifyEmail.networkError")
                : t("suppliers.verifyEmail.error")}
            </p>
            {phase === "error" && (
              <p className="text-sm text-muted-foreground">
                {t("suppliers.verifyEmail.errorHint")}
              </p>
            )}
            <div className="space-y-3">
              {token && (
                <button
                  type="button"
                  onClick={() => setRetryKey((key) => key + 1)}
                  className="btn btn-primary inline-flex w-full items-center justify-center"
                  data-testid="supplier-verify-email-retry"
                >
                  {t("suppliers.verifyEmail.retry")}
                </button>
              )}
              <Link
                href="/fournisseurs"
                className="btn btn-outline inline-flex w-full items-center justify-center"
                data-testid="supplier-verify-email-directory"
              >
                {t("suppliers.backToDirectory")}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VerifyEmailFallback() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 py-12">
      <div className="card w-full max-w-md p-8 text-center shadow-soft">
        <div
          className="mx-auto mb-6 h-11 w-11 animate-spin rounded-full border-2 border-muted border-t-primary"
          aria-hidden
        />
        <p className="text-base font-semibold text-foreground">
          {t("suppliers.verifyEmail.verifying")}
        </p>
      </div>
    </div>
  );
}

export default function SupplierVerifyEmailPage() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<VerifyEmailFallback />}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
