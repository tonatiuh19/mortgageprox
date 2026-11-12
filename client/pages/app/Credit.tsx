import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { createCredit, fetchCredit } from "@/store/slices/recordsSlice";
import DevFill from "@/components/dev/DevFill";
import PageSkeleton from "@/components/portal/PageSkeleton";
import SectionHeader from "@/components/portal/SectionHeader";
import GridTools from "@/components/portal/GridTools";
import LegalAgree from "@/components/content/LegalAgree";

const BANDS = ["unknown", "excellent", "good", "fair", "poor"] as const;

export function CreditForm({ portal = false }: { portal?: boolean }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const errorKey = useAppSelector((state) => state.records.errorKey);
  const [summary, setSummary] = useState("");
  const [scoreBand, setScoreBand] = useState("unknown");
  const [clientId, setClientId] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileBase64, setFileBase64] = useState("");
  const [saved, setSaved] = useState(false);
  const [agreed, setAgreed] = useState(true);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (portal && !agreed) return;
    const result = await dispatch(createCredit({
      portal,
      summary,
      scoreBand,
      clientId: clientId ? Number(clientId) : null,
      fileName,
      fileBase64,
    }));
    if (createCredit.fulfilled.match(result)) {
      setSaved(true);
      setSummary("");
      if (!portal) void dispatch(fetchCredit({}));
    }
  }

  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <DevFill className="justify-self-start" onFill={() => {
        setSummary("Borrower uploaded a tri-merge summary. No collections. Two revolving accounts in good standing.");
        setScoreBand("good");
      }} />
      <p className="text-sm text-muted-foreground">{t("app.creditNote")}</p>
      {!portal ? <Input aria-label={t("app.client")} placeholder={t("app.loanId")} value={clientId} onChange={(event) => setClientId(event.target.value)} /> : null}
      <Textarea required aria-label={t("app.summary")} placeholder={t("app.summary")} value={summary} onChange={(event) => setSummary(event.target.value)} />
      <select className="h-11 rounded-md border border-input bg-background px-3" aria-label={t("app.scoreBand")} value={scoreBand} onChange={(event) => setScoreBand(event.target.value)}>
        {BANDS.map((band) => <option key={band} value={band}>{band}</option>)}
      </select>
      <Input aria-label={t("app.file")} type="file" onChange={(event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = () => setFileBase64(String(reader.result || ""));
        reader.readAsDataURL(file);
      }} />
      {portal ? <LegalAgree checked={agreed} onChange={setAgreed} /> : null}
      <Button type="submit" disabled={portal && !agreed}>{t("app.addCredit")}</Button>
      {saved ? <p className="text-sm text-muted-foreground">{t("command.saved")}</p> : null}
      {errorKey ? <p className="text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
    </form>
  );
}

export default function Credit() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const items = useAppSelector((state) => state.records.credit);
  const loading = useAppSelector((state) => state.records.loading);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void dispatch(fetchCredit({ search }));
  }, [dispatch, search]);

  if (loading && items.length === 0) return <PageSkeleton cards={1} lines={4} label={t("app.loading")} />;

  return (
    <div className="portal-rise mx-auto max-w-3xl">
      <SectionHeader title={t("modules.credit.name")} tools={<Input className="section-search" aria-label={t("command.search")} placeholder={t("command.search")} value={search} onChange={(event) => setSearch(event.target.value)} />} />
      <GridTools screen="credit" path="/api/app/credit" filename="credit.csv" query={{ search }} onApply={(next) => setSearch(next.search || "")} />
      <div className="mt-6"><CreditForm /></div>
      <ul className="mt-6 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-2xl border border-border bg-card p-4">
            <strong>{item.scoreBand}</strong>
            <p className="mt-1 text-sm">{item.summary}</p>
            {item.fileName ? <a className="text-sm underline" href={`/api/app/credit/${item.id}/file`}>{item.fileName}</a> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
