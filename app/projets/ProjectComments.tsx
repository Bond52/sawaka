"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/src/i18n/I18nProvider";
import {
  createNeedComment,
  createProjectComment,
  deleteProjectComment,
  listNeedComments,
  listProjectComments,
  type CommentAccess,
  type ProjectComment,
} from "@/app/lib/projects";
import { readStoredUser, readStoredUserId } from "@/app/lib/authUser";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type ProjectCommentsProps = {
  projectId: string;
  commentAccess: CommentAccess;
  needId?: string;
  canModerate?: boolean;
};

function authorDisplay(
  comment: ProjectComment,
  t: (key: string) => string
): string {
  if (comment.authorType === "visitor") return t("projects.comments.visitor");
  return comment.authorLabel || t("projects.comments.member");
}

export default function ProjectComments({
  projectId,
  commentAccess,
  needId,
  canModerate = false,
}: ProjectCommentsProps) {
  const { t, locale } = useTranslation();
  const user = typeof window !== "undefined" ? readStoredUser() : null;
  const userId = typeof window !== "undefined" ? readStoredUserId() : null;
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const signedIn = Boolean(user);
  const canSubmit = commentAccess === "everyone" || signedIn;

  const reload = async () => {
    setPhase("loading");
    const result = needId
      ? await listNeedComments(projectId, needId)
      : await listProjectComments(projectId);
    if (!result.ok) {
      setPhase("error");
      return;
    }
    setComments(result.comments);
    setPhase("ready");
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = needId
        ? await listNeedComments(projectId, needId)
        : await listProjectComments(projectId);
      if (cancelled) return;
      if (!result.ok) {
        setPhase("error");
        return;
      }
      setComments(result.comments);
      setPhase("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, needId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !canSubmit) return;
    setError("");
    if (!body.trim()) {
      setError(t("projects.comments.required"));
      return;
    }
    setBusy(true);
    const result = needId
      ? await createNeedComment(projectId, needId, body)
      : await createProjectComment(projectId, body);
    setBusy(false);
    if (result.ok === false) {
      setError(t(`projects.comments.errors.${result.code}`));
      return;
    }
    setBody("");
    setComments((current) => [...current, result.comment]);
  };

  const remove = async (commentId: string) => {
    setBusy(true);
    const result = await deleteProjectComment(projectId, commentId);
    setBusy(false);
    setConfirmId(null);
    if (result.ok === false) {
      setError(t(`projects.comments.errors.${result.code}`));
      return;
    }
    setComments((current) => current.filter((item) => item.id !== commentId));
  };

  const dateLabel = (value: string) => {
    try {
      return new Date(value).toLocaleString(locale === "fr" ? "fr-FR" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return value;
    }
  };

  return (
    <div
      className="mt-4 min-w-0"
      data-testid={needId ? `need-comments-${needId}` : "project-comments"}
    >
      <h3 className="text-base font-semibold text-foreground">
        {needId ? t("projects.comments.needTitle") : t("projects.comments.title")}
      </h3>

      {phase === "loading" ? (
        <p className="mt-2 text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : null}
      {phase === "error" ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {t("projects.comments.loadError")}
        </p>
      ) : null}

      {phase === "ready" && comments.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground" data-testid="comments-empty">
          {t("projects.comments.empty")}
        </p>
      ) : null}

      {phase === "ready" && comments.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {comments.map((comment) => {
            const canDelete =
              canModerate ||
              (signedIn && comment.authorType === "member" && comment.authorId === userId);
            return (
              <li
                key={comment.id}
                className="rounded-xl border border-border bg-card px-3 py-3"
                data-testid={`comment-${comment.id}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {authorDisplay(comment, t)}
                  </p>
                  <p className="text-xs text-muted-foreground">{dateLabel(comment.createdAt)}</p>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-sawaka-700">
                  {comment.body}
                </p>
                {canDelete ? (
                  confirmId === comment.id ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        data-testid={`comment-delete-confirm-${comment.id}`}
                        disabled={busy}
                        className={`inline-flex min-h-[44px] items-center rounded-lg bg-destructive px-3 text-sm text-destructive-foreground ${focusRing}`}
                        onClick={() => void remove(comment.id)}
                      >
                        {t("projects.comments.confirmDelete")}
                      </button>
                      <button
                        type="button"
                        className={`inline-flex min-h-[44px] items-center rounded-lg border border-border px-3 text-sm ${focusRing}`}
                        onClick={() => setConfirmId(null)}
                      >
                        {t("projects.comments.cancelDelete")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      data-testid={`comment-delete-${comment.id}`}
                      className={`mt-2 inline-flex min-h-[44px] items-center text-sm text-destructive ${focusRing}`}
                      onClick={() => setConfirmId(comment.id)}
                    >
                      {t("projects.comments.delete")}
                    </button>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {canSubmit ? (
        <form className="mt-4 space-y-2" onSubmit={submit} data-testid="comment-form">
          <label htmlFor={`comment-body-${needId || "project"}`} className="block text-sm font-medium">
            {t("projects.comments.write")}
          </label>
          <textarea
            id={`comment-body-${needId || "project"}`}
            data-testid="comment-body"
            value={body}
            rows={3}
            maxLength={2000}
            className={`w-full rounded-xl border border-border bg-card px-3 py-2 text-sm ${focusRing}`}
            onChange={(event) => setBody(event.target.value)}
          />
          {error ? (
            <p role="alert" className="text-sm text-destructive" data-testid="comment-error">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            data-testid="comment-submit"
            className={`inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-70 ${focusRing}`}
          >
            {busy ? t("projects.comments.sending") : t("projects.comments.submit")}
          </button>
        </form>
      ) : (
        <div
          className="mt-4 rounded-xl border border-border bg-secondary px-4 py-3 text-sm"
          data-testid="comment-login-required"
        >
          <p>{t("projects.comments.membersOnly")}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link href="/login" className={`inline-flex min-h-[44px] items-center text-primary ${focusRing}`}>
              {t("projects.comments.login")}
            </Link>
            <Link
              href="/register"
              className={`inline-flex min-h-[44px] items-center text-primary ${focusRing}`}
            >
              {t("projects.comments.register")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
