import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PageMeta from "@/components/PageMeta";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { allowanceLines } from "@/lib/allowance";
import { formatMoney } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCatalog } from "@/store/slices/catalogSlice";

export default function Pricing() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { plans, addons, status } = useAppSelector((state) => state.catalog);

  useEffect(() => {
    if (status === "idle") void dispatch(fetchCatalog());
  }, [status, dispatch]);

  return (
    <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
      <PageMeta title={t("pricing.title")} description={t("pricing.description")} />
      <p className="text-sm font-medium text-primary">{t("pricing.eyebrow")}</p>
      <h1 className="mt-3 max-w-3xl font-display text-4xl tracking-tight sm:text-6xl">{t("pricing.title")}</h1>
      <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{t("pricing.description")}</p>
      <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {status === "idle" || status === "loading" ? Array.from({ length: 4 }, (_, index) => (
          <article key={index} className="rounded-2xl border border-border bg-card p-6" data-testid="pricing-skeleton" aria-busy="true" aria-label={t("wizard.loading")}>
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="mt-4 h-8 w-28" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-4/5" />
            <Skeleton className="mt-6 h-10 w-32" />
            <Skeleton className="mt-6 h-11 w-full rounded-xl" />
          </article>
        )) : plans.map((plan) => {
          const price = formatMoney(plan.priceCents, plan.isQuote);
          return (
            <article key={plan.code} className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-6 shadow-card">
              <span className="w-fit rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">{plan.isQuote ? t("pricing.quoted") : t("pricing.trial")}</span>
              <h2 className="mt-4 font-display text-3xl">{t(plan.nameKey)}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{t(plan.taglineKey)}</p>
              <p className="mt-6 font-display text-4xl tabular-nums">
                {plan.isQuote ? t("pricing.quote") : price}
                {!plan.isQuote ? <span className="ml-1 font-sans text-base text-muted-foreground">{t("pricing.perMonth")}</span> : null}
              </p>
              {!plan.isQuote && plan.trialFeeCents > 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">{t("pricing.startFee", { fee: formatMoney(plan.trialFeeCents) })}</p>
              ) : null}
              <p className="mt-2 text-sm text-muted-foreground">
                {plan.seatLimit > 0 ? t("pricing.seats", { count: plan.seatLimit }) : t("pricing.seatsOpen")}
              </p>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {allowanceLines(plan).map((line) => (
                  <li key={line.key}>
                    {line.kind === "quote"
                      ? t("pricing.allowanceQuote")
                      : t(`pricing.allowance.${line.key}.${line.kind}`, { count: line.count })}
                  </li>
                ))}
                {plan.code === "scale" || plan.code === "custom" ? <li>{t("pricing.mcp")}</li> : null}
              </ul>
              <Button asChild className="mt-6 w-full">
                <Link to="/start">{t("pricing.choose")}</Link>
              </Button>
            </article>
          );
        })}
      </div>
      <h2 className="mt-16 font-display text-3xl">{t("pricing.addons")}</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {addons.filter((addon) => addon.code !== "extra_seat" && addon.code !== "custom_styles").map((addon) => (
          <article key={addon.code} className="min-w-0 rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold">{t(addon.nameKey)}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t(addon.summaryKey)}</p>
            {addon.code === "custom_domain" ? (
              <p className="mt-4 text-sm">{t("pricing.includedScale")}</p>
            ) : (
              <p className="mt-4 tabular-nums">
                {formatMoney(addon.priceCents)} <span className="text-sm text-muted-foreground">{t(`pricing.${addon.billing}`)}</span>
              </p>
            )}
          </article>
        ))}
      </div>
      <p className="mt-8 text-sm text-muted-foreground">{t("pricing.after")}</p>
    </div>
  );
}
