"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslation } from "@/src/i18n/I18nProvider";

type RealizationLightboxProps = {
  urls: string[];
  open: boolean;
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  restoreFocusRef?: { current: HTMLElement | null };
  testIdPrefix?: string;
};

function testId(prefix: string, name: string): string {
  return `${prefix}-${name}`;
}

/**
 * Full-screen realization photo viewer shared by the public detail page
 * and the owner preview on My Realizations.
 */
export default function RealizationLightbox({
  urls,
  open,
  index,
  onIndexChange,
  onClose,
  restoreFocusRef,
  testIdPrefix = "realization-detail",
}: RealizationLightboxProps) {
  const { t } = useTranslation();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  const onIndexChangeRef = useRef(onIndexChange);
  onCloseRef.current = onClose;
  onIndexChangeRef.current = onIndexChange;
  const count = urls.length;
  const safeIndex = Math.min(Math.max(index, 0), Math.max(count - 1, 0));
  const indexRef = useRef(safeIndex);
  indexRef.current = safeIndex;
  const current = urls[safeIndex] ?? "";

  useEffect(() => {
    if (!open || count === 0) return;
    const opener = restoreFocusRef?.current ?? null;
    const dialog = dialogRef.current;
    const inerted: HTMLElement[] = [];
    for (const node of Array.from(document.body.children)) {
      if (!(node instanceof HTMLElement)) continue;
      if (dialog && (node === dialog || node.contains(dialog))) continue;
      if (node.hasAttribute("inert")) continue;
      node.setAttribute("inert", "");
      inerted.push(node);
    }
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    closeRef.current?.focus();

    function focusableControls(): HTMLElement[] {
      const root = dialogRef.current;
      if (!root) return [];
      return Array.from(root.querySelectorAll<HTMLElement>("button:not([disabled])"));
    }

    function move(delta: number) {
      onIndexChangeRef.current((indexRef.current + delta + count) % count);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (count > 1 && event.key === "ArrowRight") {
        event.preventDefault();
        move(1);
      }
      if (count > 1 && event.key === "ArrowLeft") {
        event.preventDefault();
        move(-1);
      }
      if (event.key !== "Tab") return;
      const controls = focusableControls();
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      const active = document.activeElement;
      if (controls.length === 1 || (event.shiftKey && (active === first || !dialogRef.current?.contains(active)))) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (!event.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
      inerted.forEach((node) => node.removeAttribute("inert"));
      opener?.focus();
    };
  }, [open, count, restoreFocusRef]);

  function move(delta: number) {
    onIndexChange((safeIndex + delta + count) % count);
  }

  function onTouchStart(event: React.TouchEvent) {
    touchStart.current = event.changedTouches[0]?.clientX ?? null;
  }

  function onTouchEnd(event: React.TouchEvent) {
    if (touchStart.current === null || count < 2) return;
    const end = event.changedTouches[0]?.clientX ?? touchStart.current;
    const delta = end - touchStart.current;
    if (Math.abs(delta) > 40) move(delta < 0 ? 1 : -1);
    touchStart.current = null;
  }

  if (!open || count === 0 || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("realizationDetail.gallery")}
      data-testid={testId(testIdPrefix, "lightbox")}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 px-3 text-white sm:px-6"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button
        type="button"
        ref={closeRef}
        data-testid={testId(testIdPrefix, "close")}
        className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        onClick={onClose}
      >
        <X className="h-5 w-5" aria-hidden />
        <span className="sr-only">{t("realizationDetail.close")}</span>
      </button>
      <div className="flex w-full max-w-6xl items-center justify-center gap-3 sm:gap-6">
        {count > 1 ? (
          <button
            type="button"
            data-testid={testId(testIdPrefix, "previous")}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={() => move(-1)}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
            <span className="sr-only">{t("realizationDetail.previous")}</span>
          </button>
        ) : null}
        {/* Remote realization photos are not covered by a next/image pattern. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current}
          alt={t("realizationDetail.photoAlt", { index: safeIndex + 1, total: count })}
          className="max-h-[calc(100vh-8rem)] max-w-[calc(100vw-8.5rem)] object-contain"
        />
        {count > 1 ? (
          <button
            type="button"
            data-testid={testId(testIdPrefix, "next")}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={() => move(1)}
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
            <span className="sr-only">{t("realizationDetail.next")}</span>
          </button>
        ) : null}
      </div>
      <p
        data-testid={testId(testIdPrefix, "position")}
        className="absolute bottom-5 left-1/2 -translate-x-1/2 text-sm font-medium text-white"
      >
        {t("realizationDetail.position", { index: safeIndex + 1, total: count })}
      </p>
    </div>,
    document.body
  );
}
