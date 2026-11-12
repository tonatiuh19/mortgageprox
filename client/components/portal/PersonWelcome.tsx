import type { ReactNode } from "react";
import { Globe, Mail, MapPin, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PublicOffice } from "@/store/slices/workspaceSlice";

function Mark({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor">
      <path d={d} />
    </svg>
  );
}

function prettyPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) return value;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0].slice(0, 2);
  return letters.toUpperCase();
}

const LINKS = [
  ["website", "globe"],
  ["linkedin", "M4.98 3.5C4.98 4.88 3.88 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8.5h4V24h-4V8.5zM8.5 8.5h3.8v2.1h.1c.5-1 1.8-2.1 3.8-2.1 4 0 4.8 2.6 4.8 6.1V24h-4v-7.7c0-1.8 0-4.2-2.6-4.2s-3 2-3 4V24h-4V8.5z"],
  ["facebook", "M22 12a10 10 0 1 0-11.6 9.9v-7H7.7V12h2.7V9.8c0-2.7 1.6-4.2 4-4.2 1.2 0 2.4.2 2.4.2v2.6h-1.4c-1.3 0-1.7.8-1.7 1.7V12h3l-.5 2.9h-2.5v7A10 10 0 0 0 22 12z"],
  ["instagram", "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm10 2H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zm-5 3.2A4.8 4.8 0 1 1 7.2 12 4.8 4.8 0 0 1 12 7.2zm0 2A2.8 2.8 0 1 0 14.8 12 2.8 2.8 0 0 0 12 9.2zM17.6 6.2a1.1 1.1 0 1 1-1.1 1.1 1.1 1.1 0 0 1 1.1-1.1z"],
  ["youtube", "M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8zM9.8 15.5v-7l6.2 3.5z"],
] as const;

function Channel({ href, label, value, icon, external }: { href: string; label: string; value: string; icon: ReactNode; external?: boolean }) {
  return (
    <a className="group flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/30" href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
        <span className="block break-words text-sm font-semibold leading-5">{value}</span>
      </span>
    </a>
  );
}

export default function PersonWelcome({ office, children }: { office: PublicOffice; children?: ReactNode }) {
  const { t } = useTranslation();
  const person = office.officer;
  const phone = person?.phone || office.phone;
  const email = person?.email || office.email;
  const links = LINKS.flatMap(([key, mark]) => {
    const href = person?.links[key] || "";
    return href ? [{ key, href, mark }] : [];
  });
  const focus = (person?.specializations || []).filter(Boolean);
  const mark = person ? initials(person.name) : "";

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-float">
      <div className="h-1.5 bg-primary" />
      <div className="px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex justify-center">
          {office.logoUrl ? (
            <img src={office.logoUrl} alt={office.name} className="max-h-10 max-w-[180px] object-contain" />
          ) : person ? (
            <p className="font-display text-lg leading-none tracking-tight">{office.name}</p>
          ) : null}
        </div>
        {person ? (
          <div className="mt-6 flex min-w-0 items-center gap-4">
            {person.photoUrl ? (
              <img src={person.photoUrl} alt="" className="size-[4.5rem] shrink-0 rounded-full object-cover ring-2 ring-primary ring-offset-2 ring-offset-card" />
            ) : (
              <span className="grid size-[4.5rem] shrink-0 place-items-center rounded-full bg-primary/10 font-display text-xl text-primary ring-2 ring-primary/25" aria-hidden="true">{mark}</span>
            )}
            <div className="min-w-0">
              <h1 className="truncate font-display text-[1.75rem] leading-none">{person.name}</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {t("apply.banker")}
                {person.nmls ? ` · ${t("apply.nmls", { nmls: person.nmls })}` : ""}
              </p>
            </div>
          </div>
        ) : (
          <h1 className="mt-2 text-center font-display text-3xl">{office.name}</h1>
        )}
        {focus.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {focus.map((item) => (
              <li key={item} className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium">{t(`profile.${item}`, { defaultValue: item })}</li>
            ))}
          </ul>
        ) : null}
        {person?.bio ? <p className="mt-4 border-l-2 border-primary/50 pl-3 text-sm italic leading-relaxed text-muted-foreground">{person.bio}</p> : null}
        {phone || email || office.address ? (
          <div className="mt-5 rounded-2xl bg-muted/70 p-3">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("apply.getInTouch")}</p>
            <div className="mt-2 space-y-2">
              {phone ? <Channel href={`tel:${phone}`} label={t("apply.phone")} value={prettyPhone(phone)} icon={<Phone size={15} />} /> : null}
              {email ? <Channel href={`mailto:${email}`} label={t("apply.email")} value={email} icon={<Mail size={15} />} /> : null}
              {office.address ? (
                <Channel
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(office.address)}`}
                  label={`${t("apply.address")} · ${t("apply.maps")}`}
                  value={office.address}
                  icon={<MapPin size={15} />}
                  external
                />
              ) : null}
            </div>
          </div>
        ) : null}
        {links.length > 0 ? (
          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("apply.connect")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {links.map(({ key, href, mark: path }) => (
                <a key={key} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/30 hover:text-primary" href={href} target="_blank" rel="noreferrer">
                  {path === "globe" ? <Globe size={14} /> : <Mark d={path} />}
                  {t(`apply.${key}`)}
                </a>
              ))}
            </div>
          </div>
        ) : null}
        {children ? <div className="mt-6 border-t border-border pt-6">{children}</div> : null}
      </div>
    </article>
  );
}
