"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";
import UploadImages from "../../components/UploadImages";
import { listMyArticles, createArticle, updateArticle, deleteArticle } from "../../lib/apiSeller";
import type { Article } from "../../lib/apiSeller";


/* ============================================================
   🧵 PAGE RESPÉRANT EXACTEMENT TON MOCKUP
============================================================ */


/* ============================================================
   🧵 VendorArticlesPage — version MAQUETTE complète
============================================================ */
const SELLER_CATEGORIES = [
  { value: "Mode & Accessoires", key: "fashion" },
  { value: "Maison & Décoration", key: "home" },
  { value: "Art & Artisanat", key: "art" },
  { value: "Beauté & Bien-être", key: "beauty" },
  { value: "Bijoux", key: "jewelry" },
  { value: "Textile", key: "textile" },
] as const;

export default function VendorArticlesPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const emptyForm: Article = {
    title: "",
    description: "",
    price: 0,
    stock: 0,
    status: "draft",
    images: [],
    categories: [],
    sku: "",
    promotion: {
      isActive: false,
      discountPercent: 0,
      newPrice: 0,
      durationDays: 0,
      durationHours: 0,
      startDate: "",
      endDate: "",
    },
    auction: {
      isActive: false,
      endDate: "",
      highestBid: 0,
    },
  };

  const [form, setForm] = useState<Article>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 👤 utilisateur connecté
const [user, setUser] = useState<any>(null);


    // 🔥 Empêche la perte du mode édition lorsque le composant re-render
  const editingRef = useRef<string | null>(null);

  useEffect(() => {
    editingRef.current = editingId;
  }, [editingId]);


// 🔍 Charger l'utilisateur connecté
useEffect(() => {
  async function fetchUser() {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE || "https://ecommerce-web-avec-tailwind.onrender.com"}/api/auth/me`,
        { credentials: "include" }
      );


if (res.ok) {
  const data = await res.json();
  setUser(data);    // utilisateur connecté
} else {
  setUser(false);   // utilisateur NON connecté
}



    } catch {

      setUser(false);

    }
  }
  fetchUser();
}, []);

console.log("USER =", user)


  async function load() {
    setLoading(true);
    const res = await listMyArticles({ page, q: "", status: "" });
    setData(res);
    setLoading(false);
  }

// 📌 Recharger les articles quand l'utilisateur ou la page change
useEffect(() => {
  // Tant que user === null → on attend la réponse du backend
  if (user === null) return;

  // Si user = false → pas connecté → on vide l’inventaire
  if (user === false) {
    setData({ items: [], total: 0, pages: 1 });
    return;
  }

  // Si user est un objet → charger l’inventaire
  load();
}, [user, page]);


  function onEdit(a: Article) {
    setEditingId(a._id!);

    setForm({
      ...a,
      images: a.images ?? [],
      promotion: {
        isActive: a.promotion?.isActive ?? false,
        discountPercent: a.promotion?.discountPercent ?? 0,
        newPrice: a.promotion?.newPrice ?? 0,
        durationDays: a.promotion?.durationDays ?? 0,
        durationHours: a.promotion?.durationHours ?? 0,
        startDate: a.promotion?.startDate ?? "",
        endDate: a.promotion?.endDate ?? "",
      },
    });
  }

  async function onSubmit(e: any) {
    e.preventDefault();
    if (editingId) {
      await updateArticle(editingId, form);
    } else {
      await createArticle(form);
    }
    setForm(emptyForm);
    setEditingId(null);
    load();
  }

  console.log("📤 FORMULAIRE ENVOYÉ AU BACKEND :", JSON.stringify(form, null, 2));


  async function onDelete(id?: string) {
  if (!id) return;
  if (!confirm(t("alerts.deleteArticleConfirm"))) return;

  await deleteArticle(id);
  load();
}


  return (
    <div className="wrap py-10 space-y-12">

      {/* ========================= */}
      {/* TITRE */}
      {/* ========================= */}
      <h1 className="font-display text-3xl text-sawaka-900">{t("seller.myCreations")}</h1>

      {/* ========================= */}
      {/* FORMULAIRE PRINCIPAL */}
      {/* ========================= */}
      <form
        onSubmit={onSubmit}
        className="bg-white border border-cream-200 shadow-card rounded-2xl p-8 space-y-6"
      >
        <h2 className="font-display text-2xl text-sawaka-900 mb-6">
          {t("seller.addProduct")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input label={t("seller.title")} value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <Select
            label={t("seller.category")}
            value={form.categories?.[0] || ""}
            onChange={(v) => setForm({ ...form, categories: [v] })}
            options={SELLER_CATEGORIES.map((c) => c.value)}
            optionLabels={Object.fromEntries(
              SELLER_CATEGORIES.map((c) => [c.value, t(`seller.categories.${c.key}`)])
            )}
            placeholder={t("seller.chooseOption")}
          />

          <Input label={t("seller.price")} numeric value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
          <Input label={t("seller.stock")} numeric value={form.stock} onChange={(v) => setForm({ ...form, stock: v })} />

          <Input label={t("seller.sku")} value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} />
          <Select
            label={t("seller.status")}
            value={form.status}
            onChange={(v) => setForm({ ...form, status: v })}
            options={["draft", "published"]}
            displayMap={{ draft: t("seller.draft"), published: t("seller.published") }}
            placeholder={t("seller.chooseOption")}
          />
        </div>

        {/* ========================= */}
        {/* DESCRIPTION */}
        {/* ========================= */}
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="border border-gray-300 rounded-xl p-4 w-full h-32"
          placeholder={t("seller.descriptionPlaceholder")}
        />

        {/* ========================= */}
        {/* 📸 UPLOAD IMAGES — CORRIGÉ */}
        {/* ========================= */}
        <UploadImages
          existingImages={form.images}
          onRemoveExisting={(url) =>
            setForm((f) => ({ ...f, images: f.images.filter((i) => i !== url) }))
          }
          onUploadComplete={(urls) =>
            setForm((f) => ({ ...f, images: [...f.images, ...urls] }))
          }
        />

        {/* ========================= */}
        {/* CTA */}
        {/* ========================= */}
<button
  type="submit"
  className="mt-6 px-6 py-3 rounded-xl bg-sawaka-700 text-white hover:bg-sawaka-800"
>
 {editingId ? t("seller.updateProduct") : t("seller.createProduct")}
</button>

      </form>

      {/* ======================================================= */}
      {/* 📦 INVENTAIRE ACTUEL */}
      {/* ======================================================= */}

      <h2 className="font-display text-2xl text-sawaka-900 mt-10">
        {t("seller.inventory")}
      </h2>

      <div className="bg-white border border-cream-200 rounded-2xl shadow-card p-6">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-sawaka-700 text-xs border-b bg-cream-50">
                <th className="p-3 text-left">{t("seller.colTitle")}</th>
                <th className="p-3 text-left">{t("seller.colPrice")}</th>
                <th className="p-3 text-left">{t("seller.colStock")}</th>
                <th className="p-3 text-left">{t("seller.colCategory")}</th>
                <th className="p-3 text-left">{t("seller.colStatus")}</th>
                <th className="p-3 text-left">{t("seller.colPromo")}</th>
                <th className="p-3 text-left">{t("seller.colActions")}</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center">
                    {t("common.loadingShort")}
                  </td>
                </tr>
              ) : data?.items?.length ? (
                data.items.map((a: Article) => (
                  <tr key={a._id} className="border-b last:border-0">
                    {/* Titre */}
                    <td className="p-3 font-medium text-sawaka-900">
                      {a.title}
                    </td>

                    {/* Prix */}
                    <td className="p-3">{a.price?.toLocaleString()} FCFA</td>

                    {/* Stock */}
                    <td className="p-3">{a.stock}</td>

                    {/* Catégorie */}
                    <td className="p-3">
                      {a.categories?.length ? (
                        <span className="px-3 py-1 rounded-full bg-cream-100 text-sawaka-800 text-xs">
                          {a.categories[0]}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>

                    {/* Statut */}
                    <td className="p-3">
                      {a.status === "published" ? (
                        <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                          ● {t("seller.published")}
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-gray-200 text-gray-700 text-xs font-semibold">
                          ● {t("seller.draft")}
                        </span>
                      )}
                    </td>

                    {/* Promotion */}
                    <td className="p-3">
                      {a.promotion?.isActive ? (
                        <span className="text-sawaka-800 font-medium">
                          {a.promotion.discountPercent}%{" "}
                          <span className="text-xs text-sawaka-600">
                            ({a.promotion.newPrice} FCFA)
                          </span>
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3 flex gap-3">
                      <button
                        onClick={() => onEdit(a)}
                        className="text-sawaka-700 hover:underline"
                      >
                        {t("common.edit")}
                      </button>

                      <button
                        onClick={() => onDelete(a._id)}
                        className="text-red-600 hover:underline"
                      >
                        {t("common.delete")}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-sawaka-700">
                    {t("seller.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ======================================================= */}
        {/* PAGINATION */}
        {/* ======================================================= */}
        <div className="flex items-center justify-between mt-4 text-sm text-sawaka-700">
          <p>
            {t("seller.showing", { shown: data?.items?.length ?? 0, total: data?.total ?? 0 })}
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className={`px-3 py-1 rounded-lg border ${
                page === 1
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-cream-50"
              }`}
            >
              {t("common.prev")}
            </button>

            <button
              onClick={() => setPage((p) => Math.min(data?.pages ?? 1, p + 1))}
              disabled={page === data?.pages}
              className={`px-3 py-1 rounded-lg border ${
                page === data?.pages
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-cream-50"
              }`}
            >
              {t("common.next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================================================= */
/* 🔧 INPUT + SELECT Components (identiques au mockup UI)  */
/* ======================================================= */
function Input({ label, value, onChange, placeholder, numeric }: any) {
  return (
    <div>
      <label className="text-sm text-sawaka-800 mb-1 block">{label}</label>
      <input
        type="text"
        inputMode={numeric ? "numeric" : undefined}
        pattern={numeric ? "[0-9]*" : undefined}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          if (!numeric) return onChange(raw);
          const digits = raw.replace(/\D/g, "");
          onChange(digits === "" ? 0 : Number(digits));
        }}
        onKeyDown={(e) => {
          if (!numeric) return;
          if (["-", "+", "e", "E", ".", ","].includes(e.key)) e.preventDefault();
        }}
        className="border border-gray-300 rounded-xl p-3 w-full"
      />
    </div>
  );
}

function Select({ label, value, onChange, options, displayMap, optionLabels, placeholder }: any) {
  return (
    <div>
      <label className="text-sm text-sawaka-800 mb-1 block">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 rounded-xl p-3 w-full"
      >
        <option value="">{placeholder}</option>
        {options.map((opt: string) => (
          <option key={opt} value={opt}>
            {optionLabels?.[opt] ?? displayMap?.[opt] ?? opt}
          </option>
        ))}
      </select>
    </div>
  );
}

