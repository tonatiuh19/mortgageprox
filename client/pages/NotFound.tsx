import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import PageMeta from "@/components/PageMeta";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const { t } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col items-start px-5 py-32 sm:px-8 lg:py-40">
      <PageMeta title={t("meta.missingTitle")} description={t("meta.missingDescription")} noIndex />
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
        Error 404
      </p>
      <h1 className="mt-4 font-display text-5xl tracking-tight sm:text-6xl">
        This page isn't part of the office.
      </h1>
      <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
        The link may be out of date, or the page may not exist yet.
      </p>
      <Button asChild size="lg" className="mt-10">
        <Link to="/">Return to home</Link>
      </Button>
    </div>
  );
};

export default NotFound;
