import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LoanBoardCard, LoanBoardColumn } from "@shared/api";
import { roleCan } from "@shared/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchLoanBoard, fetchLoanBoardMore, loanMoved, type LoanBoardQuery } from "@/store/slices/workspaceSlice";
import { fetchStages, moveLoan, saveStage } from "@/store/slices/recordsSlice";
import PageSkeleton from "@/components/portal/PageSkeleton";
import SectionHeader from "@/components/portal/SectionHeader";
import NewLoanDialog from "@/components/portal/NewLoanDialog";
import { RefreshCw } from "lucide-react";

export default function Pipeline() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const columns = useAppSelector((state) => state.workspace.loanBoard);
  const boardLoading = useAppSelector((state) => state.workspace.loanBoardLoading);
  const officers = useAppSelector((state) => state.workspace.loanOfficers);
  const boardError = useAppSelector((state) => state.workspace.errorKey);
  const moveError = useAppSelector((state) => state.records.errorKey);
  const stages = useAppSelector((state) => state.records.stages);
  const canWrite = !!user && roleCan(user.role, "loans.write");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [purpose, setPurpose] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [range, setRange] = useState("");
  const [stageName, setStageName] = useState("");
  const [composer, setComposer] = useState(false);
  const [wide, setWide] = useState(true);
  const [active, setActive] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [pending, setPending] = useState<{ card: LoanBoardCard; from: LoanBoardColumn; to: LoanBoardColumn } | null>(null);
  const [saving, setSaving] = useState(false);

  const filters: LoanBoardQuery = {
    search: query,
    purpose,
    assigneeId: assigneeId ? Number(assigneeId) : undefined,
    range,
  };

  useEffect(() => {
    const media = window.matchMedia("(min-width: 900px)");
    const apply = () => setWide(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => setQuery(search), 200);
    return () => window.clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    void dispatch(fetchLoanBoard(filters));
  }, [dispatch, query, purpose, assigneeId, range]);

  useEffect(() => {
    void dispatch(fetchStages());
  }, [dispatch]);

  useEffect(() => {
    if (active == null && columns[0]) setActive(columns[0].id);
    if (active != null && columns.length > 0 && !columns.some((column) => column.id === active)) setActive(columns[0].id);
  }, [columns, active]);

  function reload() {
    void dispatch(fetchLoanBoard(filters));
    void dispatch(fetchStages());
  }

  function askMove(card: LoanBoardCard, toId: number) {
    const from = columns.find((column) => column.items.some((item) => item.id === card.id));
    const to = columns.find((column) => column.id === toId);
    if (!from || !to || from.id === to.id || to.id === 0) return;
    setPending({ card, from, to });
  }

  async function confirmMove() {
    if (!pending) return;
    setSaving(true);
    const result = await dispatch(moveLoan({ id: pending.card.id, stageId: pending.to.id }));
    setSaving(false);
    if (moveLoan.fulfilled.match(result)) {
      dispatch(loanMoved({ id: pending.card.id, toId: pending.to.id, status: result.payload.status }));
      setPending(null);
    }
  }

  function shift(stageId: number, dir: -1 | 1) {
    const ids = stages.map((stage) => stage.id);
    const index = ids.indexOf(stageId);
    const next = index + dir;
    if (index < 0 || next < 0 || next >= ids.length) return;
    const swap = ids[next];
    ids[next] = ids[index];
    ids[index] = swap;
    void dispatch(saveStage({ ids })).then(() => reload());
  }

  const visible = wide ? columns : columns.filter((column) => column.id === active);
  const errorKey = moveError || boardError;
  const fromName = pending ? (pending.from.id === 0 ? t("pipeline.noStage") : pending.from.name) : "";
  const toName = pending ? pending.to.name : "";

  if (boardLoading && columns.length === 0) return <PageSkeleton cards={3} lines={4} label={t("app.loading")} />;

  const openCount = columns.reduce((sum, column) => sum + column.total, 0);

  return (
    <div className="portal-rise min-w-0">
      <SectionHeader
        title={t("app.pipeline")}
        meta={t("pipeline.active", { count: openCount })}
        live={t("pipeline.live")}
        tools={(
          <>
            <Input className="section-search" aria-label={t("pipeline.search")} placeholder={t("pipeline.search")} value={search} onChange={(event) => setSearch(event.target.value)} />
            <Button type="button" variant="outline" size="icon" aria-label={t("pipeline.refresh")} onClick={() => reload()}>
              <RefreshCw className={boardLoading ? "animate-spin" : ""} />
            </Button>
            <details className="section-filters">
              <summary>{t("pipeline.filters")}</summary>
              <div>
                <select className="h-11 min-w-0 rounded-xl border border-input bg-background px-3" aria-label={t("pipeline.when")} value={range} onChange={(event) => setRange(event.target.value)}>
                  <option value="">{t("pipeline.anyTime")}</option>
                  <option value="week">{t("pipeline.week")}</option>
                  <option value="month">{t("pipeline.month")}</option>
                </select>
                <select className="h-11 min-w-0 rounded-xl border border-input bg-background px-3" aria-label={t("app.purpose")} value={purpose} onChange={(event) => setPurpose(event.target.value)}>
                  <option value="">{t("pipeline.purposeAll")}</option>
                  <option value="purchase">{t("app.purchase")}</option>
                  <option value="refinance">{t("app.refinance")}</option>
                </select>
                {officers.length > 0 ? (
                  <select className="h-11 min-w-0 rounded-xl border border-input bg-background px-3" aria-label={t("app.officer")} value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
                    <option value="">{t("pipeline.assigneeAll")}</option>
                    {officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.name}</option>)}
                  </select>
                ) : null}
                {canWrite ? (
                  <form className="flex min-w-0 flex-wrap gap-2" onSubmit={(event) => {
                    event.preventDefault();
                    if (stageName.trim().length < 2) return;
                    void dispatch(saveStage({ name: stageName.trim() })).then(() => {
                      setStageName("");
                      reload();
                    });
                  }}>
                    <Input aria-label={t("app.stageName")} placeholder={t("app.stageName")} value={stageName} onChange={(event) => setStageName(event.target.value)} />
                    <Button type="submit" variant="outline">{t("app.addStage")}</Button>
                  </form>
                ) : null}
              </div>
            </details>
            {canWrite ? <Button type="button" onClick={() => setComposer(true)}>{t("app.addLoan")}</Button> : null}
          </>
        )}
      />
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{t("pipeline.lead")}</p>
      {errorKey ? <p className="mt-3 text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
      {!wide ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {columns.map((column) => (
            <Button key={column.id} type="button" variant={active === column.id ? "default" : "outline"} onClick={() => setActive(column.id)}>
              {column.id === 0 ? t("pipeline.noStage") : column.name}
            </Button>
          ))}
        </div>
      ) : null}
      <div className={wide ? "table-scroll mt-4 pb-2" : "mt-4 min-w-0"}>
        <div className={wide ? "flex w-max min-w-full gap-3" : "min-w-0"}>
          {visible.map((column) => {
            const name = column.id === 0 ? t("pipeline.noStage") : column.name;
            const order = stages.findIndex((stage) => stage.id === column.id);
            return (
              <section
                key={column.id}
                className={`min-w-0 rounded-2xl border bg-muted/40 p-3 ${wide ? "w-72 shrink-0" : ""} ${over === column.id ? "border-primary" : "border-border"}`}
                onDragOver={(event) => {
                  if (!canWrite || column.id === 0) return;
                  event.preventDefault();
                  setOver(column.id);
                }}
                onDragLeave={() => setOver((current) => (current === column.id ? null : current))}
                onDrop={(event) => {
                  setOver(null);
                  if (!canWrite || column.id === 0) return;
                  const id = Number(event.dataTransfer.getData("text/plain"));
                  const card = columns.flatMap((item) => item.items).find((item) => item.id === id);
                  if (card) askMove(card, column.id);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="stage-title min-w-0 break-words text-sm font-semibold" data-tone={String(order < 0 ? 0 : order % 6)}>{name}</h2>
                    {column.code ? <p className="mt-0.5 text-xs text-muted-foreground">{t(`pipeline.hint.${column.code}`, { defaultValue: "" })}</p> : null}
                  </div>
                  <span className="stage-count">{column.total}</span>
                </div>
                {column.isFunded && !column.code ? <p className="text-xs text-muted-foreground">{t("app.funded")}</p> : null}
                {canWrite && column.id !== 0 ? (
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="text-xs text-muted-foreground" aria-label={t("app.moveUp")} disabled={order <= 0} onClick={() => shift(column.id, -1)}>↑</button>
                    <button type="button" className="text-xs text-muted-foreground" aria-label={t("app.moveDown")} disabled={order < 0 || order >= stages.length - 1} onClick={() => shift(column.id, 1)}>↓</button>
                  </div>
                ) : null}
                <div className="mt-3 min-h-32 space-y-2">
                  {column.items.length === 0 ? <p className="text-xs text-muted-foreground">{t("pipeline.emptyColumn")}</p> : null}
                  {column.items.map((card) => (
                    <article
                      key={card.id}
                      draggable={wide && canWrite}
                      onDragStart={(event) => event.dataTransfer.setData("text/plain", String(card.id))}
                      className="min-w-0 rounded-xl border border-border bg-card p-3"
                    >
                      <a href={`/app/loans/${card.id}`} className="block break-words font-medium">{card.clientName}</a>
                      <p className="mt-1 text-sm text-muted-foreground">{t(`app.${card.purpose}`)} · {formatMoney(card.amountCents)}</p>
                      {card.address ? <p className="break-words text-xs text-muted-foreground">{card.address}</p> : null}
                      <p className="text-xs text-muted-foreground">{card.createdAt.slice(0, 10)}</p>
                      {officers.length > 0 ? <p className="break-words text-xs text-muted-foreground">{card.assigneeName || t("pipeline.unassigned")}</p> : null}
                      {!wide && canWrite ? (
                        <select
                          className="mt-2 h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm"
                          aria-label={t("app.moveStage")}
                          value={column.id || ""}
                          onChange={(event) => askMove(card, Number(event.target.value))}
                        >
                          {column.id === 0 ? <option value="">{t("pipeline.noStage")}</option> : null}
                          {columns.filter((item) => item.id !== 0).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      ) : null}
                    </article>
                  ))}
                </div>
                {column.hasMore ? (
                  <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => void dispatch(fetchLoanBoardMore({ ...filters, stageId: column.id, offset: column.items.length }))}>
                    {t("pipeline.loadMore")}
                  </Button>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
      {composer ? <NewLoanDialog open onOpenChange={setComposer} /> : null}
      <AlertDialog open={pending !== null} onOpenChange={(open) => { if (!open && !saving) setPending(null); }}>
        <AlertDialogContent className="w-[calc(100%-1.5rem)] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pipeline.moveTitle")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>{t("pipeline.moveBody", { name: pending?.card.clientName || "", from: fromName, to: toName })}</p>
                {pending && !pending.from.isFunded && pending.to.isFunded ? <p>{t("pipeline.becomesFunded")}</p> : null}
                {pending && pending.from.isFunded && !pending.to.isFunded ? <p>{t("pipeline.opensAgain")}</p> : null}
                {pending?.from.reminderOn ? <p>{t("pipeline.reminderStops", { stage: fromName })}</p> : null}
                {pending?.to.reminderOn ? <p>{t("pipeline.reminderStarts", { stage: toName })}</p> : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{t("pipeline.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={(event) => { event.preventDefault(); void confirmMove(); }}>
              {saving ? t("pipeline.moving") : t("pipeline.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
