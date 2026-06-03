"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ShoppingCart, Heart, Star, User, MessageCircle, ArrowLeft } from "lucide-react";
import { useTranslation } from "@/src/i18n/I18nProvider";

interface Comment {
  _id?: string;
  user?: { username?: string; firstName?: string; lastName?: string };
  text: string;
  rating: number;
  createdAt?: string;
}

interface Article {
  _id: string;
  title: string;
  description?: string;
  price: number;
  stock: number;
  images?: string[];
  likes?: string[];
  comments?: Comment[];
  categories?: string[];
  vendorId?: {
    _id: string;
    username?: string;
    commerceName?: string;
    city?: string;
    province?: string;
  };
  status?: string;
  auction?: {
    isActive: boolean;
    highestBid: number;
    highestBidder?: string;
    endDate: string;
  };
}

export default function ProduitDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liked, setLiked] = useState(false);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(5);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [newBid, setNewBid] = useState("");

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://ecommerce-web-avec-tailwind.onrender.com";

  // Charger l'article
  useEffect(() => {
    if (!id) return;

    const fetchArticle = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API_BASE}/api/seller/public/${id}`);


        if (!res.ok) {
          throw new Error(`Erreur ${res.status}`);
        }

        const data = await res.json();
        setArticle(data);
      } catch (err) {
        console.error("Erreur chargement article :", err);
        setError(t("products.loadError"));
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id, API_BASE]);

  // Ajouter au panier
  const handleAddToCart = () => {
    if (!article) return;

    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    const existingItem = cart.find((item: any) => item._id === article._id);

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.push({
        _id: article._id,
        title: article.title,
        price: article.price,
        image: article.images?.[0] || "/placeholder.png",
        quantity: quantity,
      });
    }

    localStorage.setItem("cart", JSON.stringify(cart));
    alert(t("alerts.cartItemsAdded", { count: quantity }));
  };

  // Like / Unlike
  const handleLike = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!id) return;

    try {
      const res = await fetch(`${API_BASE}/api/seller/articles/${id}/like`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(t("alerts.loginToLike"));
      }

      const data = await res.json();
      setLiked(!!data.liked);

      if (article) {
        const totalLikes = typeof data.totalLikes === "number" ? data.totalLikes : article.likes?.length || 0;
        setArticle({ ...article, likes: Array.from({ length: totalLikes }, () => "x") });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : t("alerts.likeError"));
    }
  };

  // Ajouter un commentaire
  const handleComment = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!id || !comment.trim()) {
      alert(t("alerts.writeComment"));
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/seller/articles/${id}/comment`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: comment.trim(), rating }),
      });

      if (!res.ok) {
        throw new Error(t("alerts.loginToComment"));
      }

      setComment("");
      setRating(5);

      const refreshRes = await fetch(`${API_BASE}/api/seller/articles/${id}`);
      const refreshedData = await refreshRes.json();
      setArticle(refreshedData);
    } catch (err) {
      alert(err instanceof Error ? err.message : t("alerts.commentError"));
    }
  };

  // 🔨 Fonction pour enchérir
  const handleBid = async () => {
    if (!article) return;
    if (!newBid) return alert(t("alerts.enterAmount"));
    const bidAmount = parseFloat(newBid);

    if (isNaN(bidAmount) || bidAmount <= (article.auction?.highestBid || 0)) {
      return alert(t("alerts.bidMustExceed"));
    }

    try {
      const res = await fetch(`${API_BASE}/api/auction/${article._id}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount: bidAmount }),
      });

      const data = await res.json();
      if (res.ok) {
        setArticle((prev) =>
          prev
            ? { ...prev, auction: { ...prev.auction, highestBid: data.highestBid } }
            : prev
        );
        setNewBid("");
        alert(t("alerts.bidSuccess"));
      } else {
        alert(data.message || t("alerts.bidError"));
      }
    } catch (err) {
      console.error(err);
      alert(t("alerts.bidNetworkError"));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-sawaka-600"></div>
          <p className="mt-4 text-sawaka-700">{t("products.loadingDetail")}</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-sawaka-800 mb-4">{t("products.notFound")}</h1>
          <p className="text-sawaka-600 mb-6">{error || t("products.notFoundDesc")}</p>
          <button onClick={() => router.push("/produits")} className="btn-primary">
            {t("products.backToProducts")}
          </button>
        </div>
      </div>
    );
  }

  const averageRating = article.comments?.length
    ? (article.comments.reduce((sum, c) => sum + c.rating, 0) / article.comments.length).toFixed(1)
    : "0.0";

  return (
    <div className="bg-cream-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          onClick={() => router.push("/produits")}
          className="flex items-center gap-2 text-sawaka-700 hover:text-sawaka-900 mb-6 transition"
        >
          <ArrowLeft size={20} /> {t("products.backToProducts")}
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 bg-white rounded-2xl shadow-lg p-6 lg:p-8">
          {/* Images */}
          <div className="space-y-4">

            <div className="relative aspect-square rounded-xl overflow-hidden bg-cream-100">
<img
  src={article.images?.[selectedImage] || "/placeholder.png"}
  alt={article.title}
  className="w-full h-full object-contain object-center"
/>



              {article.stock === 0 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">{t("products.outOfStock")}</span>
                </div>
              )}
            </div>
            {article.images && article.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {article.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition ${
                      selectedImage === idx
                        ? "border-sawaka-600"
                        : "border-transparent hover:border-sawaka-300"
                    }`}
                  >
                    <img src={img} alt={`${article.title} ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Infos produit */}
          <div className="flex flex-col">
            <div className="flex-1">
              <h1 className="text-3xl lg:text-4xl font-bold text-sawaka-900 mb-4">{article.title}</h1>
              <p className="text-sawaka-700 mb-6 leading-relaxed">{article.description || t("products.noDescription")}</p>

              {/* 💰 Section enchère */}
              {article.status === "auction" && article.auction?.isActive ? (
                <div className="border rounded-xl bg-cream-50 p-6 mb-6">
                  <h3 className="text-xl font-semibold text-sawaka-900 mb-3">💰 {t("products.auction")}</h3>
                  <p className="text-lg mb-2">
                    {t("products.currentBid")}{" "}
                    <span className="font-bold text-green-600">
                      {article.auction.highestBid.toLocaleString()} {t("common.fcfa")}
                    </span>
                  </p>
                  <p className="text-sawaka-600 mb-4">
                    {t("products.endsOn")}{" "}
                    <span className="font-semibold">
                      {new Date(article.auction.endDate).toLocaleString("fr-FR")}
                    </span>
                  </p>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      value={newBid}
                      onChange={(e) => setNewBid(e.target.value)}
                      placeholder={t("products.yourBid")}
                      className="border rounded-lg p-2 flex-1"
                    />
                    <button onClick={handleBid} className="btn-primary">
                      {t("products.placeBid")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-cream-100 rounded-xl p-6 mb-6">
                  <p className="text-4xl font-bold text-sawaka-800">
                    {article.price.toLocaleString()} <span className="text-2xl">{t("common.fcfa")}</span>
                  </p>
                  <p className="text-sawaka-600 mt-2">
                    {t("products.stockAvailable")} <span className="font-semibold">{article.stock}</span>
                  </p>
                </div>
              )}

{/* Quantité + Panier */}
{article.status !== "auction" && (
  <div className="mb-6">

    {/* 🛒 Panier désactivé (masqué) */}
    {/*
    <div className="mb-6">
      <label className="block text-sawaka-800 font-medium mb-2">Quantité</label>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setQuantity(Math.max(1, quantity - 1))}
          className="w-10 h-10 rounded-lg border-2 border-sawaka-300"
        >
          -
        </button>

        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-20 h-10 text-center border-2 border-sawaka-300 rounded-lg"
          min="1"
          max={article.stock}
        />

        <button
          onClick={() => setQuantity(quantity + 1)}
          className="w-10 h-10 rounded-lg border-2 border-sawaka-300"
        >
          +
        </button>
      </div>
    </div>

    <div className="flex gap-3 mb-6">
      <button
        onClick={handleAddToCart}
        disabled={article.stock === 0}
        className="flex-1 btn-primary flex items-center justify-center gap-2"
      >
        <ShoppingCart size={20} /> Ajouter au panier
      </button>
    </div>
    */}

    {/* ⭐ Nouveau bouton Contact = même taille que “Ajouter au panier” */}
    <div className="flex gap-3">
      <button
        onClick={() => router.push(`/artisans/${article.vendorId?._id}`)}
        className="flex-1 btn-primary flex items-center justify-center gap-2"
      >
        <MessageCircle size={18} /> {t("products.contactArtisan")}
      </button>

      {/* ❤️ Bouton Like placé à droite du bouton Contact */}
      <button
        type="button"
        onClick={handleLike}
        aria-label={liked ? t("products.removeFavorite") : t("products.addFavorite")}
        className={`w-12 h-12 rounded-lg transition flex items-center justify-center ${
          liked
            ? "bg-red-500 text-white"
            : "border-2 border-red-500 text-red-500 hover:bg-red-50"
        }`}
      >
        <Heart size={20} className={liked ? "fill-current" : ""} />
      </button>
    </div>
  </div>
)}



              <p className="text-sm text-sawaka-600">
                <Heart size={16} className="inline" /> {t("products.peopleLike", { count: article.likes?.length || 0 })}
              </p>
            </div>

            {/* Artisan */}
            {article.vendorId && (
              <div className="mt-6 pt-6 border-t border-sawaka-200">
                <h3 className="text-lg font-semibold text-sawaka-800 mb-3 flex items-center gap-2">
                  <User size={20} /> {t("products.artisan")}
                </h3>
                <div className="bg-cream-50 rounded-lg p-4">
                  <p className="font-semibold text-sawaka-900">
                    {article.vendorId.commerceName || article.vendorId.username}
                  </p>
                  {article.vendorId.city && (
                    <p className="text-sawaka-600 text-sm">
                      {article.vendorId.city}, {article.vendorId.province}
                    </p>
                  )}
{/* 
<button className="mt-3 btn-secondary w-full flex items-center justify-center gap-2">
  <MessageCircle size={18} /> Contacter l'artisan
</button> 
*/}

                </div>
              </div>
            )}
          </div>
        </div>

        {/* Commentaires */}
        <div className="mt-8 bg-white rounded-2xl shadow-lg p-6 lg:p-8">
          <h2 className="text-2xl font-bold text-sawaka-900 mb-6">
            {t("products.reviews", { count: article.comments?.length || 0 })}
          </h2>
          {/* ... commentaires inchangés ... */}
        </div>
      </div>
    </div>
  );
}
