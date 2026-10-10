export type StoredUser = {
  token: string;
  roles: string[];
  username: string;
  firstName?: string;
  lastName?: string;
};

/** Reads the authenticated user from localStorage (client-side session). */
export function readStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  try {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) return null;
    const parsed = JSON.parse(savedUser) as StoredUser;
    if (!parsed?.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Best available display name for greetings.
 * Prefers firstName, then username; returns null when nothing usable exists.
 */
export function getGreetingName(user: StoredUser | null): string | null {
  if (!user) return null;
  const firstName = user.firstName?.trim();
  if (firstName) return firstName;
  const username = user.username?.trim();
  if (username) return username;
  return null;
}
