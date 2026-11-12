import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { roleCan, type AllowanceMeter } from "@shared/api";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import PageSkeleton from "@/components/portal/PageSkeleton";
import SectionHeader from "@/components/portal/SectionHeader";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { buyPack, changeCampaignPacks, changeSeats, createMcpKey, fetchBilling, startCheckout } from "@/store/slices/billingSlice";
import StartFeeForm from "@/components/billing/StartFeeForm";

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
}

function meterWidth(meter: AllowanceMeter): number {
  if (meter.included == null || meter.included <= 0) return meter.state === "full" ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((meter.used / meter.included) * 100)));
}

function Meter({ meter, action }: { meter: AllowanceMeter; action?: ReactNode }) {
  const { t } = useTranslation();
  const width = meterWidth(meter);
  const amount = meter.state === "quote"
    ? t("billing.quote")
    : meter.state === "open"
      ? t("billing.open")
      : meter.state === "off"
        ? t("billing.off")
        : t("billing.used", { used: meter.used.toLocaleString(), included: (meter.included || 0).toLocaleString() });
  return (
    <article className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">{t(`billing.meter.${meter.key}`)}</h2>
        <p className="text-sm tabular-nums text-muted-foreground">{amount}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={width} aria-valuemin={0} aria-valuemax={100} aria-label={t(`billing.meter.${meter.key}`)}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t(`billing.state.${meter.state}`)}</p>
      {action}
    </article>
  );
}

export default function Billing() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { snapshot, clientSecret, status, errorKey } = useAppSelector((state) => state.billing);
  const feeDue = snapshot?.startFeeStatus === "due" && snapshot.startFeeCents > 0;
  const [mcpToken, setMcpToken] = useState<string | null>(null);
  const [mcpBusy, setMcpBusy] = useState(false);
  const [spendBusy, setSpendBusy] = useState(false);
  const canSpend = Boolean(user && roleCan(user.role, "settings.write"));

  async function createKey() {
    setMcpBusy(true);
    const created = await dispatch(createMcpKey());
    setMcpBusy(false);
    if (createMcpKey.fulfilled.match(created)) setMcpToken(created.payload.token);
  }

  async function spendCampaign(action: "add" | "remove") {
    setSpendBusy(true);
    await dispatch(changeCampaignPacks(action));
    setSpendBusy(false);
  }

  async function spendSeat(action: "add" | "remove") {
    setSpendBusy(true);
    await dispatch(changeSeats(action));
    setSpendBusy(false);
  }

  async function spendPack(code: string) {
    setSpendBusy(true);
    await dispatch(buyPack({ code, publishableKey: snapshot?.publishableKey || null }));
    setSpendBusy(false);
  }

  useEffect(() => {
    if (status === "idle") void dispatch(fetchBilling());
  }, [status, dispatch]);

  useEffect(() => {
    if (feeDue && snapshot?.publishableKey && !clientSecret) void dispatch(startCheckout());
  }, [feeDue, snapshot?.publishableKey, clientSecret, dispatch]);

  if (!snapshot && status !== "ready") return <PageSkeleton cards={2} lines={4} label={t("app.loading")} />;

  return (
    <div className="portal-rise mx-auto min-w-0 max-w-3xl space-y-6">
      <div>
        <SectionHeader title={t("app.billing")} />
        <p className="mt-2 text-sm text-muted-foreground">{t("billing.intro")}</p>
      </div>
      {errorKey ? <p className="text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
      {snapshot ? (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm font-medium text-primary">{snapshot.planCode ? t(`plans.${snapshot.planCode}.name`) : t("billing.plan")}</p>
          <p className="mt-2 font-display text-3xl tabular-nums">
            {snapshot.isQuote ? t("pricing.quote") : formatMoney(snapshot.priceCents)}
            {!snapshot.isQuote ? <span className="ml-1 font-sans text-base text-muted-foreground">{t("pricing.perMonth")}</span> : null}
          </p>
          <Link className="mt-3 inline-flex text-sm font-medium text-primary" to="/app/modules">{t("market.open")}</Link>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {snapshot.allowances.map((meter) => {
              const pack = snapshot.packs.find((item) => item.meter === meter.key);
              const figure = meter.key === "seats" && snapshot.seatOffer
                ? snapshot.seatOffer.included.toLocaleString()
                : meter.state === "quote"
                  ? t("billing.quote")
                  : meter.state === "open"
                    ? t("billing.open")
                    : meter.state === "off"
                      ? t("billing.capOff")
                      : (meter.included || 0).toLocaleString();
              const extra = meter.key === "seats" && snapshot.seatOffer
                ? t("billing.thenSeat", { price: formatMoney(snapshot.seatOffer.priceCents) })
                : pack
                  ? t("billing.thenPack", { units: pack.units.toLocaleString(), price: formatMoney(pack.priceCents) })
                  : (meter.key === "sms" || meter.key === "voice") && meter.state !== "off" && meter.state !== "quote" && meter.state !== "open"
                    ? t("billing.thenTwilio")
                    : "";
              return (
                <li key={meter.key} className="min-w-0 rounded-xl bg-muted/70 px-3 py-2">
                  <p className="text-xs text-muted-foreground">{t(`billing.meter.${meter.key}`)}</p>
                  <p className="mt-1 font-display text-2xl tabular-nums">{figure}</p>
                  {extra ? <p className="mt-1 text-xs text-muted-foreground">{extra}</p> : null}
                </li>
              );
            })}
          </ul>
          {feeDue ? (
            <div className="mt-5 space-y-3">
              <p className="text-sm">{t("billing.feeDue", { fee: formatMoney(snapshot.startFeeCents) })}</p>
              {snapshot.publishableKey && clientSecret ? (
                <StartFeeForm
                  publishableKey={snapshot.publishableKey}
                  clientSecret={clientSecret}
                  accent={user?.primaryColor || null}
                  radius={user?.brandRadius || null}
                  label={t("billing.pay", { fee: formatMoney(snapshot.startFeeCents) })}
                />
              ) : (
                <p className="text-sm text-muted-foreground">{t("billing.cardLater")}</p>
              )}
            </div>
          ) : snapshot.startFeeStatus === "paid" ? (
            <p className="mt-3 text-sm text-muted-foreground">{t("billing.feePaid", { fee: formatMoney(snapshot.startFeeCents) })}</p>
          ) : null}
        </section>
      ) : null}
      {snapshot?.campaignOffer ? (
        <section className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-display text-2xl">{t("billing.campaignTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("billing.campaignNote", { price: formatMoney(snapshot.campaignOffer.priceCents), ceiling: snapshot.campaignOffer.ceiling.toLocaleString() })}</p>
          <p className="mt-4 text-sm tabular-nums">{t("billing.campaignUsed", { used: snapshot.campaignOffer.used.toLocaleString(), included: (snapshot.campaignOffer.included + snapshot.campaignOffer.packs * snapshot.campaignOffer.packSize).toLocaleString() })}</p>
          {canSpend ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" disabled={spendBusy} onClick={() => void spendCampaign("add")}>{t("billing.addCampaignPack", { price: formatMoney(snapshot.campaignOffer.priceCents) })}</Button>
              {snapshot.campaignOffer.packs > 0 && snapshot.campaignOffer.used <= snapshot.campaignOffer.included + (snapshot.campaignOffer.packs - 1) * snapshot.campaignOffer.packSize ? (
                <Button type="button" variant="outline" disabled={spendBusy} onClick={() => void spendCampaign("remove")}>{t("billing.removeCampaignPack")}</Button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
      <section>
        <h2 className="font-display text-2xl">{t("billing.included")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("billing.includedNote")}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {snapshot?.allowances.map((meter) => {
            const pack = snapshot.packs.find((item) => item.meter === meter.key);
            const offer = snapshot.seatOffer;
            const seatAction = meter.key === "seats" && offer && canSpend ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted-foreground">{t("billing.seatNote", { included: offer.included, extra: offer.extra, price: formatMoney(offer.priceCents) })}</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={spendBusy} onClick={() => void spendSeat("add")}>{t("billing.addSeat", { price: formatMoney(offer.priceCents) })}</Button>
                  {offer.extra > 0 && offer.used < offer.included + offer.extra ? (
                    <Button type="button" variant="outline" disabled={spendBusy} onClick={() => void spendSeat("remove")}>{t("billing.removeSeat")}</Button>
                  ) : null}
                </div>
              </div>
            ) : null;
            const packAction = canSpend && meter.state === "full" && pack ? (
              <Button type="button" className="mt-3" disabled={spendBusy} onClick={() => void spendPack(pack.code)}>
                {t("billing.addPack", { units: pack.units.toLocaleString(), meter: t(`billing.packUnit.${pack.meter}`), price: formatMoney(pack.priceCents) })}
              </Button>
            ) : null;
            return <Meter key={meter.key} meter={meter} action={seatAction || packAction} />;
          })}
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-display text-2xl">{t("billing.twilioTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("billing.twilioNote")}</p>
      </section>
      {snapshot?.mcp.enabled ? (
        <section className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-display text-2xl">{t("billing.mcpTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("billing.mcpNote")}</p>
          <p className="mt-4 text-sm tabular-nums">{t("billing.mcpUsage", { count: snapshot.mcp.calls, amount: formatCents(snapshot.mcp.cents) })}</p>
          <p className="mt-3 text-xs text-muted-foreground">{t("billing.mcpEndpoint")}</p>
          <p className="break-all font-mono text-sm">{`${window.location.origin}/api/mcp`}</p>
          <p className="mt-3 text-sm text-muted-foreground">
            {snapshot.mcp.tokenPrefix ? t("billing.mcpPrefix", { prefix: snapshot.mcp.tokenPrefix }) : t("billing.mcpNone")}
          </p>
          {mcpToken ? <p className="mt-3 break-all rounded-xl bg-muted p-3 font-mono text-sm">{mcpToken}</p> : null}
          {mcpToken ? <p className="mt-2 text-sm text-muted-foreground">{t("billing.mcpOnce")}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" disabled={mcpBusy} onClick={() => void createKey()}>
              {snapshot.mcp.tokenPrefix || mcpToken ? t("billing.mcpReplace") : t("billing.mcpCreate")}
            </Button>
            {mcpToken ? (
              <Button type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(mcpToken)}>
                {t("billing.mcpCopy")}
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
