import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PublicOffice } from "@/store/slices/workspaceSlice";

const STEPS = ["identity", "property", "finances", "employment", "review"] as const;

export default function ApplyFrame({
  office,
  step,
  saved,
  children,
  onLegal,
}: {
  office: PublicOffice;
  step: number;
  saved: boolean;
  children: ReactNode;
  onLegal: (code: "terms" | "privacy") => void;
}) {
  const { t } = useTranslation();
  const total = STEPS.length;
  const place = Math.max(0, step - 1);
  const done = place >= total;
  const progress = total <= 1 ? 0 : Math.min(1, place / (total - 1));
  const person = office.officer?.name || "";
  const showRail = step > 0;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 pb-3 pt-4">
          <div className="min-w-0">
            {office.logoUrl ? (
              <img src={office.logoUrl} alt={office.name} className="max-h-8 max-w-[140px] object-contain" />
            ) : (
              <p className="truncate font-display text-lg leading-none">{office.name}</p>
            )}
            {person ? <p className="mt-1 truncate text-xs text-muted-foreground">{person}</p> : null}
          </div>
          {showRail ? <p className="shrink-0 text-xs tabular-nums text-muted-foreground">{t("apply.stepOf", { current: Math.min(place + 1, total), total })}</p> : null}
        </div>
        {showRail ? <div className="relative mx-auto max-w-lg px-4 pb-3">
          <div className="absolute left-8 right-8 top-[13px] h-px bg-border" aria-hidden="true" />
          <div className="absolute left-8 top-[13px] h-px bg-primary transition-[width] duration-500 ease-out" style={{ width: `calc((100% - 4rem) * ${progress})` }} aria-hidden="true" />
          <ol className="relative grid grid-cols-5" aria-label={t("apply.title")}>
            {STEPS.map((item, index) => {
              const state = done || index < place ? "done" : index === place ? "current" : "todo";
              return (
                <li key={item} className="min-w-0 text-center" aria-current={state === "current" ? "step" : undefined}>
                  <span className={`mx-auto grid size-7 place-items-center rounded-full text-[11px] font-semibold transition-colors duration-500 ${state === "todo" ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"} ${state === "current" ? "apply-dot" : ""}`}>
                    {state === "done" ? <Check size={14} /> : index + 1}
                  </span>
                  <span className={`mt-1 hidden truncate text-[10px] sm:block ${state === "current" ? "font-medium text-foreground" : "text-muted-foreground"}`}>{t(`apply.step.${item}`)}</span>
                </li>
              );
            })}
          </ol>
        </div> : null}
        {saved ? <p className="mx-auto max-w-lg px-4 pb-3 text-xs text-muted-foreground">{t("apply.saved")}</p> : null}
      </header>
      <div className="mx-auto w-full min-w-0 max-w-lg flex-1 px-4 py-6 sm:px-6">{children}</div>
      <footer className="mt-auto border-t border-border bg-muted/40">
        <div className="mx-auto flex max-w-lg flex-col gap-3 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 truncate">{person ? `${office.name} · ${person}` : office.name}</p>
          <p className="flex gap-3">
            <button type="button" className="underline" onClick={() => onLegal("terms")}>{t("legal.terms")}</button>
            <button type="button" className="underline" onClick={() => onLegal("privacy")}>{t("legal.privacy")}</button>
          </p>
        </div>
      </footer>
    </div>
  );
}
