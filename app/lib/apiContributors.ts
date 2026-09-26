import { readStoredUser } from "./authUser";
import { resolveApiBaseUrl } from "./apiBase";

export type TaxonomyItem = { id: string; nameFR: string; nameEN: string };

export type ContributorProfilePayload = {
  id: string;
  displayName: string;
  status?: string;
  isVisible?: boolean;
};

export type ContributorFieldMap = Record<string, string>;

export type VerifyAccountEmailResult =
  | { ok: true; profileActivated: boolean }
  | { ok: false; status: number; code: string };

export type OwnProfileResult =
  | { ok: true; profile: ContributorProfilePayload }
  | { ok: false; status: number; code: string };

export type CreateContributorResult =
  | {
      ok: true;
      profile: ContributorProfilePayload;
      accountCreated: boolean;
      verificationRequired: boolean;
      verificationEmailSent: boolean;
      token?: string;
      roles?: string[];
      username?: string;
    }
  | { ok: false; status: number; code: string; fields?: ContributorFieldMap };

export type ResendVerificationResult =
  | {
      ok: true;
      emailVerified: boolean;
      verificationEmailSent: boolean;
      status?: string;
      isVisible?: boolean;
    }
  | { ok: false; status: number; code: string };

type CreateBody = {
  account?: { username: string; email: string; password: string };
  displayName: string;
  domainId: string;
  skillIds: string[];
  customSkills: string[];
  country: string;
  region?: string;
  city?: string;
  biography?: string;
};

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const user = readStoredUser();
  if (user?.token) headers.Authorization = `Bearer ${user.token}`;
  return headers;
}

function readErrorCode(data: unknown): string {
  if (!data || typeof data !== "object") return "SERVER_ERROR";
  const error = (data as { error?: unknown }).error;
  if (typeof error === "string") {
    if (/too many requests/i.test(error)) return "RATE_LIMIT";
    return "SERVER_ERROR";
  }
  if (
    error &&
    typeof error === "object" &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return "SERVER_ERROR";
}

function readErrorFields(data: unknown): ContributorFieldMap | undefined {
  if (!data || typeof data !== "object") return undefined;
  const error = (data as { error?: unknown }).error;
  if (!error || typeof error !== "object") return undefined;
  const fields = (error as { fields?: unknown }).fields;
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    return undefined;
  }
  const mapped: ContributorFieldMap = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "string") mapped[key] = value;
  }
  return Object.keys(mapped).length > 0 ? mapped : undefined;
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export function taxonomyLabel(
  item: TaxonomyItem,
  locale: string
): string {
  return locale === "fr" ? item.nameFR : item.nameEN;
}

export async function listContributorDomains(): Promise<
  { ok: true; domains: TaxonomyItem[] } | { ok: false; status: number }
> {
  try {
    const res = await fetch(`${resolveApiBaseUrl()}/api/contributors/domains`, {
      credentials: "include",
    });
    const data = await readJson(res);
    if (!res.ok) return { ok: false, status: res.status };
    const domains =
      data &&
      typeof data === "object" &&
      Array.isArray((data as { domains?: unknown }).domains)
        ? ((data as { domains: TaxonomyItem[] }).domains)
        : [];
    return { ok: true, domains };
  } catch (err) {
    console.error("[apiContributors] listContributorDomains: network error", {
      err,
    });
    return { ok: false, status: 0 };
  }
}

export async function listContributorSkills(
  domainId: string
): Promise<
  { ok: true; skills: TaxonomyItem[] } | { ok: false; status: number }
> {
  try {
    const res = await fetch(
      `${resolveApiBaseUrl()}/api/contributors/domains/${encodeURIComponent(domainId)}/skills`,
      { credentials: "include" }
    );
    const data = await readJson(res);
    if (!res.ok) return { ok: false, status: res.status };
    const skills =
      data &&
      typeof data === "object" &&
      Array.isArray((data as { skills?: unknown }).skills)
        ? ((data as { skills: TaxonomyItem[] }).skills)
        : [];
    return { ok: true, skills };
  } catch (err) {
    console.error("[apiContributors] listContributorSkills: network error", {
      err,
    });
    return { ok: false, status: 0 };
  }
}

export async function getOwnContributor(): Promise<OwnProfileResult> {
  try {
    const res = await fetch(`${resolveApiBaseUrl()}/api/contributors/me`, {
      credentials: "include",
      headers: authHeaders(),
    });
    const data = await readJson(res);
    if (!res.ok) return { ok: false, status: res.status, code: readErrorCode(data) };
    const profile =
      data && typeof data === "object"
        ? (data as { profile?: ContributorProfilePayload }).profile
        : undefined;
    if (!profile?.id) return { ok: false, status: res.status, code: "SERVER_ERROR" };
    return { ok: true, profile };
  } catch (err) {
    console.error("[apiContributors] getOwnContributor: network error", { err });
    return { ok: false, status: 0, code: "NETWORK" };
  }
}

export async function createContributorProfile(
  body: CreateBody
): Promise<CreateContributorResult> {
  try {
    const res = await fetch(`${resolveApiBaseUrl()}/api/contributors`, {
      method: "POST",
      credentials: "include",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const data = await readJson(res);
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        code: readErrorCode(data),
        fields: readErrorFields(data),
      };
    }
    const record = (data && typeof data === "object" ? data : {}) as {
      profile?: ContributorProfilePayload;
      accountCreated?: boolean;
      verificationRequired?: boolean;
      verificationEmailSent?: boolean;
      token?: string;
      roles?: string[];
      username?: string;
    };
    if (!record.profile?.id) {
      return { ok: false, status: res.status, code: "SERVER_ERROR" };
    }
    return {
      ok: true,
      profile: record.profile,
      accountCreated: record.accountCreated === true,
      verificationRequired: record.verificationRequired === true,
      verificationEmailSent: record.verificationEmailSent === true,
      token: record.token,
      roles: record.roles,
      username: record.username,
    };
  } catch (err) {
    console.error("[apiContributors] createContributorProfile: network error", {
      err,
    });
    return { ok: false, status: 0, code: "NETWORK" };
  }
}

export async function resendContributorVerification(): Promise<ResendVerificationResult> {
  try {
    const res = await fetch(
      `${resolveApiBaseUrl()}/api/contributors/me/verification-email`,
      {
        method: "POST",
        credentials: "include",
        headers: authHeaders(),
      }
    );
    const data = await readJson(res);
    if (res.status === 429) return { ok: false, status: 429, code: "RATE_LIMIT" };
    if (!res.ok) return { ok: false, status: res.status, code: readErrorCode(data) };
    const record = (data && typeof data === "object" ? data : {}) as {
      emailVerified?: boolean;
      verificationEmailSent?: boolean;
      status?: string;
      isVisible?: boolean;
    };
    return {
      ok: true,
      emailVerified: record.emailVerified === true,
      verificationEmailSent: record.verificationEmailSent === true,
      status: record.status,
      isVisible: record.isVisible === true,
    };
  } catch (err) {
    console.error("[apiContributors] resendContributorVerification: network error", {
      err,
    });
    return { ok: false, status: 0, code: "NETWORK" };
  }
}

/**
 * Consumes a one-time account email verification token
 * (POST /api/contributors/email-verification).
 */
export async function verifyAccountEmail(
  rawToken: string
): Promise<VerifyAccountEmailResult> {
  const token = rawToken?.trim();
  if (!token) {
    return { ok: false, status: 400, code: "TOKEN_INVALID" };
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
    });
    return { ok: false, status: 0, code: "NETWORK" };
  }

  const data = await readJson(res);
  if (!res.ok) {
    return { ok: false, status: res.status, code: readErrorCode(data) };
  }

  const profileActivated =
    Boolean(data) &&
    typeof data === "object" &&
    (data as { profileActivated?: boolean }).profileActivated === true;

  return { ok: true, profileActivated };
}
