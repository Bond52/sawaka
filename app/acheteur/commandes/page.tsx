'use client';

import { useEffect, useState } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";

type Order = {
  _id: string;
  orderNumber?: string;
  total: number;
  status: string;
  createdAt: string;
  items: {
    articleId: string;
    title: string;
    price: number;
    quantity: number;
  }[];
};

export default function MesCommandesPage() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"enCours" | "terminees">("enCours");

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      window.location.href = "/login?redirect=/acheteur/commandes";
      return;
    }

    const user = JSON.parse(userStr);
    if (!user.token || !user.roles.includes("acheteur")) {
      window.location.href = "/login?redirect=/acheteur/commandes";
      return;
    }

    const fetchOrders = async () => {
      try {
        const res = await fetch(
          (process.env.NEXT_PUBLIC_API_BASE ??
            "https://ecommerce-web-avec-tailwind.onrender.com") + "/api/orders",
          {
            headers: { Authorization: `Bearer ${user.token}` },
            credentials: "include",
          }
        );
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setOrders(data);
      } catch (err: any) {
        setError(t("orders.loadError"));
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [t]);

  if (loading) return <p className="text-center py-10">⏳ {t("common.loading")}</p>;
  if (error) return <p className="text-center text-red-600 py-10">❌ {error}</p>;

  const commandesEnCours = orders.filter(
    (o) => o.status !== "terminée" && o.status !== "livrée"
  );
  const commandesTerminees = orders.filter(
    (o) => o.status === "terminée" || o.status === "livrée"
  );

  const commandesAffichees =
    activeTab === "enCours" ? commandesEnCours : commandesTerminees;

  return (
    <main className="wrap py-8">
      <h1 className="text-2xl font-bold text-sawaka-700 mb-6">
        📦 {t("orders.title")}
      </h1>

      <div className="flex gap-4 border-b border-cream-200 mb-6">
        <button
          onClick={() => setActiveTab("enCours")}
          className={`px-4 py-2 font-medium ${
            activeTab === "enCours"
              ? "text-sawaka-600 border-b-2 border-sawaka-600"
              : "text-sawaka-400 hover:text-sawaka-600"
          }`}
        >
          {t("orders.inProgress", { count: commandesEnCours.length })}
        </button>
        <button
          onClick={() => setActiveTab("terminees")}
          className={`px-4 py-2 font-medium ${
            activeTab === "terminees"
              ? "text-sawaka-600 border-b-2 border-sawaka-600"
              : "text-sawaka-400 hover:text-sawaka-600"
          }`}
        >
          {t("orders.completed", { count: commandesTerminees.length })}
        </button>
      </div>

      {commandesAffichees.length === 0 ? (
        <p className="text-sawaka-600">
          {activeTab === "enCours" ? t("orders.noneInProgress") : t("orders.noneCompleted")}
        </p>
      ) : (
        <div className="space-y-4">
          {commandesAffichees.map((order) => (
            <div
              key={order._id}
              className="card border border-cream-200 shadow-sm"
            >
              <div className="card-body">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="font-semibold text-sawaka-700">
                    {t("orders.orderNumber")}{order.orderNumber || order._id}
                  </h2>
                  <span
                    className={`px-3 py-1 text-xs rounded-full ${
                      order.status === "en cours"
                        ? "bg-yellow-100 text-yellow-800"
                        : order.status === "livrée" || order.status === "terminée"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>

                <ul className="divide-y divide-cream-200 mb-3">
                  {order.items.map((it, i) => (
                    <li key={i} className="py-2 flex justify-between text-sm">
                      <span>{it.title} × {it.quantity}</span>
                      <span>{it.price} {t("common.fcfa")}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex justify-between text-sm text-sawaka-600">
                  <span>{t("orders.totalLabel")} <strong>{order.total} {t("common.fcfa")}</strong></span>
                  <span>{t("orders.createdOn")} {new Date(order.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
