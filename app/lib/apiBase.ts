const DEFAULT_API_BASE = "https://ecommerce-web-avec-tailwind.onrender.com";

/** Base URL for backend API calls (QA/prod via NEXT_PUBLIC_API_BASE). */
export function resolveApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  if (
    typeof window !== "undefined" &&
    window.location.hostname === "localhost"
  ) {
    return "http://localhost:5000";
  }

  return DEFAULT_API_BASE;
}
