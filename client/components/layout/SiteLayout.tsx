import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { ArrowRight, Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { brandVars } from "@/lib/brand";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchPublicHost } from "@/store/slices/legalSlice";

const navItems = [
  { labelKey: "site.whiteLabel", to: "/#white-label" },
  { labelKey: "site.roles", to: "/#roles" },
  { labelKey: "site.modules", to: "/#modules" },
  { labelKey: "site.pricing", to: "/pricing" },
];

function useScrollToHash() {
  const { hash, pathname } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0 });
      return;
    }
    document
      .getElementById(hash.slice(1))
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash, pathname]);
}

export default function SiteLayout() {
  const { t } = useTranslation();
  useScrollToHash();
  const dispatch = useAppDispatch();
  const hostStatus = useAppSelector((state) => state.legal.hostStatus);
  const host = useAppSelector((state) => state.legal.host);
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const legalRoute = pathname === "/terms" || pathname === "/privacy";
  const platformCopy = params.get("scope") === "platform";

  useEffect(() => {
    if (hostStatus === "idle") void dispatch(fetchPublicHost());
  }, [hostStatus, dispatch]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (legalRoute && !platformCopy && hostStatus !== "ready") {
    return <div className="min-h-dvh bg-background" />;
  }

  if (legalRoute && !platformCopy && host) {
    return (
      <div className="flex min-h-dvh flex-col bg-background" style={brandVars({ accent: host.primaryColor, radius: "soft" })}>
        <header className="border-b border-border/70">
          <div className="mx-auto flex h-16 max-w-3xl items-center px-5 sm:px-8">
            {host.logoUrl ? <img src={host.logoUrl} alt={host.name} className="max-h-8 max-w-[180px] object-contain" /> : <span className="truncate font-display text-2xl">{host.name}</span>}
          </div>
        </header>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
        <footer className="border-t border-border">
          <p className="mx-auto max-w-3xl px-5 py-5 text-xs text-muted-foreground sm:px-8">
            © {new Date().getFullYear()} {host.name}
            <span className="mx-2">·</span>
            <Link to="/terms" className="underline">{t("legal.terms")}</Link>
            <span className="mx-2">·</span>
            <Link to="/privacy" className="underline">{t("legal.privacy")}</Link>
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/75 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-5 sm:gap-6 sm:px-8">
          <Link to="/" aria-label="MortgageProx home">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" className="hidden sm:inline-flex">
              <Link to="/login">{t("site.signIn")}</Link>
            </Button>
            <Button asChild className="px-3 sm:px-5">
              <Link to="/start">
                {t("site.start")}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label="Toggle menu"
              className="inline-flex size-10 items-center justify-center rounded-xl border border-border bg-card md:hidden"
            >
              {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        <nav
          className={cn(
            "border-t border-border/70 bg-background px-5 py-3 md:hidden",
            menuOpen ? "block" : "hidden",
          )}
        >
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>
      </header>

      <main className="min-h-dvh">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-card/40">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              The all-in-one workspace for mortgage brokerages, delivered under
              each company's own brand. MortgageProx is not a bank and does not
              approve loans.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>
        </div>
        <div className="border-t border-border">
          <p className="mx-auto max-w-7xl px-5 py-5 text-xs text-muted-foreground sm:px-8">
            © {new Date().getFullYear()} MortgageProx. All rights reserved.
            <span className="mx-2">·</span>
            <Link to="/terms" className="underline">{t("legal.terms")}</Link>
            <span className="mx-2">·</span>
            <Link to="/privacy" className="underline">{t("legal.privacy")}</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
