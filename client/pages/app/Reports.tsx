import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { formatMoney } from "@/lib/format";
import PageSkeleton from "@/components/portal/PageSkeleton";
import SectionHeader from "@/components/portal/SectionHeader";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchReport } from "@/store/slices/recordsSlice";

export default function Reports() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const report = useAppSelector((state) => state.records.report);

  useEffect(() => {
    void dispatch(fetchReport());
  }, [dispatch]);

  if (!report) return <PageSkeleton cards={4} lines={3} label={t("app.loading")} />;

  const cards = [
    [t("app.open"), report.openLoans],
    [t("app.funded"), report.funded],
    [t("app.conversion"), `${report.conversionPct}%`],
    [t("app.daysToClose"), report.avgDaysToClose ?? t("grid.empty")],
    [t("loan.revenue"), formatMoney(report.revenueCents || 0)],
    [t("loan.approval"), `${report.approvalPct || 0}%`],
  ] as const;

  return (
    <div className="portal-rise mx-auto max-w-5xl">
      <SectionHeader title={t("app.reports")} />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <article key={label} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 font-display text-4xl tabular-nums">{value}</p>
          </article>
        ))}
      </div>
      <div className="mt-6 space-y-2">
        {(report.purposes || []).map((item) => (
          <div key={item.code}>
            <div className="mb-1 flex justify-between text-sm"><span>{t(`app.${item.code}`)}</span><span className="tabular-nums">{item.count}</span></div>
            <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, item.count * 12)}%` }} /></div>
          </div>
        ))}
      </div>
      <p className="mt-4"><a className="text-sm underline" href="/api/app/reports?format=csv">{t("loan.csv")}</a></p>
      <div className="table-scroll mt-6">
        <table className="w-full min-w-[280px] text-sm">
          <caption className="mb-2 text-left font-display text-2xl">{t("loan.sources")}</caption>
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-2 pr-3">{t("loan.source")}</th>
              <th className="py-2 pr-3">{t("loan.count")}</th>
              <th className="py-2">{t("loan.share")}</th>
            </tr>
          </thead>
          <tbody>
            {(report.sources || []).map((source) => (
              <tr key={source.code} className="border-t border-border">
                <td className="py-2 pr-3">{t(`source.${source.code}`)}</td>
                <td className="py-2 pr-3 tabular-nums">{source.count}</td>
                <td className="py-2 tabular-nums">{source.share}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-6 space-y-2">
        {report.officers.map((officer) => (
          <li key={officer.name} className="flex justify-between rounded-2xl border border-border bg-card p-4">
            <strong>{officer.name}</strong>
            <span className="text-sm text-muted-foreground">{t("app.open")} {officer.openLoans} · {t("app.funded")} {officer.funded}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
