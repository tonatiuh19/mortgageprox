import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import PageSkeleton from "@/components/portal/PageSkeleton";
import SectionHeader from "@/components/portal/SectionHeader";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchModules, setModule, upgradePlan, type ModuleOffer } from "@/store/slices/modulesSlice";

function Offer({
  item,
  owner,
  price,
  busy,
  onToggle,
  onUpgrade,
}: {
  item: ModuleOffer;
  owner: boolean;
  price: string;
  busy: boolean;
  onToggle: (code: string, enabled: boolean) => void;
  onUpgrade: (planCode: string, moduleCode: string) => void;
}) {
  const { t } = useTranslation();
  const core = item.category === "core";
  return (
    <article id={`module-${item.code}`} className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-medium">{t(`modules.${item.code}.name`, { defaultValue: item.code })}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t(`modules.${item.code}.summary`, { defaultValue: "" })}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {item.included ? (item.enabled ? t("market.on") : t("market.off")) : t(`plans.${item.minimumPlan}.name`)}
        </span>
      </div>
      {owner && item.included && !(core && item.enabled) ? (
        <Button className="mt-4 w-full sm:w-auto" type="button" variant={item.enabled ? "outline" : "default"} disabled={busy} onClick={() => onToggle(item.code, !item.enabled)}>
          {item.enabled ? t("market.turnOff") : t("market.turnOn")}
        </Button>
      ) : null}
      {owner && !item.included ? (
        <Button className="mt-4 w-full sm:w-auto" type="button" disabled={busy} onClick={() => onUpgrade(item.minimumPlan, item.code)}>
          {t("market.upgrade", { plan: t(`plans.${item.minimumPlan}.name`), price })}
        </Button>
      ) : null}
      {!owner && !item.included ? <p className="mt-3 text-sm text-muted-foreground">{t("market.askOwner")}</p> : null}
    </article>
  );
}

export default function Modules() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { catalog, status, errorKey } = useAppSelector((state) => state.modules);
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const focus = params.get("code") || "";

  useEffect(() => {
    if (status === "idle") void dispatch(fetchModules());
  }, [status, dispatch]);

  useEffect(() => {
    if (!focus || !catalog) return;
    document.getElementById(`module-${focus}`)?.scrollIntoView({ block: "center" });
  }, [focus, catalog]);

  async function onToggle(code: string, enabled: boolean) {
    setBusy(true);
    await dispatch(setModule({ code, enabled }));
    setBusy(false);
  }

  async function onUpgrade(planCode: string, moduleCode: string) {
    setBusy(true);
    await dispatch(upgradePlan({ planCode, moduleCode }));
    setBusy(false);
  }

  const items = catalog?.items || [];
  const onPlan = items.filter((item) => item.included);
  const higher = items.filter((item) => !item.included);
  const priceFor = (code: string) => {
    const plan = catalog?.plans.find((item) => item.code === code);
    return plan ? formatMoney(plan.priceCents) : "";
  };

  if (!catalog && status !== "ready") return <PageSkeleton cards={2} lines={4} label={t("app.loading")} />;

  return (
    <div className="portal-rise mx-auto min-w-0 max-w-3xl space-y-8">
      <div>
        <SectionHeader title={t("market.title")} />
        <p className="mt-2 text-sm text-muted-foreground">{t("market.lead")}</p>
      </div>
      {errorKey ? <p className="text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
      <section className="space-y-3">
        <h2 className="font-display text-2xl">{t("market.onPlan")}</h2>
        {onPlan.map((item) => (
          <Offer key={item.code} item={item} owner={Boolean(catalog?.owner)} price="" busy={busy} onToggle={onToggle} onUpgrade={onUpgrade} />
        ))}
      </section>
      {higher.length ? (
        <section className="space-y-3">
          <h2 className="font-display text-2xl">{t("market.higher")}</h2>
          <p className="text-sm text-muted-foreground">{t("market.note")}</p>
          {higher.map((item) => (
            <Offer key={item.code} item={item} owner={Boolean(catalog?.owner)} price={priceFor(item.minimumPlan)} busy={busy} onToggle={onToggle} onUpgrade={onUpgrade} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
