"use client";

import { FormEvent, useState } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { requestSupplierManagementLink } from "@/app/lib/apiSuppliers";

type Props = {
  supplierId: string;
  supplierName: string;
};

type Phase = "form" | "submitting" | "sent" | "error";

export default function RequestManagementAccess({
  supplierId,
  supplierName,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  function reset() {
    setPhase("form");
    setEmail("");
    setErrorKey(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^.+@.+\..+$/.test(trimmed)) {
      setErrorKey("suppliers.manage.requestInvalidEmail");
      return;
    }

    setPhase("submitting");
    setErrorKey(null);

    const result = await requestSupplierManagementLink(supplierId, trimmed);
    if (!result.ok) {
      const fail = result as { ok: false; status: number; detail: string };
      if (fail.status === 429) {
        setErrorKey("suppliers.manage.requestRateLimited");
      } else if (fail.status === 0) {
        setErrorKey("suppliers.manage.requestNetworkError");
      } else {
        setErrorKey("suppliers.manage.requestError");
      }
      setPhase("error");
      return;
    }

    setPhase("sent");
  }

  return (
    <div className="mt-6" data-testid="supplier-edit-entry">
      <button
        type="button"
        data-testid="supplier-edit-open"
        onClick={() => {
          setOpen(true);
          reset();
        }}
        className="text-sm font-medium text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("suppliers.manage.editSupplier")}
      </button>

      {open && (
        <div
          className="dialog-overlay"
          role="presentation"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="supplier-manage-request-title"
            data-testid="supplier-manage-request-dialog"
            className="dialog-panel"
          >
            <h2
              id="supplier-manage-request-title"
              className="dialog-title"
            >
              {t("suppliers.manage.requestTitle")}
            </h2>
            <p className="dialog-description">
              {t("suppliers.manage.requestDescription").replace(
                "{name}",
                supplierName
              )}
            </p>

            {phase === "sent" ? (
              <div className="mt-6 space-y-4" role="status" data-testid="supplier-manage-request-sent">
                <p className="text-sm text-foreground">
                  {t("suppliers.manage.requestSent")}
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="btn btn-primary w-full"
                >
                  {t("suppliers.manage.close")}
                </button>
              </div>
            ) : (
              <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
                <div>
                  <label
                    htmlFor="supplier-manage-email"
                    className="field-label"
                  >
                    {t("suppliers.manage.contactEmailLabel")}
                  </label>
                  <input
                    id="supplier-manage-email"
                    data-testid="supplier-manage-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    disabled={phase === "submitting"}
                    onChange={(ev) => setEmail(ev.target.value)}
                    className="field"
                    placeholder={t("suppliers.manage.contactEmailPlaceholder")}
                  />
                </div>

                {(phase === "error" || errorKey) && (
                  <p
                    role="alert"
                    data-testid="supplier-manage-request-error"
                    className="field-error"
                  >
                    {t(errorKey || "suppliers.manage.requestError")}
                  </p>
                )}

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={close}
                    disabled={phase === "submitting"}
                    className="btn btn-outline"
                  >
                    {t("suppliers.manage.cancel")}
                  </button>
                  <button
                    type="submit"
                    data-testid="supplier-manage-request-submit"
                    disabled={phase === "submitting"}
                    className="btn btn-primary"
                  >
                    {phase === "submitting"
                      ? t("suppliers.manage.requestSubmitting")
                      : t("suppliers.manage.requestSubmit")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
