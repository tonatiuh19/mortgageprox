import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { roleCan } from "@shared/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearSaved, fetchCampaignCapacity, fetchTenants, saveCampaignCapacity } from "@/store/slices/commandSlice";

export default function CommandOverview() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { tenants, pagination, campaignCeiling, campaignCeilingUsed, saved, errorKey } = useAppSelector((state) => state.command);
  const user = useAppSelector((state) => state.auth.user);
  const [ceiling, setCeiling] = useState("");
  const canBill = Boolean(user && roleCan(user.role, "tenants.billing"));

  useEffect(() => {
    void dispatch(fetchTenants({ page: 1 }));
    void dispatch(fetchCampaignCapacity());
  }, [dispatch]);

  useEffect(() => {
    if (campaignCeiling != null) setCeiling(String(campaignCeiling));
  }, [campaignCeiling]);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-4xl tracking-tight">{t("command.welcome")}</h1>
      <p className="mt-2 text-muted-foreground">{user?.firstName} {user?.lastName}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">{t("command.tenants")}</p>
          <p className="mt-2 font-display text-4xl tabular-nums">{pagination?.total ?? tenants.length}</p>
        </article>
      </div>
      <Link to="/command/tenants" className="mt-6 inline-flex text-sm text-primary">{t("command.tenants")}</Link>
      <section className="mt-8 max-w-xl rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-2xl">{t("command.campaignCeiling")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("command.campaignCeilingNote")}</p>
        <p className="mt-3 text-sm tabular-nums">{t("billing.campaignUsed", { used: campaignCeilingUsed.toLocaleString(), included: (campaignCeiling || 0).toLocaleString() })}</p>
        {canBill ? (
          <form className="mt-4 flex min-w-0 flex-wrap items-center gap-2" onSubmit={(event) => {
            event.preventDefault();
            void dispatch(saveCampaignCapacity(Number(ceiling))).then(() => window.setTimeout(() => dispatch(clearSaved()), 1500));
          }}>
            <Input className="w-32" inputMode="numeric" aria-label={t("command.campaignCeiling")} value={ceiling} onChange={(event) => setCeiling(event.target.value)} />
            <Button type="submit">{t("command.campaignSave")}</Button>
          </form>
        ) : null}
        {saved ? <p className="mt-2 text-sm text-muted-foreground">{t("command.saved")}</p> : null}
        {errorKey ? <p className="mt-2 text-sm text-destructive">{t(errorKey)}</p> : null}
      </section>
    </div>
  );
}
