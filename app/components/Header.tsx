"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LoginModal from "./ui/LoginModal";


type UserData = {
  token: string;
  roles: string[];
  username: string;
  firstName?: string;
  lastName?: string;
};

export default function Header() {
  const router = useRouter();

  const [user, setUser] = useState<UserData | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  /* -------------------------------------------------------------
     INIT
  -------------------------------------------------------------- */
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) setUser(JSON.parse(savedUser));

    const handleStorageChange = () => {
      const u = localStorage.getItem("user");
      setUser(u ? JSON.parse(u) : null);
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const isAdmin = user?.roles?.includes("admin");

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
    setShowUserMenu(false);
    router.push("/");
  };

  /* -------------------------------------------------------------
     RENDER
  -------------------------------------------------------------- */
  return (
    <>
      <header className="bg-white shadow-sm border-b border-cream-200 sticky top-0 z-40">

        {/* ===== TOP BAR (CACHÉE) ===== */}
        <div className="hidden bg-sawaka-700 text-white">
          <div className="wrap py-2 text-sm text-center">
            📦 Livraison gratuite dès 50 000 FCFA — 🛡️ Garantie artisan
          </div>
        </div>

        {/* ===== NAVIGATION ===== */}
        <div className="bg-cream-50">
          <div className="wrap py-3 relative flex items-center justify-center text-sm">

            {/* MENU CENTRÉ */}
            <nav className="flex gap-12 items-center whitespace-nowrap font-medium">
              <Link href="/" className="hover:text-sawaka-900">
                Accueil
              </Link>

              <Link href="/produits" className="hover:text-sawaka-900">
                Marché
              </Link>

              <Link href="/projets" className="hover:text-sawaka-900">
                Projets
              </Link>

              <Link href="/reseau" className="hover:text-sawaka-900">
                Réseau Sawaka
              </Link>
            </nav>

            {/* AUTH À DROITE */}
            <div className="absolute right-0 flex items-center">
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-cream-100"
                  >
                    <div className="w-8 h-8 bg-sawaka-500 rounded-full flex items-center justify-center text-white">
                      {user.firstName?.charAt(0) || user.username.charAt(0)}
                    </div>
                    <span className="hidden md:block">
                      {user.firstName || user.username}
                    </span>
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white border rounded-lg shadow-lg py-2 z-50">
                      <Link
                        href="/profile"
                        className="block px-4 py-2 hover:bg-cream-50"
                      >
                        👤 Mon Profil
                      </Link>

                      <Link
                        href="/vendeur/articles"
                        className="block px-4 py-2 hover:bg-cream-50"
                      >
                        🛍️ Mes créations
                      </Link>

                      {isAdmin && (
                        <>
                          <hr className="my-2" />
                          <Link
                            href="/admin"
                            className="block px-4 py-2 hover:bg-cream-50 font-semibold text-sawaka-700"
                          >
                            ⚙️ Gestion (Admin)
                          </Link>
                        </>
                      )}

                      <hr className="my-2" />
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-red-600 hover:bg-red-50"
                      >
                        🚪 Déconnexion
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="px-4 py-2 border rounded-lg hover:bg-cream-100"
                >
                  👤 Se connecter
                </button>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* ===== LOGIN MODAL ===== */}
      <LoginModal
        open={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </>
  );
}
