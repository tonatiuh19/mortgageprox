import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { OfficeMeta } from "@/components/PageMeta";
import PageMeta from "@/components/PageMeta";
import PageSkeleton from "@/components/portal/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAppDispatch } from "@/store/hooks";
import { fetchPublicSite, sendSiteNote } from "@/store/slices/workspaceSlice";

type SitePage = { code: string; title: string; body: string };
type Site = {
  name: string;
  slug: string;
  phone: string;
  nmls: string;
  address: string;
  supportEmail: string;
  primaryColor: string | null;
  logoUrl: string | null;
  pages: SitePage[];
  people: { name: string; photoUrl: string | null; nmls: string; bio: string; slug: string }[];
};

export default function PublicSite() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { slug = "", page = "home" } = useParams();
  const [site, setSite] = useState<Site | null>(null);
  const [missing, setMissing] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSite(null);
    setMissing(false);
    void dispatch(fetchPublicSite(slug)).then((result) => {
      if (fetchPublicSite.fulfilled.match(result)) setSite(result.payload);
      else setMissing(true);
    });
  }, [dispatch, slug]);

  async function onContact(event: FormEvent) {
    event.preventDefault();
    setError("");
    const result = await dispatch(sendSiteNote({ slug, firstName, lastName, email, phone, message }));
    if (sendSiteNote.fulfilled.match(result)) setSent(true);
    else setError(String(result.payload || "errors.server"));
  }

  if (missing) return <><PageMeta title={t("meta.missingTitle")} description={t("meta.missingDescription")} noIndex /><p className="p-8 text-sm text-muted-foreground">{t("errors.notFound")}</p></>;
  if (!site) return <PageSkeleton cards={1} lines={4} label={t("app.loading")} />;

  const current = site.pages.find((item) => item.code === page) || site.pages[0];
  const accent = site.primaryColor || undefined;

  return (
    <div className="portal-rise mx-auto min-h-screen max-w-3xl px-5 py-8" style={accent ? { ["--primary" as string]: accent } : undefined}>
      <OfficeMeta
        slug={site.slug}
        kind="site"
        name={site.name}
        pageTitle={page === "home" || !current ? site.name : current.title}
        description={current?.body?.replace(/[#>*_]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160)}
        image={site.logoUrl}
        themeColor={site.primaryColor}
      />
      <header className="flex flex-wrap items-center justify-between gap-4">
        {site.logoUrl ? <img src={site.logoUrl} alt={site.name} className="max-h-10 max-w-[180px] object-contain" /> : <strong className="font-display text-2xl">{site.name}</strong>}
        <nav className="flex flex-wrap gap-3 text-sm">
          {site.pages.map((item) => (
            <Link key={item.code} to={item.code === "home" ? `/w/${site.slug}` : `/w/${site.slug}/${item.code}`}>{t(`officeSite.${item.code}`)}</Link>
          ))}
        </nav>
      </header>
      {page === "home" ? (
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground" to={`/apply/${site.slug}`}>{t("apply.title")}</Link>
          <Link className="rounded-full border border-border px-4 py-2 text-sm" to={`/book/${site.slug}`}>{t("book.title")}</Link>
        </div>
      ) : null}
      {page === "home" && site.people.length > 0 ? (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {site.people.map((person) => (
            <li key={person.slug} className="rounded-2xl border border-border p-4">
              <strong>{person.name}</strong>
              {person.nmls ? <p className="text-sm text-muted-foreground">NMLS {person.nmls}</p> : null}
              <p className="mt-2 flex flex-wrap gap-3 text-sm">
                <Link to={`/apply/${site.slug}/${person.slug}`}>{t("apply.title")}</Link>
                <Link to={`/book/${site.slug}/${person.slug}`}>{t("book.title")}</Link>
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      <article className="mt-10">
        <h1 className="font-display text-4xl">{current?.title}</h1>
        {current?.body.split("\n").filter(Boolean).map((line) => <p key={line} className="mt-4 text-muted-foreground">{line}</p>)}
      </article>
      {page === "home" && site.people.length > 0 ? (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {site.people.map((person) => (
            <li key={person.slug} className="rounded-2xl border border-border p-4">
              <strong>{person.name}</strong>
              {person.nmls ? <p className="text-sm text-muted-foreground">NMLS {person.nmls}</p> : null}
              {person.bio ? <p className="mt-2 text-sm">{person.bio}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {page === "contact" || page === "home" ? (
        <form className="mt-8 space-y-3" onSubmit={onContact}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input required aria-label={t("app.firstName")} placeholder={t("app.firstName")} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            <Input required aria-label={t("app.lastName")} placeholder={t("app.lastName")} value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </div>
          <Input required type="email" aria-label={t("app.email")} placeholder={t("app.email")} value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input aria-label={t("app.phone")} placeholder={t("app.phone")} value={phone} onChange={(event) => setPhone(event.target.value)} />
          <Textarea required aria-label={t("officeSite.message")} placeholder={t("officeSite.message")} value={message} onChange={(event) => setMessage(event.target.value)} />
          {error ? <p className="text-sm text-destructive">{t(error.startsWith("errors.") ? error : `errors.${error}`)}</p> : null}
          {sent ? <p className="text-sm text-muted-foreground">{t("officeSite.sent")}</p> : <Button type="submit">{t("officeSite.send")}</Button>}
        </form>
      ) : null}
      <footer className="mt-10 text-sm text-muted-foreground">
        <p>{site.name}</p>
        {site.nmls ? <p>NMLS {site.nmls}</p> : null}
        {site.address ? <p>{site.address}</p> : null}
        {site.phone ? <p>{site.phone}</p> : null}
        <p className="mt-4 flex flex-wrap gap-4">
          <Link to={`/apply/${site.slug}`}>{t("apply.title")}</Link>
          <Link to={`/book/${site.slug}`}>{t("book.title")}</Link>
        </p>
      </footer>
    </div>
  );
}
