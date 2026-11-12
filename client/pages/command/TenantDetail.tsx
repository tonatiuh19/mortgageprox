import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { roleCan } from "@shared/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import { Textarea } from "@/components/ui/textarea";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearSaved, fetchTenant, updateTenant } from "@/store/slices/commandSlice";
import OfficeMenu from "@/pages/app/OfficeMenu";
import TenantLegalEditors from "@/components/content/TenantLegalEditors";
import TenantEmailEditors from "@/components/email/TenantEmailEditors";
import { DEFAULT_BRAND, type BrandHeadline, type BrandRadius } from "@/lib/brand";
import DevFill from "@/components/dev/DevFill";

export default function TenantDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const dispatch = useAppDispatch();
  const tenant = useAppSelector((state) => state.command.tenant) as Record<string, unknown> | null;
  const saved = useAppSelector((state) => state.command.saved);
  const user = useAppSelector((state) => state.auth.user);
  const [notes, setNotes] = useState("");
  const [included, setIncluded] = useState("");

  useEffect(() => {
    if (id) void dispatch(fetchTenant(Number(id)));
  }, [dispatch, id]);

  useEffect(() => {
    if (tenant) {
      setNotes(String(tenant.notes || ""));
      setIncluded(tenant.campaignIncludedOverride == null ? "" : String(tenant.campaignIncludedOverride));
    }
  }, [tenant]);

  if (!tenant || Number(tenant.id) !== Number(id)) return <p className="text-sm text-muted-foreground">…</p>;
  const modules = (tenant.modules as string[]) || [];

  async function patch(body: Record<string, unknown>) {
    await dispatch(updateTenant({ id: Number(id), patch: body }));
    await dispatch(fetchTenant(Number(id)));
    window.setTimeout(() => dispatch(clearSaved()), 1500);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-muted-foreground">{t("command.detail")}</p>
      <h1 className="font-display text-4xl">{String(tenant.name)}</h1>
      <p className="mt-2 text-muted-foreground">{String(tenant.ownerEmail || "")}</p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <dt className="text-xs text-muted-foreground">{t("command.status")}</dt>
          <dd>{t(`command.${tenant.status}`, { defaultValue: String(tenant.status) })}</dd>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <dt className="text-xs text-muted-foreground">{t("command.plan")}</dt>
          <dd>{tenant.planNameKey ? t(String(tenant.planNameKey)) : "—"}</dd>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <dt className="text-xs text-muted-foreground">{t("loan.seats")}</dt>
          <dd>{tenant.seatLimit == null ? t("app.seatsOpen", { used: Number(tenant.seatsUsed || 0) }) : t("app.seatsUsed", { used: Number(tenant.seatsUsed || 0), limit: Number(tenant.seatLimit) })}</dd>
        </div>
        {Number(tenant.startFeeCents) > 0 ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <dt className="text-xs text-muted-foreground">{t("command.startFee")}</dt>
            <dd>{formatMoney(Number(tenant.startFeeCents))} · {t(`command.fee.${tenant.startFeeStatus}`, { defaultValue: String(tenant.startFeeStatus) })}</dd>
          </div>
        ) : null}
      </dl>
      <ul className="mt-4 flex flex-wrap gap-2">
        {modules.map((code) => <li key={code} className="rounded-full bg-muted px-3 py-1 text-xs">{t(`modules.${code}.name`, { defaultValue: code })}</li>)}
      </ul>
      <div className="mt-6 flex flex-wrap gap-2">
        {user && roleCan(user.role, "tenants.billing") ? (
          <Button type="button" variant="outline" onClick={() => void patch({ extendTrialDays: 30 })}>{t("command.extend")}</Button>
        ) : null}
        {user && roleCan(user.role, "tenants.billing") ? (
          <Button type="button" onClick={() => void patch({ status: "active" })}>{t("command.activate")}</Button>
        ) : null}
        {user && roleCan(user.role, "tenants.billing") && tenant.startFeeStatus === "due" ? (
          <Button type="button" variant="outline" onClick={() => void patch({ markStartFeePaid: true })}>{t("command.markFeePaid")}</Button>
        ) : null}
        {user && roleCan(user.role, "tenants.suspend") ? (
          <Button type="button" variant="destructive" onClick={() => void patch({ status: "suspended" })}>{t("command.suspend")}</Button>
        ) : null}
      </div>
      {user && roleCan(user.role, "tenants.billing") && (tenant.planCode === "scale" || tenant.planCode === "custom") ? (
        <form className="mt-8 max-w-md space-y-2" onSubmit={(event) => {
          event.preventDefault();
          void patch({ campaignIncluded: included.trim() === "" ? null : Number(included) });
        }}>
          <label className="text-sm" htmlFor="campaign-included">{t("command.includedContacts")}</label>
          <p className="text-xs text-muted-foreground">{t("command.includedContactsNote")}</p>
          <div className="flex min-w-0 flex-wrap gap-2">
            <Input id="campaign-included" className="w-32" inputMode="numeric" value={included} onChange={(event) => setIncluded(event.target.value)} />
            <Button type="submit" variant="outline">{t("command.campaignSave")}</Button>
          </div>
        </form>
      ) : null}
      {user && roleCan(user.role, "tenants.write") ? (
        <div className="mt-8 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm" htmlFor="notes">{t("command.notes")}</label>
            <DevFill onFill={() => { if (!notes.trim()) setNotes("Trial check-in. Owner confirmed the team and asked about conversations."); }} />
          </div>
          <Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          <Button type="button" variant="outline" onClick={() => void patch({ notes })}>{t("command.saveNotes")}</Button>
          {saved ? <p className="text-sm text-muted-foreground">{t("command.saved")}</p> : null}
          <OfficeMenu tenantId={Number(id)} />
          <div className="pt-6">
            <TenantLegalEditors tenantId={Number(id)} />
          </div>
          <TenantEmailEditors
            tenantId={Number(id)}
            brand={{
              name: String(tenant.name),
              logoUrl: tenant.logoUrl ? String(tenant.logoUrl) : null,
              accent: tenant.primaryColor ? String(tenant.primaryColor) : DEFAULT_BRAND.accent,
              radius: (tenant.brandRadius === "sharp" || tenant.brandRadius === "round" ? tenant.brandRadius : "soft") as BrandRadius,
              headline: (tenant.brandHeadline === "sans" || tenant.brandHeadline === "italic" ? tenant.brandHeadline : "serif") as BrandHeadline,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
