"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";

type Props = {
  onSuccess?: () => void;
};

export default function LoginForm({ onSuccess }: Props) {
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
    document.cookie = "token=; Max-Age=0; path=/";

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

      onSuccess?.();
      const redirect = searchParams.get("redirect");
      router.push(redirect || "/");
    } catch {
      alert(t("alerts.serverConnectionError"));
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4" data-testid="login-form">
      <div>
        <label
          htmlFor="login-email"
          className="block text-sm font-medium text-sawaka-800 mb-1"
        >
          {t("auth.email")}
        </label>
        <input
          id="login-email"
          type="email"
          placeholder={t("auth.emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-lg border px-3 py-2"
          data-testid="login-input-email"
        />
      </div>
      <div>
        <label
          htmlFor="login-password"
          className="block text-sm font-medium text-sawaka-800 mb-1"
        >
          {t("auth.password")}
        </label>
        <input
          id="login-password"
          type="password"
          placeholder={t("auth.passwordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-lg border px-3 py-2"
          data-testid="login-input-password"
        />
      </div>
      <button
        type="submit"
        className="btn-primary w-full"
        data-testid="login-submit"
      >
        {t("auth.login")}
      </button>
    </form>
  );
}
