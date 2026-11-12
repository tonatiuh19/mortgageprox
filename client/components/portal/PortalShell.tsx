import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Lock, LogOut, MoreHorizontal, X, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { roleCan } from "@shared/api";
import PageMeta from "@/components/PageMeta";
import LegalModal from "@/components/content/LegalModal";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchMe, logout } from "@/store/slices/authSlice";
import { fetchProfile } from "@/store/slices/workspaceSlice";
import { brandVars } from "@/lib/brand";
import PageSkeleton from "@/components/portal/PageSkeleton";

export type PortalNavItem = {
  to: string;
  end?: boolean;
  labelKey: string;
  label?: string;
  icon: LucideIcon;
  perm?: string;
  module?: string;
  section?: string;
  sectionId?: string;
  sort?: number;
};

const ScreenTitleContext = createContext<(title: string) => void>(() => undefined);

export function useScreenTitle(title: string) {
  const setTitle = useContext(ScreenTitleContext);
  useEffect(() => {
    const next = title.trim();
    if (!next) return;
    setTitle(next);
    return () => setTitle("");
  }, [setTitle, title]);
}

type Props = {
  loginPath: string;
  titleKey: string;
  homePath: string;
  nav: PortalNavItem[];
  tabs?: string[];
  notice?: ReactNode;
  legalLinks?: boolean;
};

export default function PortalShell({ loginPath, titleKey, homePath, nav, tabs, notice, legalLinks = false }: Props) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const profile = useAppSelector((state) => state.workspace.staffProfile);
  const navId = useId();
  const [navOpen, setNavOpen] = useState(false);
  const [screenTitle, setScreenTitle] = useState("");
  const [legalPage, setLegalPage] = useState<"terms" | "privacy" | null>(null);
  const { user, bootstrapped, loading } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (!bootstrapped) void dispatch(fetchMe());
  }, [bootstrapped, dispatch]);

  useEffect(() => {
    if (bootstrapped && !user && !loading) navigate(loginPath, { replace: true });
  }, [bootstrapped, user, loading, navigate, loginPath]);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (homePath === "/app" && user) void dispatch(fetchProfile());
  }, [dispatch, homePath, user]);

  if (!bootstrapped || loading || !user) {
    return <div className="mx-auto max-w-5xl px-5 py-8"><PageSkeleton cards={3} lines={4} label={t("app.loading")} /></div>;
  }

  const visible = nav.filter((item) => {
    if (item.perm && !roleCan(user.role, item.perm)) return false;
    if (item.module && user.modules.length > 0 && !user.modules.includes(item.module)) return false;
    return true;
  });
  const usable = visible.filter((item) => !(item.module && !user.modules.includes(item.module)));
  const tabItems = [
    ...(tabs ?? []).map((to) => usable.find((item) => item.to === to)).filter((item): item is PortalNavItem => Boolean(item)),
    ...usable.filter((item) => !(tabs ?? []).includes(item.to)),
  ].slice(0, 4);

  return (
    <div
      className={`portal-shell${navOpen ? " is-nav-open" : ""}`}
      data-headline={user.brandHeadline || undefined}
      style={brandVars({ accent: user.primaryColor, radius: user.brandRadius })}
    >
      <ScreenTitleContext.Provider value={setScreenTitle}>
      <PageMeta
        title={documentSection(location.pathname, screenTitle, visible, t, titleKey)}
        description={documentSection(location.pathname, screenTitle, visible, t, titleKey)}
        siteName={user.tenantName || (homePath === "/command" ? t("command.title") : t(titleKey))}
        noIndex
        iconUrl={user.faviconUrl}
        themeColor={user.primaryColor}
      />
      <header className="portal-mobile-bar">
        <Link to={homePath} className="portal-mobile-brand min-w-0">
          {user.logoUrl ? <img src={user.logoUrl} alt={user.tenantName || ""} className="portal-brand-logo" /> : t(titleKey)}
        </Link>
      </header>
      <button type="button" className="portal-nav-overlay" aria-label={t("portalAuth.closeMenu")} onClick={() => setNavOpen(false)} />
      <aside className="portal-sidebar" id={navId}>
        <div className="portal-sheet-head">
          <strong>{t("portalAuth.menu")}</strong>
          <button type="button" className="portal-sheet-close" aria-label={t("portalAuth.closeMenu")} onClick={() => setNavOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <Link to={homePath} className="portal-sidebar-brand">
          {user.logoUrl ? <img src={user.logoUrl} alt={user.tenantName || ""} className="portal-brand-logo" /> : "MortgageProx"}
        </Link>
        <p className="portal-sidebar-kicker">{t(titleKey)}</p>
        <nav className="portal-sidebar-nav" aria-label={t(titleKey)}>
          {visible.map((item, index) => {
            const heading = item.section && item.section !== visible[index - 1]?.section ? (
              <p key={`s-${item.section}`} className="portal-nav-section"><span>{t(item.section)}</span></p>
            ) : null;
            const locked = item.module && !user.modules.includes(item.module);
            const row = locked ? (
              <div key={item.to} className="portal-nav-link portal-nav-link--locked">
                <item.icon size={17} />
                <span>{item.label || t(item.labelKey)}</span>
                <Lock size={13} />
              </div>
            ) : (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? "portal-nav-link is-active" : "portal-nav-link")}>
                <item.icon size={17} />
                <span>{item.label || t(item.labelKey)}</span>
              </NavLink>
            );
            return heading ? [heading, row] : row;
          })}
        </nav>
        <div className="portal-sidebar-foot">
          {homePath === "/app" ? (
            <Link to="/app/profile" className="portal-account-chip">
              {profile?.photoUrl ? <img src={profile.photoUrl} alt="" className="portal-account-photo" /> : <span className="portal-account-photo" />}
              <span className="portal-sidebar-user">
                <strong>{user.firstName} {user.lastName}</strong>
                <span className="portal-account-role">{t(`role.${user.role}`)}</span>
              </span>
              {profile?.unread ? <span className="portal-unread">{profile.unread > 9 ? "9+" : profile.unread}</span> : null}
            </Link>
          ) : (
            <div className="portal-sidebar-user">
              <strong>{user.firstName} {user.lastName}</strong>
              <span>{user.email}</span>
              <span className="portal-account-role">{t(`role.${user.role}`)}</span>
            </div>
          )}
          <button
            type="button"
            className="portal-logout"
            onClick={async () => {
              await dispatch(logout());
              navigate(loginPath);
            }}
          >
            <LogOut size={15} /> {t("portalAuth.logout")}
          </button>
        </div>
      </aside>
      <main className="portal-main">
        {notice}
        <Outlet />
        {legalLinks ? (
          <p className="mt-10 text-xs text-muted-foreground">
            <button type="button" className="underline" onClick={() => setLegalPage("terms")}>{t("legal.terms")}</button>
            <span className="mx-2">·</span>
            <button type="button" className="underline" onClick={() => setLegalPage("privacy")}>{t("legal.privacy")}</button>
          </p>
        ) : null}
        {legalLinks ? <LegalModal code={legalPage} onClose={() => setLegalPage(null)} /> : null}
      </main>
      <nav className="portal-tabbar" aria-label={t("portalAuth.quickNav")}>
        {tabItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive && !navOpen ? "portal-tab is-active" : "portal-tab")}>
            <item.icon size={20} />
            <span className="portal-tab-label">{item.label || t(item.labelKey)}</span>
          </NavLink>
        ))}
        <button type="button" className={navOpen ? "portal-tab is-active" : "portal-tab"} aria-expanded={navOpen} onClick={() => setNavOpen((open) => !open)}>
          <MoreHorizontal size={20} />
          <span className="portal-tab-label">{t("portalAuth.more")}</span>
        </button>
      </nav>
      </ScreenTitleContext.Provider>
    </div>
  );
}

function documentSection(
  path: string,
  screenTitle: string,
  nav: PortalNavItem[],
  t: (key: string) => string,
  titleKey: string,
): string {
  if (screenTitle.trim()) return screenTitle.trim();
  const match = [...nav].sort((a, b) => b.to.length - a.to.length).find((item) => (
    item.end ? path === item.to : path === item.to || path.startsWith(`${item.to}/`)
  ));
  if (match) return match.label || t(match.labelKey);
  if (path.startsWith("/app/profile")) return t("profile.title");
  if (/^\/app\/loans\/[^/]+\/letter$/.test(path)) return t("letters.title");
  if (/^\/command\/tenants\/[^/]+$/.test(path)) return t("command.tenants");
  return t(titleKey);
}
