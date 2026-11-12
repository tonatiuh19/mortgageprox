import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchTranscripts } from "@/store/slices/recordsSlice";
import PageSkeleton from "@/components/portal/PageSkeleton";
import SectionHeader from "@/components/portal/SectionHeader";
import GridTools from "@/components/portal/GridTools";

export default function Transcripts() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const items = useAppSelector((state) => state.records.transcripts);
  const loading = useAppSelector((state) => state.records.loading);
  const errorKey = useAppSelector((state) => state.records.errorKey);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void dispatch(fetchTranscripts({ search }));
  }, [dispatch, search]);

  if (loading && items.length === 0) return <PageSkeleton cards={2} lines={3} label={t("app.loading")} />;

  return (
    <div className="portal-rise mx-auto min-w-0 max-w-3xl">
      <SectionHeader title={t("modules.transcripts.name")} tools={<Input className="section-search" aria-label={t("command.search")} placeholder={t("command.search")} value={search} onChange={(event) => setSearch(event.target.value)} />} />
      <GridTools screen="transcripts" path="/api/app/transcripts" filename="transcripts.csv" query={{ search }} onApply={(next) => setSearch(next.search || "")} />
      <p className="mt-2 text-sm text-muted-foreground">{t("app.transcriptHelp")}</p>
      <ul className="mt-6 space-y-3">
        {items.map((item) => (
          <li key={item.id} className="min-w-0 rounded-2xl border border-border bg-card p-4">
            <strong className="block">{item.subject}</strong>
            <p className="mt-2 whitespace-pre-wrap text-sm">{item.transcript}</p>
            <p className="mt-2 text-xs text-muted-foreground">{item.emailed ? t("app.transcriptEmailed") : t("app.transcriptSaved")}</p>
          </li>
        ))}
      </ul>
      {!items.length ? <p className="mt-6 text-sm text-muted-foreground">{t("grid.empty")}</p> : null}
      {errorKey ? <p className="mt-4 text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
    </div>
  );
}
