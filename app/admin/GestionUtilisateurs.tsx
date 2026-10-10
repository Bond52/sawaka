"use client";
import { useEffect, useState } from "react";
import { useTranslation } from "@/src/i18n/I18nProvider";

type User = {
  _id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role?: string;
  roles?: string[];
  isSeller?: boolean;
};

export default function GestionUtilisateurs() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const API_BASE_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "https://ecommerce-web-avec-tailwind.onrender.com";

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
          credentials: "include",
        });

        if (!res.ok) {
          const txt = await res.text();
          console.error("❌ Erreur backend :", txt);
          throw new Error(`Erreur serveur (${res.status})`);
        }

        const data = await res.json();
        console.log("✅ Utilisateurs chargés :", data);
        setUsers(data);
      } catch (err: any) {
        console.error("⚠️ Erreur fetch utilisateurs :", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [API_BASE_URL]);

  const handleDelete = async (id: string) => {
    if (!confirm(t("alerts.deleteUserConfirm"))) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Erreur lors de la suppression");

      setUsers((prev) => prev.filter((u) => u._id !== id));
      alert(t("alerts.userDeleted"));
    } catch (err) {
      console.error(err);
      alert(t("alerts.categoryDeleteFailed"));
    }
  };

  if (loading) return <p className="text-center mt-4">{t("common.loading")}</p>;
  if (error)
    return (
      <p className="text-center text-red-600 mt-4">
        {t("admin.adminCheckError", { error })}
      </p>
    );

  return (
    <div className="mt-4">
      <h2 className="text-lg font-semibold mb-3">{t("admin.userList")}</h2>

      {users.length === 0 ? (
        <p className="text-gray-500 text-center">{t("admin.noUsers")}</p>
      ) : (
        <table className="w-full border border-gray-300 rounded-lg overflow-hidden">
          <thead className="bg-gray-100">
            <tr className="text-left">
              <th className="p-2">{t("admin.name")}</th>
              <th className="p-2">{t("admin.email")}</th>
              <th className="p-2">{t("admin.roles")}</th>
              <th className="p-2">{t("admin.seller")}</th>
              <th className="p-2 text-center">{t("admin.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className="border-t hover:bg-cream-50">
                <td className="p-2">
                  {u.firstName || u.lastName
                    ? `${u.firstName || ""} ${u.lastName || ""}`
                    : u.username || "—"}
                </td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">
                  {u.roles ? u.roles.join(", ") : u.role || "—"}
                </td>
                <td className="p-2">{u.isSeller ? `✅ ${t("common.yes")}` : `❌ ${t("common.no")}`}</td>
                <td className="p-2 text-center">
                  <button
                    onClick={() => handleDelete(u._id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    🗑 {t("common.delete")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
