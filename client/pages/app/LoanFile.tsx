import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PageSkeleton from "@/components/portal/PageSkeleton";
import SectionHeader from "@/components/portal/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addLoanTask, bulkLoanTasks, downloadLoanFile, fetchLoanFile, logLoanCall, removeLoanTask, saveLoanFile } from "@/store/slices/workspaceSlice";

type Task = { id: number; title: string; detail: string; category: string; status: string; priority: string; dueOn: string };
type Loan = {
  id: number;
  purpose: string;
  amountCents: number;
  propertyValueCents: number;
  downPaymentCents: number;
  ltv: number | null;
  propertyType: string;
  addressLine: string;
  city: string;
  region: string;
  postalCode: string;
  applicationOn: string;
  submittedOn: string;
  estCloseOn: string;
  updatedAt: string;
  createdAt: string;
  status: string;
  stageId: number | null;
  stageName: string;
  client: { id: number; firstName: string; lastName: string; email: string; phone: string };
  bankerId: number | null;
  bankerName: string;
  partnerId: number | null;
  partnerName: string;
  realtorId: number | null;
  letter: { amountCents: number; maxCents: number; expiresOn: string; active: boolean; held: boolean };
  tasks: Task[];
  documents: { id: number; name: string; status: string }[];
  compliance: { id: number; code: string; label: string; status: string }[];
};

const TYPES = ["single_family", "condo", "townhouse", "multi", "manufactured", "other"];
const dollars = (cents: number) => (cents / 100).toFixed(2);
const cents = (value: string) => Math.round((Number(value.replace(/[^0-9.]/g, "")) || 0) * 100);

export default function LoanFile() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const dispatch = useAppDispatch();
  const role = useAppSelector((state) => state.auth.user?.role);
  const [callNote, setCallNote] = useState("");
  const [loan, setLoan] = useState<Loan | null>(null);
  const [canMove, setCanMove] = useState(false);
  const [people, setPeople] = useState<{ id: number; name: string; role: string }[]>([]);
  const [stages, setStages] = useState<{ id: number; name: string }[]>([]);
  const [realtors, setRealtors] = useState<{ id: number; name: string }[]>([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});

  function load() {
    void dispatch(fetchLoanFile(Number(id))).then((result) => {
      if (!fetchLoanFile.fulfilled.match(result)) {
        setError(String(result.payload || "errors.server"));
        return;
      }
      const next = result.payload.loan as unknown as Loan;
      setLoan(next);
      setCanMove(result.payload.canMove);
      setPeople(result.payload.people);
      setStages(result.payload.stages);
      setRealtors(result.payload.realtors);
      setForm({
        amount: dollars(next.amountCents),
        value: dollars(next.propertyValueCents),
        down: dollars(next.downPaymentCents),
        propertyType: next.propertyType,
        addressLine: next.addressLine,
        city: next.city,
        region: next.region,
        postalCode: next.postalCode,
        applicationOn: next.applicationOn,
        submittedOn: next.submittedOn,
        estCloseOn: next.estCloseOn,
        bankerId: next.bankerId ? String(next.bankerId) : "",
        partnerId: next.partnerId ? String(next.partnerId) : "",
        realtorId: next.realtorId ? String(next.realtorId) : "",
        stageId: next.stageId ? String(next.stageId) : "",
        preapproval: dollars(next.letter.amountCents),
        preapprovalMax: dollars(next.letter.maxCents),
        preapprovalExpiresOn: next.letter.expiresOn,
        letterActive: next.letter.active ? "1" : "",
      });
    });
  }

  useEffect(() => { load(); }, [id]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    setError("");
    const result = await dispatch(saveLoanFile({
      id: Number(id),
      patch: {
        amountCents: cents(form.amount || "0"),
        propertyValueCents: cents(form.value || "0"),
        downPaymentCents: cents(form.down || "0"),
        propertyType: form.propertyType,
        addressLine: form.addressLine,
        city: form.city,
        region: form.region,
        postalCode: form.postalCode,
        applicationOn: form.applicationOn,
        submittedOn: form.submittedOn,
        estCloseOn: form.estCloseOn,
        bankerId: Number(form.bankerId) || null,
        partnerId: Number(form.partnerId) || null,
        realtorId: Number(form.realtorId) || null,
        stageId: Number(form.stageId) || null,
        preapprovalCents: cents(form.preapproval || "0"),
        preapprovalMaxCents: cents(form.preapprovalMax || "0"),
        preapprovalExpiresOn: form.preapprovalExpiresOn,
        letterActive: form.letterActive === "1",
      },
    }));
    if (saveLoanFile.fulfilled.match(result)) {
      setSaved(true);
      load();
    } else setError(String(result.payload || "errors.server"));
  }

  async function download(kind: "mismo" | "packet") {
    const result = await dispatch(downloadLoanFile({ id: Number(id), kind }));
    if (!downloadLoanFile.fulfilled.match(result)) return;
    const url = URL.createObjectURL(result.payload.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.payload.filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function onTask() {
    const result = await dispatch(addLoanTask({ loanId: Number(id), title, detail, category: "document", priority: "normal", dueAt: "" }));
    if (addLoanTask.fulfilled.match(result)) {
      setTitle("");
      setDetail("");
      load();
    }
  }

  if (!loan && !error) return <PageSkeleton cards={3} lines={4} label={t("app.loading")} />;
  if (!loan) return <p className="text-sm text-destructive">{t(error.startsWith("errors.") ? error : `errors.${error}`)}</p>;

  const bankers = people.filter((person) => person.role !== "partner");
  const partners = people.filter((person) => person.role === "partner");
  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <form className="portal-rise mx-auto min-w-0 max-w-5xl space-y-4" onSubmit={onSave}>
      <SectionHeader
        title={`${loan.client.firstName} ${loan.client.lastName}`}
        meta={loan.stageName}
        tools={(
          <>
            <Button type="button" variant="outline" onClick={() => void download("mismo")}>{t("loan.mismo")}</Button>
            <Button type="button" variant="outline" asChild><Link to={`/app/calculators?loanId=${loan.id}`}>{t("loan.calculator")}</Link></Button>
            <Button type="button" variant="outline" asChild><Link to={`/app/loans/${loan.id}/letter`}>{t("loan.letter")}</Link></Button>
            <Button type="button" variant="outline" asChild><Link to={`/app/phone?loanId=${loan.id}&clientId=${loan.client.id}`}>{t("loan.call")}</Link></Button>
          </>
        )}
      />
      {loan.letter.active ? (
        <p className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          {t("loan.letterActive", { amount: formatMoney(loan.letter.amountCents), max: formatMoney(loan.letter.maxCents), date: loan.letter.expiresOn || t("loan.noDate") })}
        </p>
      ) : null}
      {loan.letter.held ? <p className="text-sm text-muted-foreground">{t("errors.letters.hold")}</p> : null}
      <div className="flex min-w-0 flex-wrap gap-2">
        <Input className="min-w-0 flex-1" aria-label={t("loan.callNote")} placeholder={t("loan.callNote")} value={callNote} onChange={(event) => setCallNote(event.target.value)} />
        <Button type="button" variant="outline" onClick={() => void dispatch(logLoanCall({ clientId: loan.client.id, loanId: loan.id, body: callNote || t("loan.call"), transcript: callNote }))}>{t("loan.logCall")}</Button>
      </div>
      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3">
        <label className="text-sm">{t("loan.amount")}<Input className="mt-1" value={form.amount || ""} onChange={(event) => set("amount", event.target.value)} /></label>
        <label className="text-sm">{t("loan.value")}<Input className="mt-1" value={form.value || ""} onChange={(event) => set("value", event.target.value)} /></label>
        <label className="text-sm">{t("loan.down")}<Input className="mt-1" value={form.down || ""} onChange={(event) => set("down", event.target.value)} /></label>
        <p className="text-sm text-muted-foreground sm:col-span-3">{t("loan.ltv", { value: loan.ltv ?? 0 })} · {t(`app.${loan.purpose}`)}</p>
        <select className="h-11 rounded-xl border border-input bg-background px-3" aria-label={t("loan.propertyType")} value={form.propertyType || ""} onChange={(event) => set("propertyType", event.target.value)}>
          {TYPES.map((type) => <option key={type} value={type}>{t(`property.${type}`)}</option>)}
        </select>
        <Input aria-label={t("app.address")} placeholder={t("app.address")} value={form.addressLine || ""} onChange={(event) => set("addressLine", event.target.value)} />
        <Input aria-label={t("app.city")} placeholder={t("app.city")} value={form.city || ""} onChange={(event) => set("city", event.target.value)} />
        <Input aria-label={t("app.region")} placeholder={t("app.region")} value={form.region || ""} onChange={(event) => set("region", event.target.value)} />
        <Input aria-label={t("app.postal")} placeholder={t("app.postal")} value={form.postalCode || ""} onChange={(event) => set("postalCode", event.target.value)} />
        <Input type="date" aria-label={t("loan.applied")} value={form.applicationOn || ""} onChange={(event) => set("applicationOn", event.target.value)} />
        <Input type="date" aria-label={t("loan.submitted")} value={form.submittedOn || ""} onChange={(event) => set("submittedOn", event.target.value)} />
        <Input type="date" aria-label={t("loan.close")} value={form.estCloseOn || ""} onChange={(event) => set("estCloseOn", event.target.value)} />
        <p className="text-sm text-muted-foreground sm:col-span-3">{loan.client.email} {loan.client.phone}</p>
      </section>
      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
        <label className="text-sm">{t("loan.banker")}
          <select className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3" value={form.bankerId || ""} onChange={(event) => set("bankerId", event.target.value)}>
            <option value="">{t("pipeline.unassigned")}</option>
            {bankers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </label>
        <label className="text-sm">{t("loan.partner")}
          <select className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3" value={form.partnerId || ""} onChange={(event) => set("partnerId", event.target.value)}>
            <option value="">{t("loan.noPartner")}</option>
            {partners.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </label>
        <label className="text-sm">{t("loan.realtor")}
          <select className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3" value={form.realtorId || ""} onChange={(event) => set("realtorId", event.target.value)}>
            <option value="">{t("pipeline.unassigned")}</option>
            {realtors.map((realtor) => <option key={realtor.id} value={realtor.id}>{realtor.name}</option>)}
          </select>
        </label>
        <label className="text-sm">{t("loan.stage")}
          <select className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3" disabled={!canMove} value={form.stageId || ""} onChange={(event) => set("stageId", event.target.value)}>
            {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
          </select>
          {canMove ? null : <span className="mt-1 block text-xs text-muted-foreground">{t("errors.loan.banker")}</span>}
        </label>
      </section>
      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3">
        <label className="text-sm">{t("loan.letterAmount")}<Input className="mt-1" value={form.preapproval || ""} onChange={(event) => set("preapproval", event.target.value)} /></label>
        <label className="text-sm">{t("loan.letterMax")}<Input className="mt-1" value={form.preapprovalMax || ""} onChange={(event) => set("preapprovalMax", event.target.value)} /></label>
        <label className="text-sm">{t("loan.letterExpires")}<Input className="mt-1" type="date" value={form.preapprovalExpiresOn || ""} onChange={(event) => set("preapprovalExpiresOn", event.target.value)} /></label>
        {role === "partner" ? null : <label className="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" checked={form.letterActive === "1"} onChange={(event) => set("letterActive", event.target.checked ? "1" : "")} />{t("loan.letterOn")}</label>}
      </section>
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl">{t("loan.checklist")}</h2>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void download("packet")}>{t("loan.packet")}</Button>
            <Button type="button" variant="outline" disabled={!picked.length} onClick={() => void dispatch(bulkLoanTasks(picked)).then(() => { setPicked([]); load(); })}>{t("loan.bulkDone")}</Button>
          </div>
        </div>
        <ul className="mt-4 space-y-3">
          {loan.tasks.map((task) => (
            <li key={task.id} className="rounded-2xl border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={picked.includes(task.id)} onChange={(event) => setPicked((current) => event.target.checked ? [...current, task.id] : current.filter((item) => item !== task.id))} />
                  <span><strong>{task.title}</strong>{task.detail ? <span className="mt-1 block text-sm text-muted-foreground">{task.detail}</span> : null}</span>
                </label>
                <span className="text-xs text-muted-foreground">{t(`tasks.priority.${task.priority}`, { defaultValue: task.priority })} · {task.status}</span>
              </div>
              <button type="button" className="mt-2 text-xs text-destructive" onClick={() => void dispatch(removeLoanTask(task.id)).then(() => load())}>{t("grid.remove")}</button>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input aria-label={t("loan.task")} placeholder={t("loan.task")} value={title} onChange={(event) => setTitle(event.target.value)} />
          <Input aria-label={t("loan.taskDetail")} placeholder={t("loan.taskDetail")} value={detail} onChange={(event) => setDetail(event.target.value)} />
          <Button type="button" variant="outline" onClick={() => void onTask()}>{t("loan.addTask")}</Button>
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl">{t("app.documents")}</h2>
          <Button type="button" variant="outline" asChild><Link to={`/app/documents?loanId=${loan.id}`}>{t("loan.openDocuments")}</Link></Button>
        </div>
        <ul className="mt-3 space-y-2">{loan.documents.map((item) => <li key={item.id} className="text-sm">{item.name} · {item.status}</li>)}</ul>
        {!loan.documents.length ? <p className="mt-2 text-sm text-muted-foreground">{t("grid.empty")}</p> : null}
      </section>
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl">{t("modules.compliance.name")}</h2>
          <Button type="button" variant="outline" asChild><Link to={`/app/compliance?loanId=${loan.id}`}>{t("loan.openCompliance")}</Link></Button>
        </div>
        <ul className="mt-3 space-y-2">{loan.compliance.map((item) => <li key={item.id} className="text-sm">{item.label} · {item.status}</li>)}</ul>
      </section>
      {error ? <p className="text-sm text-destructive">{t(error.startsWith("errors.") ? error : `errors.${error}`)}</p> : null}
      {saved ? <p className="text-sm text-muted-foreground">{t("command.saved")}</p> : null}
      <Button type="submit">{t("app.save")}</Button>
    </form>
  );
}
