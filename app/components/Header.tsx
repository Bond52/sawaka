"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  FolderKanban,
  Hammer,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  User,
  Users,
  X,
} from "lucide-react";
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

type MenuIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

type AccountMenuItem =
  | {
      id: string;
      labelKey: string;
      testId: string;
      icon: MenuIcon;
      href: string;
      available: true;
    }
  | {
      id: string;
      labelKey: string;
      testId: string;
      icon: MenuIcon;
      available: false;
    };

function readStoredUser(): UserData | null {
  try {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  } catch {
    return null;
  }
}

const PUBLIC_NAV = [
  { href: "/", labelKey: "navigation.home" },
  { href: "/produits", labelKey: "navigation.market" },
  { href: "/fournisseurs", labelKey: "navigation.suppliers" },
  { href: "/projets", labelKey: "navigation.projects" },
  { href: "/reseau", labelKey: "navigation.network" },
] as const;

/**
 * Authenticated account destinations.
 * Available routes: /dashboard, /profile, /vendeur/articles, /settings.
 * My Realizations opens the portfolio page at /vendeur/articles.
 * Bulk import and the rest of Feature #346 stay out of this menu.
 * Unavailable (disabled interim UX — do not invent Features here):
 * - My Projects → EPIC #215 (no dedicated “my projects” area; /projets is public browse)
 * - My Collaborations → Feature #347
 * Create Contributor Profile must not appear (Bug #392).
 */
const ACCOUNT_MENU_ITEMS: AccountMenuItem[] = [
  {
    id: "dashboard",
    labelKey: "navigation.dashboard",
    testId: "header-dashboard-link",
    icon: LayoutDashboard,
    href: "/dashboard",
    available: true,
  },
  {
    id: "profile",
    labelKey: "navigation.profile",
    testId: "header-profile-link",
    icon: User,
    href: "/profile",
    available: true,
  },
  {
    id: "realizations",
    labelKey: "navigation.myRealizations",
    testId: "header-my-realizations",
    icon: Hammer,
    href: "/vendeur/articles",
    available: true,
  },
  {
    id: "my-projects",
    labelKey: "navigation.myProjects",
    testId: "header-my-projects",
    icon: FolderKanban,
    available: false,
  },
  {
    id: "collaborations",
    labelKey: "navigation.myCollaborations",
    testId: "header-my-collaborations",
    icon: Users,
    available: false,
  },
  {
    id: "settings",
    labelKey: "navigation.settings",
    testId: "header-settings",
    icon: Settings,
    href: "/settings",
    available: true,
  },
];

const menuItemClass =
  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const menuItemDisabledClass =
  "flex w-full cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-muted-foreground opacity-70";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();

  const [user, setUser] = useState<UserData | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUser(readStoredUser());

    const syncUser = () => setUser(readStoredUser());

    window.addEventListener("storage", syncUser);
    window.addEventListener("sawaka-auth-changed", syncUser);
    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("sawaka-auth-changed", syncUser);
    };
  }, [pathname]);

  useEffect(() => {
    setShowUserMenu(false);
    setShowMobileMenu(false);
  }, [pathname]);

  useEffect(() => {
    if (!showUserMenu) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowUserMenu(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showUserMenu]);

  const isAdmin = user?.roles?.includes("admin");

  const clearAuthCookie = () => {
    document.cookie =
      "token=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; secure; SameSite=None";
    document.cookie =
      "token=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; secure";
    document.cookie =
      "token=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    document.cookie =
      "token=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.sawaka.org; secure; SameSite=None";
    document.cookie =
      "token=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.sawaka.org";
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    clearAuthCookie();
    setUser(null);
    setShowUserMenu(false);
    setShowMobileMenu(false);
    window.dispatchEvent(new Event("sawaka-auth-changed"));
    router.push("/");
  };

  const openLoginModal = () => {
    setShowLoginModal(true);
    setShowMobileMenu(false);
  };

  const closeMobileMenu = () => setShowMobileMenu(false);

  const renderAccountItems = (opts: {
    onNavigate?: () => void;
    linkTestIdPrefix?: string;
  }): ReactNode =>
    ACCOUNT_MENU_ITEMS.map((item) => {
      const Icon = item.icon;
      const testId = opts.linkTestIdPrefix
        ? `${opts.linkTestIdPrefix}-${item.id}`
        : item.testId;

      if (!item.available) {
        return (
          <button
            key={item.id}
            type="button"
            disabled
            data-testid={testId}
            className={menuItemDisabledClass}
            title={t("navigation.menuUnavailable")}
            aria-disabled="true"
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span>{t(item.labelKey)}</span>
          </button>
        );
      }

      return (
        <Link
          key={item.id}
          href={item.href}
          data-testid={testId}
          onClick={opts.onNavigate}
          className={menuItemClass}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          <span>{t(item.labelKey)}</span>
        </Link>
      );
    });

  const authActions = user ? (
    <div className="relative" ref={userMenuRef}>
      <button
        type="button"
        data-testid="header-user-menu"
        aria-haspopup="menu"
        aria-expanded={showUserMenu}
        onClick={() => setShowUserMenu(!showUserMenu)}
        className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
          {user.firstName?.charAt(0) || user.username.charAt(0)}
        </div>
        <span className="hidden text-sm text-foreground lg:inline">
          {user.firstName || user.username}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            showUserMenu ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {showUserMenu && (
        <div
          role="menu"
          aria-label={t("navigation.accountMenu")}
          data-testid="header-user-menu-panel"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-border bg-card py-2 shadow-soft"
        >
          <div className="flex flex-col gap-0.5 px-1">
            {renderAccountItems({
              onNavigate: () => setShowUserMenu(false),
            })}
          </div>
          {isAdmin && (
            <>
              <hr className="my-2 border-border" />
              <div className="px-1">
                <Link
                  href="/admin"
                  data-testid="header-admin-link"
                  onClick={() => setShowUserMenu(false)}
                  className={`${menuItemClass} font-semibold`}
                >
                  {t("navigation.admin")}
                </Link>
              </div>
            </>
          )}
          <hr className="my-2 border-border" />
          <div className="px-1">
            <button
              type="button"
              role="menuitem"
              data-testid="header-logout"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-destructive transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              <span>{t("navigation.logout")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  ) : (
    <>
      <button
        type="button"
        data-testid="header-login"
        onClick={openLoginModal}
        className="whitespace-nowrap text-sm font-medium text-foreground transition-colors hover:text-primary"
      >
        {t("navigation.login")}
      </button>
      <Link
        href="/contributor/create"
        data-testid="header-register"
        className="btn btn-primary whitespace-nowrap px-5 py-2 text-sm"
      >
        {t("navigation.register")}
      </Link>
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
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
              >
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>

          <div className="ml-auto hidden shrink-0 items-center gap-3 lg:flex">
            <LanguageSwitcher />
            {authActions}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3 lg:hidden">
            <LanguageSwitcher />
            <button
              type="button"
              className="rounded-md p-2 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            onKeyDown={(e) => {
              if (e.key === "Escape") closeMobileMenu();
            }}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-lg font-semibold text-foreground">
                {t("common.menu")}
              </span>
              <button
                onClick={closeMobileMenu}
                className="rounded-md p-2 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              {PUBLIC_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  className="rounded-md px-3 py-2 text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t(item.labelKey)}
                </Link>
              ))}
            </nav>

            <div className="mt-auto border-t border-border pt-4">
              {user ? (
                <div className="flex flex-col gap-0.5" data-testid="header-mobile-account-menu">
                  {user.firstName || user.username ? (
                    <p className="mb-2 px-3 text-sm font-medium text-foreground">
                      {user.firstName || user.username}
                    </p>
                  ) : null}
                  {renderAccountItems({
                    onNavigate: closeMobileMenu,
                    linkTestIdPrefix: "header-mobile",
                  })}
                  {isAdmin && (
                    <Link
                      href="/admin"
                      data-testid="header-admin-link-mobile"
                      onClick={closeMobileMenu}
                      className={`${menuItemClass} font-semibold`}
                    >
                      {t("navigation.admin")}
                    </Link>
                  )}
                  <hr className="my-2 border-border" />
                  <button
                    type="button"
                    data-testid="header-logout-mobile"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <LogOut className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{t("navigation.logout")}</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    data-testid="header-login-mobile"
                    onClick={openLoginModal}
                    className="rounded-md px-3 py-2 text-left text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t("navigation.login")}
                  </button>
                  <Link
                    href="/contributor/create"
                    data-testid="header-register-mobile"
                    onClick={closeMobileMenu}
                    className="btn btn-primary w-full text-center"
                  >
                    {t("navigation.register")}
                  </Link>
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
