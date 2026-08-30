"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const API_URL =
    process.env.NEXT_PUBLIC_API_BASE ||
    (typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "http://localhost:5000"
      : "https://ecommerce-web-avec-tailwind.onrender.com");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.removeItem("user");
    document.cookie =
      "token=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; secure; SameSite=None";
    document.cookie =
      "token=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; secure";
    document.cookie =
      "token=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    document.cookie =
      "token=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.sawaka.org; secure; SameSite=None";
    document.cookie =
      "token=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.sawaka.org";

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) return alert(data.error || t("alerts.wrongCredentials"));

      if (data.token) {
        localStorage.setItem(
          "user",
          JSON.stringify({
            token: data.token,
            roles: data.roles,
            username: data.username || email.split("@")[0],
            firstName: data.firstName || "",
            lastName: data.lastName || "",
          })
        );
        window.dispatchEvent(new Event("sawaka-auth-changed"));
      }

      const redirect = searchParams.get("redirect");
      router.push(redirect || "/");
    } catch {
      alert(t("alerts.serverConnectionError"));
    }
  };

  return (
    <main className="flex items-center justify-center min-h-[70vh] bg-cream-100">
      <div className="card w-full max-w-md">
        <div className="card-body">
          <h1
            className="text-2xl font-bold text-center mb-6"
            data-testid="login-page-title"
          >
            {t("auth.login")}
          </h1>
          <form
            onSubmit={handleLogin}
            className="space-y-4"
            data-testid="login-form"
          >
            <div>
              <label
                htmlFor="login-page-email"
                className="block text-sm font-medium text-sawaka-800 mb-1"
              >
                {t("auth.email")}
              </label>
              <input
                id="login-page-email"
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-sawaka-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sawaka-500"
                data-testid="login-input-email"
              />
            </div>
            <div>
              <label
                htmlFor="login-page-password"
                className="block text-sm font-medium text-sawaka-800 mb-1"
              >
                {t("auth.password")}
              </label>
              <input
                id="login-page-password"
                type="password"
                placeholder={t("auth.passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-sawaka-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sawaka-500"
                data-testid="login-input-password"
              />
            </div>
            <button
              type="submit"
              className="btn-primary w-full mt-4"
              data-testid="login-submit"
            >
              {t("auth.login")}
            </button>
          </form>
          <p className="text-center text-sm text-sawaka-700 mt-6">
            {t("auth.noAccount")}{" "}
            <a
              href="/register"
              data-testid="login-page-register-link"
              className="text-sawaka-600 hover:text-sawaka-800 font-semibold"
            >
              {t("auth.createOne")}
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
