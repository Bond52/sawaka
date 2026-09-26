"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { verifyAccountEmail } from "@/app/lib/apiContributors";

type Phase = "loading" | "success" | "notPublic" | "error" | "expired" | "used" | "networkError";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const token = searchParams.get("token")?.trim() ?? "";
  const [phase, setPhase] = useState<Phase>(() => (token ? "loading" : "error"));
  const [retryKey, setRetryKey] = useState(0);
  const attemptRef = useRef<{
    id: string;
    request: ReturnType<typeof verifyAccountEmail>;
  } | null>(null);

  useEffect(() => {
    if (!token) {
      setPhase("error");
      return;
    }

    const attemptId = `${retryKey}:${token}`;
    if (!attemptRef.current || attemptRef.current.id !== attemptId) {
      attemptRef.current = {
        id: attemptId,
        request: verifyAccountEmail(token),
      };
    }

    let cancelled = false;
    setPhase("loading");

    attemptRef.current.request.then((result) => {
      if (cancelled) return;
      if ("status" in result) {
        if (result.status === 0 || result.code === "NETWORK") {
          setPhase("networkError");
        } else if (result.code === "TOKEN_EXPIRED") {
          setPhase("expired");
        } else if (result.code === "TOKEN_USED") {
          setPhase("used");
        } else {
          setPhase("error");
        }
        return;
      }
      setPhase(result.profileActivated ? "success" : "notPublic");
    });

    return () => {
      cancelled = true;
    };
  }, [retryKey, token]);

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 py-12 sm:py-16">
      <div
        className="card w-full max-w-md p-8 text-center shadow-soft sm:p-10"
        data-testid="contributor-verify-email-page"
      >
        {phase === "loading" && (
          <>
            <div
              className="mx-auto mb-6 h-11 w-11 animate-spin rounded-full border-2 border-muted border-t-primary"
              aria-hidden
            />
            <p className="text-base font-semibold text-foreground">
              {t("contributor.verifyEmail.verifying")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("contributor.verifyEmail.pleaseWait")}
            </p>
          </>
        )}

        {(phase === "success" || phase === "notPublic") && (
          <div
            role="status"
            className="space-y-6"
            data-testid={
              phase === "success"
                ? "contributor-verify-email-success"
                : "contributor-verify-email-not-public"
            }
          >
            <p className="text-lg font-semibold text-foreground">
              {t(
                phase === "success"
                  ? "contributor.verifyEmail.success"
                  : "contributor.verifyEmail.notPublic"
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(
                phase === "success"
                  ? "contributor.verifyEmail.successHint"
                  : "contributor.verifyEmail.notPublicHint"
              )}
            </p>
            <Link
              href="/dashboard"
              className="btn btn-primary inline-flex w-full items-center justify-center"
              data-testid="contributor-verify-email-dashboard"
            >
              {t("contributor.verifyEmail.goToDashboard")}
            </Link>
          </div>
        )}

        {(phase === "error" || phase === "expired" || phase === "used" || phase === "networkError") && (
          <div
            role="alert"
            className="space-y-6"
            data-testid={
              phase === "expired"
                ? "contributor-verify-email-expired"
                : phase === "used"
                  ? "contributor-verify-email-used"
                  : "contributor-verify-email-error"
            }
          >
            <p className="text-base font-semibold text-destructive">
              {phase === "networkError"
                ? t("contributor.verifyEmail.networkError")
                : phase === "expired"
                  ? t("contributor.verifyEmail.expired")
                  : phase === "used"
                    ? t("contributor.verifyEmail.used")
                    : t("contributor.verifyEmail.error")}
            </p>
            {phase !== "networkError" && (
              <p className="text-sm text-muted-foreground">
                {t("contributor.verifyEmail.errorHint")}
              </p>
            )}
            {token && (
              <button
                type="button"
                onClick={() => setRetryKey((key) => key + 1)}
                className="btn btn-primary inline-flex w-full items-center justify-center"
                data-testid="contributor-verify-email-retry"
              >
                {t("contributor.verifyEmail.retry")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function VerifyEmailFallback() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <p className="text-base font-semibold text-foreground">
        {t("contributor.verifyEmail.verifying")}
      </p>
    </div>
  );
}

export default function ContributorVerifyEmailPage() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<VerifyEmailFallback />}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
