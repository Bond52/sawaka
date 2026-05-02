"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const SUPPLIER_JWT_KEY = "supplierJwt";

function resolveApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  if (
    typeof window !== "undefined" &&
    window.location.hostname === "localhost"
  ) {
    return "http://localhost:5000";
  }
  return "";
}

function mapActivationError(raw: string, status: number): string {
  const lower = raw.toLowerCase();

  if (
    lower.includes("already used") ||
    lower.includes("déjà utilisé") ||
    lower.includes("already been used")
  ) {
    return "Already used";
  }

  if (
    lower.includes("expired") ||
    lower.includes("expiré") ||
    lower.includes("expiration")
  ) {
    return "Expired link";
  }

  if (
    lower.includes("invalid magic") ||
    lower.includes("invalid link") ||
    lower.includes("not found") ||
    status === 404
  ) {
    return "Invalid link";
  }

  if (
    lower.includes("no longer invited") ||
    lower.includes("could not be activated") ||
    status === 409
  ) {
    return "Invalid link";
  }

  if (status >= 500) {
    return "Something went wrong. Please try again later.";
  }

  if (raw.trim()) return raw.trim();

  return "Invalid link";
}

function ActivateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [phase, setPhase] = useState<"loading" | "success" | "error">(() =>
    token ? "loading" : "error"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(() =>
    token
      ? null
      : "Invalid link"
  );

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    setPhase("loading");
    setErrorMessage(null);

    const API_URL = resolveApiBaseUrl();

    (async () => {
      try {
        if (!API_URL) {
          if (!cancelled) {
            setPhase("error");
            setErrorMessage(
              "Application misconfiguration: NEXT_PUBLIC_API_BASE is not set."
            );
          }
          return;
        }

        const res = await fetch(
          `${API_URL}/api/suppliers/magic-link/${encodeURIComponent(token)}`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        let data: { token?: unknown; error?: unknown; message?: unknown } = {};
        try {
          data = await res.json();
        } catch {
          /* non-JSON */
        }

        if (cancelled) return;

        if (!res.ok) {
          const errText =
            (typeof data.error === "string" && data.error) ||
            (typeof data.message === "string" && data.message) ||
            "";
          setPhase("error");
          setErrorMessage(mapActivationError(errText, res.status));
          return;
        }

        const jwt =
          typeof data.token === "string" && data.token.length > 0
            ? data.token
            : null;

        if (!jwt) {
          setPhase("error");
          setErrorMessage("Invalid link");
          return;
        }

        try {
          localStorage.setItem(SUPPLIER_JWT_KEY, jwt);
        } catch {
          setPhase("error");
          setErrorMessage(
            "Could not save your session. Enable storage and try again."
          );
          return;
        }

        setPhase("success");
      } catch {
        if (!cancelled) {
          setPhase("error");
          setErrorMessage(
            "Unable to reach the server. Check your connection and try again."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 py-12 sm:py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-8 shadow-soft sm:p-10 text-center">
        {phase === "loading" && (
          <>
            <div
              className="mx-auto mb-6 h-11 w-11 animate-spin rounded-full border-2 border-sawaka-200 border-t-sawaka-600"
              aria-hidden
            />
            <p className="text-base font-semibold text-slate-900">
              Activating your account...
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Please wait while we confirm your link.
            </p>
          </>
        )}

        {phase === "success" && (
          <div role="status" className="space-y-6">
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
              Your account has been successfully activated.
            </p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="btn btn-primary w-full min-h-[48px] rounded-xl text-base font-semibold"
            >
              Go to dashboard
            </button>
          </div>
        )}

        {phase === "error" && errorMessage && (
          <div role="alert" className="space-y-6">
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
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="btn btn-outline w-full min-h-[48px] rounded-xl font-semibold"
            >
              Go to home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ActivateFallback() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-8 shadow-soft text-center">
        <div
          className="mx-auto mb-6 h-11 w-11 animate-spin rounded-full border-2 border-sawaka-200 border-t-sawaka-600"
          aria-hidden
        />
        <p className="text-base font-semibold text-slate-900">
          Activating your account...
        </p>
      </div>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <div className="min-h-screen bg-cream-100">
      <Suspense fallback={<ActivateFallback />}>
        <ActivateContent />
      </Suspense>
    </div>
  );
}
