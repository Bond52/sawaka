"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ImagePlus, Info, Plus, Sparkles, Upload } from "lucide-react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import { readStoredUser } from "@/app/lib/authUser";
import {
  MAX_PORTFOLIO_PHOTO_BYTES,
  PORTFOLIO_PHOTO_ACCEPT,
  inspectLocalImage,
  type PhotoIssueCode,
} from "@/app/lib/imageFilePolicy";
import { validateImportPhotos } from "@/app/lib/portfolioImport";
import { handoffImportSelection, readImportSelection } from "@/app/lib/portfolioWorkflow";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type AcceptedPhoto = { id: string; name: string; file: File };
type RejectedPhoto = { id: string; name: string; code: PhotoIssueCode };

function issueMessage(
  t: (key: string, params?: Record<string, string | number>) => string,
  item: RejectedPhoto,
  megabytes: number
): string {
  if (item.code === "IMAGE_TOO_LARGE") {
    return t("portfolio.import.tooLarge", { name: item.name, megabytes });
  }
  if (item.code === "PHOTO_REQUIRED") return t("portfolio.import.emptyFile", { name: item.name });
  return t("portfolio.import.unsupported", { name: item.name });
}

export default function ImportRealizationsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [accepted, setAccepted] = useState<AcceptedPhoto[]>([]);
  const [rejected, setRejected] = useState<RejectedPhoto[]>([]);
  const [checkFailed, setCheckFailed] = useState(false);
  const megabytes = MAX_PORTFOLIO_PHOTO_BYTES / (1024 * 1024);

  useEffect(() => {
    const user = readStoredUser();
    if (!user) {
      router.replace("/login?redirect=/realizations/import");
      return;
    }
    const restored = readImportSelection(user.username);
    if (restored.length > 0) {
      setAccepted(restored.map(({ id, name, file }) => ({ id, name, file })));
    }
    setReady(true);
  }, [router]);

  async function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    if (incoming.length === 0) return;
    setCheckFailed(false);

    const localRejected: RejectedPhoto[] = [];
    const candidates: File[] = [];
    for (const file of incoming) {
      const code = await inspectLocalImage(file);
      if (code) localRejected.push({ id: crypto.randomUUID(), name: file.name, code });
      else candidates.push(file);
    }

    if (candidates.length === 0) {
      setRejected((current) => [...current, ...localRejected]);
      return;
    }

    const result = await validateImportPhotos(candidates);
    if (result.ok !== true) {
      if (result.status === 401) {
        router.replace("/login?redirect=/realizations/import");
        return;
      }
      setCheckFailed(true);
      setRejected((current) => [...current, ...localRejected]);
      return;
    }

    const serverRejected: RejectedPhoto[] = result.rejected.map((item) => ({
      id: crypto.randomUUID(),
      name: item.name,
      code: item.code,
    }));
    const serverAccepted: AcceptedPhoto[] = result.accepted.map((item) => ({
      id: crypto.randomUUID(),
      name: item.name,
      file: candidates[item.index],
    }));
    setRejected((current) => [...current, ...localRejected, ...serverRejected]);
    setAccepted((current) => [...current, ...serverAccepted]);
  }

  if (!ready) {
    return (
      <div className="wrap py-16">
        <p className="text-muted-foreground" data-testid="portfolio-import-loading">
          {t("common.loading")}
        </p>
      </div>
    );
  }

  const selectedCount = accepted.length;

  return (
    <div className="wrap py-8" data-testid="portfolio-import-page">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
        {t("portfolio.import.eyebrow")}
      </p>
      <h1 className="mt-2 font-display text-4xl text-foreground">{t("portfolio.import.title")}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{t("portfolio.import.subtitle")}</p>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <button
          type="button"
          data-testid="portfolio-import-single"
          className={`flex min-h-[88px] items-center gap-4 rounded-xl border border-border bg-card p-4 text-left opacity-70 ${focusRing}`}
          aria-disabled="true"
          title={t("dashboard.actionUnavailable")}
          onClick={(event) => event.preventDefault()}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
            <Plus className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-foreground">{t("portfolio.import.singleTitle")}</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {t("portfolio.import.singleDescription")}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>

        <div
          data-testid="portfolio-import-bulk"
          aria-current="step"
          className="flex min-h-[88px] items-center gap-4 rounded-xl border border-primary bg-primary/10 p-4"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-foreground">{t("portfolio.import.bulkTitle")}</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {t("portfolio.import.bulkDescription")}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        </div>
      </div>

      <div
        data-testid="portfolio-dropzone"
        data-dragging={dragOver ? "true" : "false"}
        role="region"
        aria-label={t("portfolio.import.dropLabel")}
        className={`mt-6 rounded-xl border-2 border-dashed px-6 py-12 text-center ${
          dragOver ? "border-primary bg-primary/10" : "border-border bg-card"
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setDragOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (event.dataTransfer.files.length > 0) void addFiles(event.dataTransfer.files);
        }}
      >
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-primary">
          <Upload className="h-6 w-6" aria-hidden />
        </span>
        <p className="mt-4 text-xl font-semibold text-foreground">{t("portfolio.import.drop")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t("portfolio.import.dropHint")}</p>
        <input
          ref={inputRef}
          data-testid="portfolio-file-input"
          className="sr-only"
          type="file"
          accept={PORTFOLIO_PHOTO_ACCEPT}
          multiple
          tabIndex={-1}
          onChange={(event) => {
            if (event.target.files) void addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          data-testid="portfolio-select-photos"
          className={`mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground ${focusRing}`}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4" aria-hidden />
          {t("portfolio.import.select")}
        </button>
        <p className="mt-4 text-xs text-muted-foreground">
          {t("portfolio.import.formats", { megabytes })}
        </p>
      </div>

      {selectedCount > 0 ? (
        <p className="mt-4 text-sm font-medium text-foreground" data-testid="portfolio-selected-count">
          {t(selectedCount === 1 ? "portfolio.import.selectedOne" : "portfolio.import.selectedMany", {
            count: selectedCount,
          })}
        </p>
      ) : null}

      {accepted.length > 0 ? (
        <ul className="mt-3 space-y-2" data-testid="portfolio-selected-files">
          {accepted.map((photo) => (
            <li key={photo.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <span className="min-w-0 truncate">{photo.name}</span>
              <button
                type="button"
                className={`shrink-0 rounded-md px-2 py-1 text-foreground ${focusRing}`}
                onClick={() => setAccepted((current) => current.filter((item) => item.id !== photo.id))}
              >
                {t("portfolio.import.remove", { name: photo.name })}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {selectedCount > 0 ? (
        <button
          type="button"
          data-testid="portfolio-import-continue"
          className={`mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground ${focusRing}`}
          onClick={() => {
            const user = readStoredUser();
            if (!user) {
              router.replace("/login?redirect=/realizations/import");
              return;
            }
            handoffImportSelection(
              user.username,
              accepted.map((photo) => ({ id: photo.id, name: photo.name, file: photo.file }))
            );
            router.push("/realizations/organize");
          }}
        >
          {t("portfolio.import.continue")}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      ) : null}

      {checkFailed || rejected.length > 0 ? (
        <div role="alert" className="mt-4 space-y-1 text-sm text-destructive" data-testid="portfolio-import-errors">
          {checkFailed ? <p>{t("portfolio.import.checkFailed")}</p> : null}
          {rejected.map((item) => (
            <p key={item.id}>{issueMessage(t, item, megabytes)}</p>
          ))}
        </div>
      ) : null}

      <aside className="mt-6 flex gap-3 rounded-lg bg-secondary p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p>
          <span className="font-semibold text-foreground">{t("portfolio.import.tipLabel")}</span>
          <span className="mt-1 block text-muted-foreground">{t("portfolio.import.tip")}</span>
        </p>
      </aside>
    </div>
  );
}
