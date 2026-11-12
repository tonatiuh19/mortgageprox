import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PageSkeleton from "@/components/portal/PageSkeleton";
import SectionHeader from "@/components/portal/SectionHeader";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchDashboard } from "@/store/slices/workspaceSlice";
import NewLoanDialog from "@/components/portal/NewLoanDialog";

export default function Dashboard() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { dashboard, dashboardStatus, errorKey } = useAppSelector((state) => state.workspace);
  const [composer, setComposer] = useState(false);

  useEffect(() => {
    void dispatch(fetchDashboard());
  }, [dispatch]);

  if (!dashboard) {
    if (dashboardStatus === "ready" && errorKey) {
      return <p className="text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p>;
    }
    return <PageSkeleton cards={4} lines={3} label={t("app.loading")} />;
  }

  const office = user?.role === "brokerage_owner" || user?.role === "leadership";
  const inbox = user?.modules.includes("conversations");
  const stageMax = Math.max(1, ...dashboard.stages.map((stage) => stage.count));
  const cards: { label: string; value: string; to: string }[] = [
    { label: t("app.clientsCount"), value: String(dashboard.clients), to: "/app/clients" },
    { label: t("app.loansCount"), value: String(dashboard.openLoans), to: "/app/pipeline" },
  ];
  if (dashboard.openTasks != null) cards.push({ label: t("app.tasksCount"), value: String(dashboard.openTasks), to: "/app/tasks" });
  if (dashboard.unread != null) cards.push({ label: t("app.unread"), value: String(dashboard.unread), to: "/app/conversations" });

  return (
    <div className="portal-rise mx-auto min-w-0 max-w-5xl">
      <SectionHeader title={t("app.hello", { name: user?.firstName || user?.tenantName })} meta={dashboard.scope === "own" ? t("app.yourBook") : t("app.theOffice")} />
      {user?.tenantName ? <p className="mt-2 text-muted-foreground">{user.tenantName}</p> : null}
      {dashboard.seatsUsed != null ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {dashboard.seatLimit == null
            ? t("app.seatsOpen", { used: dashboard.seatsUsed })
            : t("app.seatsUsed", { used: dashboard.seatsUsed, limit: dashboard.seatLimit })}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild><Link to="/app/pipeline">{t("app.addLoan")}</Link></Button>
        <Button type="button" variant="outline" onClick={() => setComposer(true)}>{t("pipeline.newTitle")}</Button>
        <Button asChild variant="outline"><Link to="/app/clients">{t("app.addClient")}</Link></Button>
        {inbox ? <Button asChild variant="outline"><Link to="/app/conversations">{t("app.openInbox")}</Link></Button> : null}
        {office ? <Button asChild variant="outline"><Link to="/app/billing">{dashboard.startFeeStatus === "due" ? t("app.payFee") : t("app.reviewBilling")}</Link></Button> : null}
      </div>
      {errorKey ? <p className="mt-4 text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
      <div className="mt-8 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.to + card.label} to={card.to} className="rounded-2xl border border-border bg-card p-5 shadow-card transition-colors hover:border-primary">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-2 font-display text-4xl tabular-nums">{card.value}</p>
          </Link>
        ))}
      </div>
      <section className="mt-8">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-2xl">{t("app.byStage")}</h2>
          <Link className="text-sm font-medium text-primary" to="/app/pipeline">{t("app.viewPipeline")}</Link>
        </div>
        <ul className="mt-4 space-y-3">
          {dashboard.stages.map((stage) => (
            <li key={stage.id}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{stage.name}</span>
                <span className="tabular-nums text-muted-foreground">{stage.count}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((stage.count / stageMax) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>
      {typeof dashboard.revenueCents === "number" ? (
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{t("loan.revenue")}</p>
            <p className="mt-2 font-display text-4xl tabular-nums">{formatMoney(dashboard.revenueCents)}</p>
          </article>
          <article className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("loan.approval")}</span>
              <span className="tabular-nums">{dashboard.approvalPct || 0}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, dashboard.approvalPct || 0)}%` }} />
            </div>
          </article>
          <div className="space-y-2 sm:col-span-2">
            {(dashboard.purposes || []).map((item) => (
              <div key={item.code}>
                <div className="mb-1 flex justify-between text-sm"><span>{t(`app.${item.code}`)}</span><span className="tabular-nums">{item.count}</span></div>
                <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, item.count * 12)}%` }} /></div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <div className="mt-8 grid min-w-0 gap-4 lg:grid-cols-2">
        {dashboard.dueTasks ? (
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">{t("app.dueSoon")}</h2>
            {dashboard.dueTasks.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t("app.nothingDue")}</p> : (
              <ul className="mt-3 space-y-2">
                {dashboard.dueTasks.map((task) => (
                  <li key={task.id}>
                    <Link className="block rounded-xl px-2 py-2 hover:bg-muted" to="/app/tasks">
                      <span className="block font-medium">{task.title}</span>
                      {task.dueAt ? <span className="text-xs text-muted-foreground">{new Date(task.dueAt).toLocaleString()}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-2xl">{t("app.recentLoans")}</h2>
          {dashboard.recentLoans.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t("app.noOpenLoans")}</p> : (
            <ul className="mt-3 space-y-2">
              {dashboard.recentLoans.map((loan) => (
                <li key={loan.id}>
                  <Link className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-muted" to="/app/pipeline">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{loan.name}</span>
                      <span className="text-xs text-muted-foreground">{loan.stage || t(`loans.${loan.purpose}`, { defaultValue: loan.purpose })}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">{formatMoney(loan.amountCents)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {composer ? <NewLoanDialog open={composer} onOpenChange={setComposer} /> : null}
    </div>
  );
}
