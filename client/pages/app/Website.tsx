import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PageSkeleton from "@/components/portal/PageSkeleton";
import SectionHeader from "@/components/portal/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAppDispatch } from "@/store/hooks";
import { fetchSite, saveSite } from "@/store/slices/workspaceSlice";

type Page = { code: string; title: string; body: string };

export default function Website() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [pages, setPages] = useState<Page[]>([]);
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void dispatch(fetchSite()).then((result) => {
      if (fetchSite.fulfilled.match(result)) {
        setPages(result.payload.pages || []);
        setSlug(result.payload.slug || "");
      } else setError(String(result.payload || "errors.server"));
    });
  }, [dispatch]);

  function update(code: string, patch: Partial<Page>) {
    setPages((current) => current.map((page) => page.code === code ? { ...page, ...patch } : page));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    setError("");
    const result = await dispatch(saveSite(pages));
    if (saveSite.fulfilled.match(result)) setSaved(true);
    else setError(String(result.payload || "errors.server"));
  }

  if (!pages.length && !error) return <PageSkeleton cards={1} lines={5} label={t("app.loading")} />;

  return (
    <form className="portal-rise mx-auto max-w-3xl space-y-6" onSubmit={onSubmit}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionHeader title={t("officeSite.title")} meta={t("officeSite.lead")} />
        </div>
        {slug ? (
          <div className="flex flex-wrap gap-3 text-sm font-medium">
            <Link className="text-primary" to={`/w/${slug}`}>{t("officeSite.preview")}</Link>
            <Link className="text-primary" to={`/apply/${slug}`}>{t("apply.title")}</Link>
            <Link className="text-primary" to={`/book/${slug}`}>{t("book.title")}</Link>
          </div>
        ) : null}
      </div>
      {pages.map((page) => (
        <section key={page.code} className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="font-display text-2xl">{t(`officeSite.${page.code}`)}</h2>
          <Input aria-label={t("officeSite.pageTitle")} value={page.title} onChange={(event) => update(page.code, { title: event.target.value })} />
          <Textarea aria-label={t("officeSite.pageBody")} rows={5} value={page.body} onChange={(event) => update(page.code, { body: event.target.value })} />
        </section>
      ))}
      {error ? <p className="text-sm text-destructive">{t(error.startsWith("errors.") ? error : `errors.${error}`)}</p> : null}
      {saved ? <p className="text-sm text-muted-foreground">{t("officeSite.saved")}</p> : null}
      <Button type="submit">{t("app.save")}</Button>
    </form>
  );
}
