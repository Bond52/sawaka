"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LoginModal from "./ui/LoginModal";
import LanguageSwitcher from "@/src/i18n/LanguageSwitcher";
import { useTranslation } from "@/src/i18n/I18nProvider";

type UserData = {
  token: string;
  roles: string[];
  username: string;
  firstName?: string;
  lastName?: string;
};

export default function Header() {
  const router = useRouter();
  const { t } = useTranslation();

  const [user, setUser] = useState<UserData | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

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
        ? t("alerts.loginUnavailable")
        : t("alerts.registerUnavailable")
    );
  };

  const showConcoursUnavailable = () => {
    alert(t("alerts.contestUnavailable"));
  };

  const closeMobileMenu = () => setShowMobileMenu(false);

  const authActions = user ? (
    <div className="relative">
      <button
        onClick={() => setShowUserMenu(!showUserMenu)}
        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100"
      >
        <div className="w-8 h-8 bg-sawaka-500 rounded-full flex items-center justify-center text-white">
          {user.firstName?.charAt(0) || user.username.charAt(0)}
        </div>
        <span className="text-sm hidden lg:inline">
          {user.firstName || user.username}
        </span>
      </button>

      {showUserMenu && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white border rounded-lg shadow-lg py-2 z-50">
          <Link href="/profile" className="block px-4 py-2 hover:bg-gray-50">
            {t("navigation.profile")}
          </Link>
          <Link
            href="/vendeur/articles"
            className="block px-4 py-2 hover:bg-gray-50"
          >
            {t("navigation.myCreations")}
          </Link>
          {isAdmin && (
            <>
              <hr className="my-2" />
              <Link
                href="/admin"
                className="block px-4 py-2 hover:bg-gray-50 font-semibold text-sawaka-700"
              >
                {t("navigation.admin")}
              </Link>
            </>
          )}
          <hr className="my-2" />
          <button
            onClick={handleLogout}
            className="block w-full text-left px-4 py-2 text-red-600 hover:bg-red-50"
          >
            {t("navigation.logout")}
          </button>
        </div>
      )}
    </div>
  ) : (
    <>
      <button
        onClick={() => showAuthUnavailable("login")}
        className="text-sm font-medium hover:underline whitespace-nowrap"
      >
        {t("navigation.login")}
      </button>
      <button
        onClick={() => showAuthUnavailable("register")}
        className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap"
      >
        {t("navigation.register")}
      </button>
    </>
  );

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="wrap h-16 flex items-center gap-3 sm:gap-4">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 font-bold text-lg text-sawaka-700"
          >
            <span className="w-9 h-9 rounded-lg bg-orange-500 text-white flex items-center justify-center">
              S
            </span>
            <span className="hidden sm:inline">{t("common.brand")}</span>
          </Link>

          <nav className="hidden lg:flex flex-1 items-center justify-center gap-8 text-sm font-medium text-gray-700 min-w-0">
            <Link href="/" className="hover:text-sawaka-900 whitespace-nowrap">
              {t("navigation.home")}
            </Link>
            <Link
              href="/produits"
              className="hover:text-sawaka-900 whitespace-nowrap"
            >
              {t("navigation.market")}
            </Link>
            <Link
              href="/projets"
              className="hover:text-sawaka-900 whitespace-nowrap"
            >
              {t("navigation.projects")}
            </Link>
            <button
              onClick={showConcoursUnavailable}
              className="hover:text-sawaka-900 text-left whitespace-nowrap"
            >
              {t("navigation.contest")}
            </button>
            <Link
              href="/reseau"
              className="hover:text-sawaka-900 whitespace-nowrap"
            >
              {t("navigation.network")}
            </Link>
          </nav>

          <div className="hidden lg:flex shrink-0 items-center gap-3 ml-auto">
            <LanguageSwitcher />
            {authActions}
          </div>

          <div className="flex lg:hidden shrink-0 items-center gap-2 sm:gap-3 ml-auto">
            <LanguageSwitcher />
            <button
              type="button"
              className="text-2xl leading-none p-1"
              onClick={() => setShowMobileMenu(true)}
              aria-label={t("common.openMenu")}
            >
              ☰
            </button>
          </div>
        </div>
      </header>

      {showMobileMenu && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={closeMobileMenu}>
          <div
            className="absolute right-0 top-0 h-full w-4/5 max-w-sm bg-white p-6 flex flex-col gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <span className="font-bold text-lg text-sawaka-700">
                {t("common.menu")}
              </span>
              <button
                onClick={closeMobileMenu}
                className="text-2xl"
                aria-label={t("common.closeMenu")}
              >
                ✕
              </button>
            </div>

            <div className="pb-4 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                {t("language.switcher")}
              </p>
              <LanguageSwitcher />
            </div>

            <nav className="flex flex-col gap-4 text-base font-medium">
              <Link href="/" onClick={closeMobileMenu}>
                {t("navigation.home")}
              </Link>
              <Link href="/produits" onClick={closeMobileMenu}>
                {t("navigation.market")}
              </Link>
              <Link href="/projets" onClick={closeMobileMenu}>
                {t("navigation.projects")}
              </Link>
              <button
                onClick={() => {
                  showConcoursUnavailable();
                  closeMobileMenu();
                }}
                className="text-left"
              >
                {t("navigation.contest")}
              </button>
              <Link href="/reseau" onClick={closeMobileMenu}>
                {t("navigation.network")}
              </Link>
            </nav>

            <div className="mt-auto border-t pt-4">
              {user ? (
                <button
                  onClick={handleLogout}
                  className="text-red-600 font-medium"
                >
                  {t("navigation.logout")}
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  <button onClick={() => showAuthUnavailable("login")}>
                    {t("navigation.login")}
                  </button>
                  <button
                    onClick={() => showAuthUnavailable("register")}
                    className="bg-orange-500 text-white rounded-lg py-2"
                  >
                    {t("navigation.register")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <LoginModal
        open={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </>
  );
}
