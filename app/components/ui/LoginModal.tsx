"use client";

import Link from "next/link";
import LoginForm from "../auth/LoginForm";
import { useTranslation } from "@/src/i18n/I18nProvider";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function LoginModal({ open, onClose }: Props) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
      data-testid="login-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      <div className="bg-white rounded-xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-xl"
          aria-label={t("common.closeMenu")}
          data-testid="login-modal-close"
        >
          ✕
        </button>
        <h2
          id="login-modal-title"
          className="text-2xl font-bold text-center mb-6"
        >
          {t("auth.connection")}
        </h2>
        <LoginForm onSuccess={onClose} />
        <p className="text-center text-sm mt-6 text-sawaka-700">
          {t("auth.noAccount")}{" "}
          <Link
            href="/register"
            onClick={onClose}
            data-testid="login-modal-register-link"
            className="font-semibold text-sawaka-600 hover:text-sawaka-800 underline"
          >
            {t("auth.createOne")}
          </Link>
        </p>
      </div>
    </div>
  );
}
