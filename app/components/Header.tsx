"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
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
        className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-secondary"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
          {user.firstName?.charAt(0) || user.username.charAt(0)}
        </div>
        <span className="hidden text-sm text-foreground lg:inline">
          {user.firstName || user.username}
        </span>
      </button>

      {showUserMenu && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-border bg-card py-2 shadow-soft">
          <Link
            href="/profile"
            className="block px-4 py-2 text-foreground hover:bg-secondary"
          >
            {t("navigation.profile")}
          </Link>
          <Link
            href="/vendeur/articles"
            className="block px-4 py-2 text-foreground hover:bg-secondary"
          >
            {t("navigation.myCreations")}
          </Link>
          {isAdmin && (
            <>
              <hr className="my-2 border-border" />
              <Link
                href="/admin"
                className="block px-4 py-2 font-semibold text-foreground hover:bg-secondary"
              >
                {t("navigation.admin")}
              </Link>
            </>
          )}
          <hr className="my-2 border-border" />
          <button
            onClick={handleLogout}
            className="block w-full px-4 py-2 text-left text-destructive hover:bg-red-50"
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
        className="whitespace-nowrap text-sm font-medium text-foreground transition-colors hover:text-primary"
      >
        {t("navigation.login")}
      </button>
      <button
        onClick={() => showAuthUnavailable("register")}
        className="btn btn-primary whitespace-nowrap px-5 py-2 text-sm"
      >
        {t("navigation.register")}
      </button>
    </>
  );

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="wrap flex h-16 items-center gap-3 sm:gap-4 lg:h-20">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 text-lg font-semibold text-foreground"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded bg-primary text-xl font-bold text-primary-foreground">
              S
            </span>
            <span className="hidden font-display sm:inline">
              {t("common.brand")}
            </span>
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-6 text-sm font-medium xl:gap-8 lg:flex">
            <Link
              href="/"
              className="whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("navigation.home")}
            </Link>
            <Link
              href="/produits"
              className="whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("navigation.market")}
            </Link>
            <Link
              href="/fournisseurs"
              className="whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("navigation.suppliers")}
            </Link>
            <Link
              href="/projets"
              className="whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("navigation.projects")}
            </Link>
            <button
              onClick={showConcoursUnavailable}
              className="whitespace-nowrap text-left text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("navigation.contest")}
            </button>
            <Link
              href="/reseau"
              className="whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("navigation.network")}
            </Link>
          </nav>

          <div className="ml-auto hidden shrink-0 items-center gap-3 lg:flex">
            <LanguageSwitcher />
            {authActions}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3 lg:hidden">
            <LanguageSwitcher />
            <button
              type="button"
              className="rounded-md p-2 hover:bg-secondary"
              onClick={() => setShowMobileMenu(true)}
              aria-label={t("common.openMenu")}
            >
              <Menu className="h-6 w-6 text-foreground" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      {showMobileMenu && (
        <div
          className="dialog-overlay !items-stretch !justify-end !p-0"
          onClick={closeMobileMenu}
        >
          <div
            className="flex h-full w-4/5 max-w-sm flex-col gap-6 border-l border-border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-lg font-semibold text-foreground">
                {t("common.menu")}
              </span>
              <button
                onClick={closeMobileMenu}
                className="rounded-md p-2 hover:bg-secondary"
                aria-label={t("common.closeMenu")}
              >
                <X className="h-6 w-6 text-foreground" aria-hidden />
              </button>
            </div>

            <div className="border-b border-border pb-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("language.switcher")}
              </p>
              <LanguageSwitcher />
            </div>

            <nav className="flex flex-col gap-1 text-base font-medium">
              <Link
                href="/"
                onClick={closeMobileMenu}
                className="rounded-md px-3 py-2 text-foreground hover:bg-secondary"
              >
                {t("navigation.home")}
              </Link>
              <Link
                href="/produits"
                onClick={closeMobileMenu}
                className="rounded-md px-3 py-2 text-foreground hover:bg-secondary"
              >
                {t("navigation.market")}
              </Link>
              <Link
                href="/fournisseurs"
                onClick={closeMobileMenu}
                className="rounded-md px-3 py-2 text-foreground hover:bg-secondary"
              >
                {t("navigation.suppliers")}
              </Link>
              <Link
                href="/projets"
                onClick={closeMobileMenu}
                className="rounded-md px-3 py-2 text-foreground hover:bg-secondary"
              >
                {t("navigation.projects")}
              </Link>
              <button
                onClick={() => {
                  showConcoursUnavailable();
                  closeMobileMenu();
                }}
                className="rounded-md px-3 py-2 text-left text-foreground hover:bg-secondary"
              >
                {t("navigation.contest")}
              </button>
              <Link
                href="/reseau"
                onClick={closeMobileMenu}
                className="rounded-md px-3 py-2 text-foreground hover:bg-secondary"
              >
                {t("navigation.network")}
              </Link>
            </nav>

            <div className="mt-auto border-t border-border pt-4">
              {user ? (
                <button
                  onClick={handleLogout}
                  className="font-medium text-destructive"
                >
                  {t("navigation.logout")}
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => showAuthUnavailable("login")}
                    className="rounded-md px-3 py-2 text-left text-foreground hover:bg-secondary"
                  >
                    {t("navigation.login")}
                  </button>
                  <button
                    onClick={() => showAuthUnavailable("register")}
                    className="btn btn-primary w-full"
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
