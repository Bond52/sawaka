"use client";

import { useEffect, useState } from "react";
import {
  useParams,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { ArrowLeft, Mail, Phone, MapPin, User } from "lucide-react";
import { getArtisan, Artisan } from "@/app/lib/apiArtisans";

type Tab = "produits" | "projets";

export default function ArtisanDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const from = searchParams.get("from"); // 👈 origine

  const [artisan, setArtisan] = useState<Artisan | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("produits");

  useEffect(() => {
    if (!id) return;

    getArtisan(id as string)
      .then(setArtisan)
      .catch(() => setArtisan(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleBack = () => {
    if (from === "reseau") {
      router.push("/reseau");
    } else if (from === "fournisseurs") {
      router.push("/fournisseurs");
    } else {
      router.push("/artisans");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-gray-600">Chargement...</p>
      </div>
    );
  }

  if (!artisan) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h2 className="text-xl font-bold mb-2">Artisan introuvable</h2>
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mt-4"
        >
          <ArrowLeft size={20} /> Retour
        </button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white p-6">
      {/* RETOUR */}
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={20} /> Retour
      </button>

      {/* ===== CARTE ARTISAN ===== */}
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-8 border border-gray-200">
        <div className="flex flex-col items-center mb-6">
          <img
            src={
              artisan.avatarUrl ||
              "https://via.placeholder.com/200x200?text=Artisan"
            }
            alt="artisan"
            className="w-48 h-48 object-cover rounded-xl border border-gray-300"
          />

          <h1 className="mt-4 text-3xl font-bold text-gray-900">
            {artisan.firstName} {artisan.lastName}
          </h1>

          <p className="text-gray-500">{artisan.username}</p>
        </div>

        <div className="space-y-3 text-gray-700">
          {artisan.email && (
            <p className="flex items-center gap-2">
              <Mail size={18} /> {artisan.email}
            </p>
          )}

          {artisan.phone && (
            <p className="flex items-center gap-2">
              <Phone size={18} /> {artisan.phone}
            </p>
          )}

          {(artisan.city || artisan.province) && (
            <p className="flex items-center gap-2">
              <MapPin size={18} /> {artisan.city}, {artisan.province}
            </p>
          )}

          {artisan.commerceName && (
            <p className="flex items-center gap-2">
              <User size={18} /> Commerce : {artisan.commerceName}
            </p>
          )}
        </div>
      </div>

      {/* ===== ONGLET ===== */}
      <div className="max-w-3xl mx-auto mt-10">
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab("produits")}
            className={`px-4 py-2 font-medium ${
              activeTab === "produits"
                ? "border-b-2 border-sawaka-600 text-sawaka-700"
                : "text-gray-500"
            }`}
          >
            Produits
          </button>

          <button
            onClick={() => setActiveTab("projets")}
            className={`ml-6 px-4 py-2 font-medium ${
              activeTab === "projets"
                ? "border-b-2 border-sawaka-600 text-sawaka-700"
                : "text-gray-500"
            }`}
          >
            Projets
          </button>
        </div>

        {activeTab === "produits" && (
          <p className="italic text-gray-600">
            Aucun produit publié pour le moment.
          </p>
        )}

        {activeTab === "projets" && (
          <p className="italic text-gray-600">
            Aucun projet associé à cet artisan pour le moment.
          </p>
        )}
      </div>
    </main>
  );
}
