"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/src/i18n/I18nProvider";

// Mini base de données Cameroun
const provincesCM: Record<string, string[]> = {
  Centre: ["Yaoundé", "Mbalmayo", "Obala"],
  Littoral: ["Douala", "Nkongsamba", "Yabassi"],
  Ouest: ["Bafoussam", "Dschang", "Foumban"],
  Nord: ["Garoua", "Guider", "Pitoa"],
  "Extrême-Nord": ["Maroua", "Kousséri", "Mora"],
  Sud: ["Ebolowa", "Kribi", "Sangmélima"],
  Est: ["Bertoua", "Batouri", "Abong-Mbang"],
  "Nord-Ouest": ["Bamenda", "Kumbo", "Ndop"],
  "Sud-Ouest": ["Buea", "Limbe", "Kumba"],
  Adamaoua: ["Ngaoundéré", "Meiganga", "Tibati"],
};

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useTranslation();

  // ✔ tout le monde est vendeur
  const isSeller = true;

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    phone: "",
    country: "Cameroun",
    province: "",
    city: "",
    pickupPoint: "",
    password: "",
    commerceName: "",
    neighborhood: "",
    idCardImage: "",
  });

  const API_URL =
    process.env.NEXT_PUBLIC_API_BASE ||
    (typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "http://localhost:5000"
      : "https://ecommerce-web-avec-tailwind.onrender.com");

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "province" ? { city: "" } : {}),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, isSeller }),
      });

      const data = await res.json();
      if (!res.ok) {
        return alert(data.error || t("alerts.registerFailed"));
      }

      if (data.token) {
        localStorage.setItem(
          "user",
          JSON.stringify({
            token: data.token,
            roles: data.roles,
            username: data.username || form.username,
            firstName: data.firstName || form.firstName,
            lastName: data.lastName || form.lastName,
          })
        );
        window.dispatchEvent(new Event("sawaka-auth-changed"));
      }

      router.push("/");
    } catch {
      alert(t("alerts.serverConnectionError"));
    }
  };

  return (
    <main className="flex items-center justify-center min-h-[70vh] bg-cream-100">
      <div className="card w-full max-w-2xl">
        <div className="card-body">
          <h1
            className="text-2xl font-bold text-center mb-6"
            data-testid="register-page-title"
          >
            {t("auth.createAccount")}
          </h1>

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
            data-testid="register-form"
          >
            <div className="grid grid-cols-2 gap-4">
              <input
                name="firstName"
                placeholder={t("register.lastName")}
                value={form.firstName}
                onChange={handleChange}
                required
                className="input"
                data-testid="register-input-firstName"
              />
              <input
                name="lastName"
                placeholder={t("register.firstName")}
                value={form.lastName}
                onChange={handleChange}
                required
                className="input"
                data-testid="register-input-lastName"
              />
            </div>

            <input
              name="username"
              placeholder={t("register.username")}
              value={form.username}
              onChange={handleChange}
              required
              className="input w-full"
              data-testid="register-input-username"
            />

            <input
              type="email"
              name="email"
              placeholder={t("auth.email")}
              value={form.email}
              onChange={handleChange}
              required
              className="input w-full"
              data-testid="register-input-email"
            />

            <input
              type="tel"
              name="phone"
              placeholder={t("register.phone")}
              value={form.phone}
              onChange={handleChange}
              required
              className="input w-full"
              data-testid="register-input-phone"
            />

            <div className="grid grid-cols-3 gap-2">
              <select
                name="country"
                value={form.country}
                onChange={handleChange}
                required
                className="input"
                data-testid="register-input-country"
              >
                <option value="Cameroun">{t("register.countryCameroon")}</option>
                <option value="Canada">{t("register.countryCanada")}</option>
              </select>

              <select
                name="province"
                value={form.province}
                onChange={handleChange}
                required
                className="input"
                data-testid="register-input-province"
              >
                <option value="">{t("register.province")}</option>
                {Object.keys(provincesCM).map((prov) => (
                  <option key={prov} value={prov}>
                    {prov}
                  </option>
                ))}
              </select>

              <select
                name="city"
                value={form.city}
                onChange={handleChange}
                required
                className="input"
                disabled={!form.province}
                data-testid="register-input-city"
              >
                <option value="">{t("register.city")}</option>
                {form.province &&
                  provincesCM[form.province]?.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
              </select>
            </div>

            {form.city && (
              <select
                name="pickupPoint"
                value={form.pickupPoint}
                onChange={handleChange}
                className="input w-full"
                data-testid="register-input-pickupPoint"
              >
                <option value="">{t("register.pickupPoint")}</option>
                <option value="centre-ville">
                  {t("register.pickupDowntown")}
                </option>
                <option value="gare">{t("register.pickupStation")}</option>
                <option value="université">
                  {t("register.pickupUniversity")}
                </option>
              </select>
            )}

            <input
              type="password"
              name="password"
              placeholder={t("auth.password")}
              value={form.password}
              onChange={handleChange}
              required
              className="input w-full"
              data-testid="register-input-password"
            />

            <div className="space-y-3 border-t pt-4">
              <input
                name="commerceName"
                placeholder={t("register.shopNameOptional")}
                value={form.commerceName}
                onChange={handleChange}
                className="input w-full"
              />
              <textarea
                name="neighborhood"
                placeholder={t("register.districtOptional")}
                value={form.neighborhood}
                onChange={handleChange}
                className="input w-full"
              />
              <input
                name="idCardImage"
                placeholder={t("register.idLinkOptional")}
                value={form.idCardImage}
                onChange={handleChange}
                className="input w-full"
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full mt-4"
              data-testid="register-submit"
            >
              {t("navigation.register")}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
