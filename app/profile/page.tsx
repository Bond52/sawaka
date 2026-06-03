"use client";
import { useEffect, useState } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";

const provincesCM = {
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

export default function ProfilePage() {
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const API_URL =
    process.env.NEXT_PUBLIC_API_BASE ||
    (typeof window !== "undefined" &&
    window.location.hostname === "localhost"
      ? "http://localhost:5000"
      : "https://ecommerce-web-avec-tailwind.onrender.com");

  useEffect(() => {
    fetch(`${API_URL}/api/user/profile`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(t("profile.loadError"));
        return res.json();
      })
      .then((data) => {
        setUser(data);
        setForm(data);
      })
      .catch((err) => setError(err.message));
  }, [API_URL, t]);

  if (error) return <p className="text-center text-red-600 mt-6">{error}</p>;
  if (!form) return <p className="text-center mt-6 text-gray-600">{t("common.loading")}</p>;

  const isModified = JSON.stringify(user) !== JSON.stringify(form);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("avatar", file);

    const res = await fetch(`${API_URL}/api/user/upload-avatar`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    const data = await res.json();
    if (data.url) {
      updateField("avatarUrl", data.url);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    const res = await fetch(`${API_URL}/api/user/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
      credentials: "include",
    });

    setSaving(false);

    if (res.ok) {
      const updated = await res.json();
      setUser(updated);
      setForm(updated);
      alert(t("alerts.profileUpdated"));
    } else {
      alert(t("alerts.profileUpdateError"));
    }
  };

  return (
    <div className="wrap py-12">
      <h1 className="text-3xl font-bold text-sawaka-800 mb-10">{t("profile.title")}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="space-y-8">
          <div className="bg-white border border-cream-200 rounded-2xl shadow-card p-6 text-center">
            <div className="w-32 h-32 rounded-full overflow-hidden mx-auto mb-4">
              {form.avatarUrl ? (
                <img src={form.avatarUrl} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full bg-sawaka-200 flex items-center justify-center text-4xl font-bold text-sawaka-700">
                  {form.firstName?.[0]}
                  {form.lastName?.[0]}
                </div>
              )}
            </div>

            <label className="btn btn-primary w-full cursor-pointer">
              {t("profile.changePhoto")}
              <input type="file" className="hidden" onChange={handleAvatarUpload} />
            </label>
          </div>

          <div className="bg-white border border-cream-200 rounded-2xl shadow-card p-6">
            <h3 className="text-sawaka-800 font-semibold mb-2">{t("profile.roles")}</h3>
            <input
              value={form.roles || ""}
              onChange={(e) => updateField("roles", e.target.value)}
              className="border rounded-lg p-2 w-full mb-4"
            />

            <h3 className="text-sawaka-800 font-semibold mb-2">{t("profile.about")}</h3>
            <textarea
              value={form.about || ""}
              onChange={(e) => updateField("about", e.target.value)}
              className="border rounded-lg p-3 w-full h-32"
            />
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <Card title={t("profile.personalInfo")}>
            <Grid>
              <Input label={t("profile.username")} value={form.username} onChange={(e) => updateField("username", e.target.value)} />
              <Input label={t("profile.displayName")} value={form.nickname} onChange={(e) => updateField("nickname", e.target.value)} />
              <Input label={t("profile.firstName")} value={form.firstName} onChange={(e) => updateField("firstName", e.target.value)} />
              <Input label={t("profile.lastName")} value={form.lastName} onChange={(e) => updateField("lastName", e.target.value)} />
            </Grid>
          </Card>

          <Card title={t("profile.contact")}>
            <Grid>
              <Input label={t("auth.email")} value={form.email} onChange={(e) => updateField("email", e.target.value)} />
              <Input label={t("profile.phone")} value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
              <Input label={t("profile.country")} value={form.country} onChange={(e) => updateField("country", e.target.value)} />
              <Select label={t("profile.province")} value={form.province} onChange={(e) => updateField("province", e.target.value)} options={Object.keys(provincesCM)} placeholder={t("common.select")} />
              <Select label={t("profile.city")} value={form.city} onChange={(e) => updateField("city", e.target.value)} options={form.province ? provincesCM[form.province] : []} placeholder={t("common.select")} />
              <Input label={t("profile.pickupPoint")} value={form.pickupPoint} onChange={(e) => updateField("pickupPoint", e.target.value)} />
            </Grid>
          </Card>

          {form.isSeller && (
            <Card title={t("profile.sellerSpace")}>
              <Grid>
                <Input label={t("profile.shopName")} value={form.commerceName} onChange={(e) => updateField("commerceName", e.target.value)} />
                <Input label={t("profile.district")} value={form.neighborhood} onChange={(e) => updateField("neighborhood", e.target.value)} />
                <Input label={t("profile.idDocument")} value={form.idCardImage} onChange={(e) => updateField("idCardImage", e.target.value)} />
              </Grid>
            </Card>
          )}

          <div className="text-center">
            <button
              disabled={!isModified || saving}
              onClick={handleSave}
              className={`px-6 py-3 rounded-xl font-semibold ${
                !isModified || saving
                  ? "bg-gray-300 cursor-not-allowed text-gray-600"
                  : "bg-sawaka-700 text-white hover:bg-sawaka-800"
              }`}
            >
              {saving ? t("profile.saving") : t("profile.update")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-white border border-cream-200 rounded-2xl shadow-card p-8">
      <h3 className="text-xl font-semibold text-sawaka-800 mb-6">{title}</h3>
      {children}
    </div>
  );
}

function Grid({ children }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">{children}</div>;
}

function Input({ label, value, onChange }) {
  return (
    <div className="flex flex-col">
      <label className="text-sawaka-700 mb-1">{label}</label>
      <input value={value} onChange={onChange} className="border border-gray-300 rounded-lg p-3" />
    </div>
  );
}

function Select({ label, value, onChange, options, placeholder }) {
  return (
    <div className="flex flex-col">
      <label className="text-sawaka-700 mb-1">{label}</label>
      <select value={value || ""} onChange={onChange} className="border border-gray-300 rounded-lg p-3">
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}
