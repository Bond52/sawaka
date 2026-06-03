"use client";

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
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-xl"
          aria-label={t("common.closeMenu")}
        >
          ✕
        </button>
        <h2 className="text-2xl font-bold text-center mb-6">
          {t("auth.connection")}
        </h2>
        <LoginForm onSuccess={onClose} />
        <p className="text-center text-sm mt-6 text-sawaka-700">
          {t("auth.noAccount")}{" "}
          <button
            type="button"
            onClick={() => alert(t("alerts.accountCreationUnavailable"))}
            className="font-semibold text-sawaka-600 hover:text-sawaka-800 underline"
          >
            {t("auth.createOne")}
          </button>
        </p>
      </div>
    </div>
  );
}
