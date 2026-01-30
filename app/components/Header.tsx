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
  const [showMobileMenu, setShowMobileMenu] = useState(false);

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
    setShowMobileMenu(false);
    router.push("/");
  };

  const showAuthUnavailable = (type: "login" | "register") => {
    alert(
      type === "login"
        ? "🚫 La connexion n’est pas disponible pour le moment."
        : "🚫 L’inscription n’est pas disponible pour le moment."
    );
  };

  const showConcoursUnavailable = () => {
    alert("🚧 La page Concours n’est pas disponible pour le moment.");
  };

  const closeMobileMenu = () => setShowMobileMenu(false);

  /* -------------------------------------------------------------
     RENDER
  -------------------------------------------------------------- */
  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="wrap h-16 flex items-center justify-between">

          {/* LOGO */}
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-lg text-sawaka-700"
          >
            <span className="w-9 h-9 rounded-lg bg-orange-500 text-white flex items-center justify-center">
              S
            </span>
            Sawaka
          </Link>

          {/* MENU DESKTOP */}
          <nav className="hidden md:flex items-center gap-10 text-sm font-medium text-gray-700">
            <Link href="/" className="hover:text-sawaka-900">Accueil</Link>
            <Link href="/produits" className="hover:text-sawaka-900">Marché</Link>
            <Link href="/projets" className="hover:text-sawaka-900">Projets</Link>

            {/* Concours indisponible */}
            <button
              onClick={showConcoursUnavailable}
              className="hover:text-sawaka-900 text-left"
            >
              Concours
            </button>

            <Link href="/reseau" className="hover:text-sawaka-900">Réseau</Link>
          </nav>

          {/* ACTIONS DESKTOP */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100"
                >
                  <div className="w-8 h-8 bg-sawaka-500 rounded-full flex items-center justify-center text-white">
                    {user.firstName?.charAt(0) || user.username.charAt(0)}
                  </div>
                  <span className="text-sm">
                    {user.firstName || user.username}
                  </span>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white border rounded-lg shadow-lg py-2 z-50">
                    <Link href="/profile" className="block px-4 py-2 hover:bg-gray-50">
                      👤 Mon Profil
                    </Link>

                    <Link href="/vendeur/articles" className="block px-4 py-2 hover:bg-gray-50">
                      🛍️ Mes créations
                    </Link>

                    {isAdmin && (
                      <>
                        <hr className="my-2" />
                        <Link
                          href="/admin"
                          className="block px-4 py-2 hover:bg-gray-50 font-semibold text-sawaka-700"
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
              <>
                <button
                  onClick={() => showAuthUnavailable("login")}
                  className="text-sm font-medium hover:underline"
                >
                  Se connecter
                </button>

                <button
                  onClick={() => showAuthUnavailable("register")}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                >
                  S’inscrire
                </button>
              </>
            )}
          </div>

          {/* BOUTON MOBILE */}
          <button
            className="md:hidden text-2xl"
            onClick={() => setShowMobileMenu(true)}
            aria-label="Ouvrir le menu"
          >
            ☰
          </button>
        </div>
      </header>

      {/* OVERLAY MOBILE */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={closeMobileMenu}>
          <div
            className="absolute right-0 top-0 h-full w-4/5 max-w-sm bg-white p-6 flex flex-col gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <span className="font-bold text-lg text-sawaka-700">Menu</span>
              <button onClick={closeMobileMenu} className="text-2xl">✕</button>
            </div>

            <nav className="flex flex-col gap-4 text-base font-medium">
              <Link href="/" onClick={closeMobileMenu}>Accueil</Link>
              <Link href="/produits" onClick={closeMobileMenu}>Marché</Link>
              <Link href="/projets" onClick={closeMobileMenu}>Projets</Link>

              {/* Concours indisponible (mobile) */}
              <button
                onClick={() => {
                  showConcoursUnavailable();
                  closeMobileMenu();
                }}
                className="text-left"
              >
                Concours
              </button>

              <Link href="/reseau" onClick={closeMobileMenu}>Réseau</Link>
            </nav>

            <div className="mt-auto border-t pt-4">
              {user ? (
                <button
                  onClick={handleLogout}
                  className="text-red-600 font-medium"
                >
                  🚪 Déconnexion
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  <button onClick={() => showAuthUnavailable("login")}>
                    Se connecter
                  </button>
                  <button
                    onClick={() => showAuthUnavailable("register")}
                    className="bg-orange-500 text-white rounded-lg py-2"
                  >
                    S’inscrire
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LOGIN MODAL (désactivée) */}
      <LoginModal
        open={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </>
  );
}
