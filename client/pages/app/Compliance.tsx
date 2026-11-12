import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SectionHeader from "@/components/portal/SectionHeader";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCompliance, saveCompliance } from "@/store/slices/recordsSlice";

const STATUSES = ["pending", "done", "waived"] as const;

export default function Compliance() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const items = useAppSelector((state) => state.records.compliance);
  const [params] = useSearchParams();
  const [loanId, setLoanId] = useState(params.get("loanId") || "");

  useEffect(() => {
    void dispatch(fetchCompliance(Number(loanId) || 0));
  }, [dispatch, loanId]);

  return (
    <div className="portal-rise mx-auto max-w-3xl">
      <SectionHeader title={t("modules.compliance.name")} />
      <Input className="mt-6" aria-label={t("app.loanId")} placeholder={t("app.loanId")} value={loanId} onChange={(event) => setLoanId(event.target.value)} />
      <ul className="mt-6 space-y-2">
        {items.length === 0 ? <li className="text-sm text-muted-foreground">{t("app.emptyCompliance")}</li> : null}
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
            <div>
              <strong>{t(`compliance.${item.code}`, { defaultValue: item.label })}</strong>
              <p className="text-xs text-muted-foreground">{item.loanId}</p>
            </div>
            <Input className="w-36" type="date" aria-label={t("loan.due")} defaultValue={item.dueOn || ""} onBlur={(event) => void dispatch(saveCompliance({ id: item.id, status: item.status, dueOn: event.target.value })).then(() => dispatch(fetchCompliance(Number(loanId) || 0)))} />
            <Input className="w-28" aria-label={t("loan.document")} placeholder={t("loan.document")} defaultValue={item.documentId ? String(item.documentId) : ""} onBlur={(event) => void dispatch(saveCompliance({ id: item.id, status: item.status, documentId: Number(event.target.value) || undefined })).then(() => dispatch(fetchCompliance(Number(loanId) || 0)))} />
            <select
              aria-label={t("command.status")}
              className="h-11 rounded-md border border-input bg-background px-3"
              value={item.status}
              onChange={(event) => void dispatch(saveCompliance({ id: item.id, status: event.target.value })).then(() => dispatch(fetchCompliance(Number(loanId) || 0)))}
            >
              {STATUSES.map((status) => <option key={status} value={status}>{t(`app.${status}`)}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}
