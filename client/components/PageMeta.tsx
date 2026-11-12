import { createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchPublicHost } from "@/store/slices/legalSlice";

const BRAND = "MortgageProx";
const THEME = "#2F4ED8";
const INDEXABLE = "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";

export type PageMetaProps = {
  title: string;
  description?: string;
  siteName?: string;
  titleFull?: boolean;
  noIndex?: boolean;
  image?: string | null;
  iconUrl?: string | null;
  themeColor?: string | null;
  ogType?: "website" | "profile";
};

type Entry = PageMetaProps & { id: string };

const MetaContext = createContext<{ push: (entry: Entry) => void; pop: (id: string) => void } | null>(null);

function fullTitle(props: PageMetaProps): string {
  const site = (props.siteName || BRAND).trim() || BRAND;
  const title = props.title.trim() || site;
  if (props.titleFull || title === site || title.endsWith(`· ${site}`) || title.includes(site)) return title;
  return `${title} · ${site}`;
}

function absolute(value: string | null | undefined): string {
  if (!value) return `${window.location.origin}/favicon.svg`;
  if (/^https?:\/\//i.test(value)) return value;
  return `${window.location.origin}${value.startsWith("/") ? value : `/${value}`}`;
}

function hexColor(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw) ? raw : THEME;
}

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string, extra?: string) {
  const selector = extra ? `link[rel="${rel}"][hreflang="${extra}"]` : `link[rel="${rel}"]:not([hreflang])`;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    if (extra) el.setAttribute("hreflang", extra);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function writeDocumentHead(props: PageMetaProps, lang: "en" | "es") {
  const title = fullTitle(props);
  const description = (props.description || title).replace(/\s+/g, " ").trim().slice(0, 180);
  const robots = props.noIndex ? "noindex, nofollow" : INDEXABLE;
  const canonical = `${window.location.origin}${window.location.pathname || "/"}`;
  const image = absolute(props.image);
  const icon = absolute(props.iconUrl || "/favicon.svg");
  const site = (props.siteName || BRAND).trim() || BRAND;
  document.title = title;
  document.documentElement.lang = lang;
  setMeta("name", "description", description);
  setMeta("name", "robots", robots);
  setMeta("name", "googlebot", robots);
  setMeta("name", "theme-color", hexColor(props.themeColor));
  setMeta("name", "application-name", site);
  setMeta("property", "og:site_name", site);
  setMeta("property", "og:type", props.ogType || "website");
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", description);
  setMeta("property", "og:url", canonical);
  setMeta("property", "og:image", image);
  setMeta("property", "og:locale", lang === "es" ? "es_MX" : "en_US");
  setMeta("property", "og:locale:alternate", lang === "es" ? "en_US" : "es_MX");
  setMeta("name", "twitter:card", /\.(png|jpe?g|webp)(\?|$)/i.test(image) ? "summary_large_image" : "summary");
  setMeta("name", "twitter:title", title);
  setMeta("name", "twitter:description", description);
  setMeta("name", "twitter:image", image);
  setLink("canonical", canonical);
  setLink("alternate", canonical, "en");
  setLink("alternate", canonical, "es");
  setLink("alternate", canonical, "x-default");
  const icons = [...document.querySelectorAll('link[rel="icon"]')] as HTMLLinkElement[];
  if (!icons.length) {
    const created = document.createElement("link");
    created.rel = "icon";
    document.head.appendChild(created);
    icons.push(created);
  }
  for (const link of icons) link.href = icon;
}

function sameEntry(a: PageMetaProps, b: PageMetaProps): boolean {
  return a.title === b.title
    && a.description === b.description
    && a.siteName === b.siteName
    && a.titleFull === b.titleFull
    && a.noIndex === b.noIndex
    && a.image === b.image
    && a.iconUrl === b.iconUrl
    && a.themeColor === b.themeColor
    && a.ogType === b.ogType;
}

export function PageMetaProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [stack, setStack] = useState<Entry[]>([]);
  const api = useMemo(() => ({
    push(entry: Entry) {
      setStack((current) => {
        const rest = current.filter((item) => item.id !== entry.id);
        const previous = current.find((item) => item.id === entry.id);
        if (previous && sameEntry(previous, entry) && rest.length === current.length - 1) return current;
        return [...rest, entry];
      });
    },
    pop(id: string) {
      setStack((current) => current.filter((item) => item.id !== id));
    },
  }), []);
  const current = stack[stack.length - 1];
  const lang = i18n.language?.startsWith("es") ? "es" : "en";
  useLayoutEffect(() => {
    writeDocumentHead(current || { title: BRAND, description: "", noIndex: true, titleFull: true }, lang);
  }, [current, lang]);
  return <MetaContext.Provider value={api}>{children}</MetaContext.Provider>;
}

export default function PageMeta(props: PageMetaProps) {
  const ctx = useContext(MetaContext);
  const id = useId();
  const { i18n } = useTranslation();
  useLayoutEffect(() => {
    if (!ctx) {
      writeDocumentHead(props, i18n.language?.startsWith("es") ? "es" : "en");
      return;
    }
    ctx.push({ ...props, id });
    return () => ctx.pop(id);
  }, [ctx, id, i18n.language, props.title, props.description, props.siteName, props.titleFull, props.noIndex, props.image, props.iconUrl, props.themeColor, props.ogType]);
  return null;
}

export function OfficeMeta({
  slug,
  kind,
  name,
  person,
  pageTitle,
  description,
  image,
  themeColor,
}: {
  slug: string;
  kind: "apply" | "book" | "analyze" | "site";
  name: string;
  person?: string;
  pageTitle?: string;
  description?: string;
  image?: string | null;
  themeColor?: string | null;
}) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const host = useAppSelector((state) => state.legal.host);
  const hostStatus = useAppSelector((state) => state.legal.hostStatus);
  useEffect(() => {
    if (hostStatus === "idle") void dispatch(fetchPublicHost());
  }, [dispatch, hostStatus]);
  const who = person || name;
  const title = pageTitle || (kind === "site" ? name : t(`meta.${kind}Title`, { name: who }));
  const text = description || (kind === "site" ? t("meta.siteDescription", { name }) : t(`meta.${kind}Description`, { name: who }));
  const hostname = window.location.hostname.replace(/^www\./, "");
  const domain = (host?.customDomain || "").replace(/^www\./, "");
  const indexable = Boolean(domain && hostname === domain && host?.slug === slug);
  return (
    <PageMeta
      title={title}
      description={text}
      siteName={name}
      titleFull={title.includes(name)}
      noIndex={!indexable}
      image={image}
      themeColor={themeColor}
      ogType={person ? "profile" : "website"}
    />
  );
}
