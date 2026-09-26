import { resolveApiBaseUrl } from "./apiBase";

export type VerifyAccountEmailResult =
  | { ok: true; profileActivated: boolean }
  | { ok: false; status: number; detail: string };

/**
 * Consumes a one-time account email verification token
 * (POST /api/contributors/email-verification).
 */
export async function verifyAccountEmail(
  rawToken: string
): Promise<VerifyAccountEmailResult> {
  const token = rawToken?.trim();
  if (!token) {
    return { ok: false, status: 400, detail: "missing_token" };
  }

  const url = `${resolveApiBaseUrl()}/api/contributors/email-verification`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch (err) {
    console.error("[apiContributors] verifyAccountEmail: network error", {
      err,
      url,
    });
    return { ok: false, status: 0, detail: "network_error" };
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    return { ok: false, status: res.status, detail: "verification_failed" };
  }

  const profileActivated =
    Boolean(data) &&
    typeof data === "object" &&
    (data as { profileActivated?: boolean }).profileActivated === true;

  return { ok: true, profileActivated };
}
