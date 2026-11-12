import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import PortalShell from "@/components/portal/PortalShell";
import PageSkeleton from "@/components/portal/PageSkeleton";
import SectionHeader from "@/components/portal/SectionHeader";
import { LayoutDashboard } from "lucide-react";
import { CreditForm } from "@/pages/app/Credit";
import { formatMoney } from "@/lib/format";
import { useAppDispatch } from "@/store/hooks";
import { fetchPortalHome, finishPortalTask, savePortalProfile, uploadPortalDocument } from "@/store/slices/workspaceSlice";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { monthlyPi } from "@shared/loan-calc-engine";

export function BorrowerLayout() {
  return (
    <PortalShell
      loginPath="/login"
      titleKey="app.borrowerTitle"
      homePath="/portal"
      tabs={["/portal"]}
      nav={[{ to: "/portal", end: true, labelKey: "app.borrowerTitle", icon: LayoutDashboard }]}
      legalLinks
    />
  );
}

type Task = { id: number; loanId: number; title: string; status: string; column?: string; note?: string };
type Profile = { firstName: string; lastName: string; phone: string; addressLine: string; city: string; region: string; postalCode: string };
type Home = {
  loans: { id: number; purpose: string; amountCents: number; status: string; stage: string }[];
  tasks: Task[];
  documents: { id: number; loanId: number; name: string; status: string }[];
  profile: Profile | null;
};

const emptyProfile: Profile = { firstName: "", lastName: "", phone: "", addressLine: "", city: "", region: "", postalCode: "" };

function progress(tasks: Task[], loanId: number) {
  const mine = tasks.filter((task) => task.loanId === loanId);
  if (!mine.length) return 0;
  return Math.round((mine.filter((task) => task.status === "done").length / mine.length) * 100);
}

export function BorrowerHome() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [home, setHome] = useState<Home | null>(null);
  const [principal, setPrincipal] = useState("400000");
  const [rate, setRate] = useState("6.5");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [profile, setProfile] = useState<Profile>(emptyProfile);

  function refresh() {
    void dispatch(fetchPortalHome()).then((result) => {
      if (!fetchPortalHome.fulfilled.match(result)) return;
      setHome(result.payload);
      if (result.payload.profile) setProfile(result.payload.profile);
    });
  }

  useEffect(() => {
    void dispatch(fetchPortalHome()).then((result) => {
      if (fetchPortalHome.fulfilled.match(result)) {
        setHome(result.payload);
        if (result.payload.profile) setProfile(result.payload.profile);
      } else setHome({ loans: [], tasks: [], documents: [], profile: null });
    });
  }, [dispatch]);

  async function onProfile(event: FormEvent) {
    event.preventDefault();
    const result = await dispatch(savePortalProfile(profile));
    if (savePortalProfile.fulfilled.match(result)) refresh();
  }

  if (!home) return <PageSkeleton cards={2} lines={3} label={t("app.loading")} />;

  return (
    <div className="portal-rise mx-auto max-w-3xl space-y-6">
      <SectionHeader title={t("app.borrowerTitle")} meta={t("portal.lead")} />
      <section>
        <h2 className="font-display text-2xl">{t("loan.profile")}</h2>
        <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={onProfile}>
          <Input aria-label={t("app.firstName")} placeholder={t("app.firstName")} value={profile.firstName} onChange={(event) => setProfile({ ...profile, firstName: event.target.value })} required />
          <Input aria-label={t("app.lastName")} placeholder={t("app.lastName")} value={profile.lastName} onChange={(event) => setProfile({ ...profile, lastName: event.target.value })} required />
          <Input aria-label={t("app.phone")} placeholder={t("app.phone")} value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} />
          <Input aria-label={t("loan.address")} placeholder={t("loan.address")} value={profile.addressLine} onChange={(event) => setProfile({ ...profile, addressLine: event.target.value })} />
          <Input aria-label={t("loan.city")} placeholder={t("loan.city")} value={profile.city} onChange={(event) => setProfile({ ...profile, city: event.target.value })} />
          <Input aria-label={t("loan.region")} placeholder={t("loan.region")} value={profile.region} onChange={(event) => setProfile({ ...profile, region: event.target.value })} />
          <Input aria-label={t("loan.postal")} placeholder={t("loan.postal")} value={profile.postalCode} onChange={(event) => setProfile({ ...profile, postalCode: event.target.value })} />
          <Button type="submit" className="justify-self-start">{t("app.save")}</Button>
        </form>
      </section>
      <section>
        <h2 className="font-display text-2xl">{t("portal.loans")}</h2>
        <ul className="mt-3 space-y-2">
          {home.loans.map((loan) => {
            const width = progress(home.tasks, loan.id);
            const mine = home.tasks.filter((task) => task.loanId === loan.id);
            const done = mine.filter((task) => task.status === "done").length;
            return (
              <li key={loan.id} className="rounded-2xl border border-border bg-card p-4">
                <strong>{t(`app.${loan.purpose}`)} · {formatMoney(loan.amountCents)}</strong>
                <p className="text-sm text-muted-foreground">{loan.stage || loan.status}</p>
                <p className="mt-2 text-xs text-muted-foreground">{t("loan.progress", { done, total: mine.length })}</p>
                <div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${width}%` }} /></div>
              </li>
            );
          })}
        </ul>
        {!home.loans.length ? <p className="mt-3 text-sm text-muted-foreground">{t("app.borrowerEmpty")}</p> : null}
      </section>
      <section>
        <h2 className="font-display text-2xl">{t("portal.tasks")}</h2>
        <ul className="mt-3 space-y-2">
          {home.tasks.map((task) => (
            <li key={task.id} className="rounded-2xl border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{task.title}</span>
                <span className="text-xs text-muted-foreground">{task.status === "done" ? t("loan.done") : task.column === "doing" ? t("loan.startTask") : ""}</span>
              </div>
              {task.note ? <p className="mt-1 text-muted-foreground">{task.note}</p> : null}
              {task.status !== "done" ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <Input aria-label={t("loan.taskNote")} placeholder={t("loan.taskNote")} value={notes[task.id] || ""} onChange={(event) => setNotes({ ...notes, [task.id]: event.target.value })} />
                  <Button type="button" variant="outline" onClick={() => void dispatch(finishPortalTask({ id: task.id, status: "doing" })).then(refresh)}>{t("loan.startTask")}</Button>
                  <Button type="button" variant="outline" onClick={() => void dispatch(finishPortalTask({ id: task.id, status: "done", note: notes[task.id] || "" })).then(refresh)}>{t("loan.done")}</Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {!home.tasks.length ? <p className="mt-3 text-sm text-muted-foreground">{t("grid.empty")}</p> : null}
      </section>
      <section>
        <h2 className="font-display text-2xl">{t("app.documents")}</h2>
        <ul className="mt-3 space-y-2">
          {home.documents.map((item) => <li key={item.id} className="rounded-2xl border border-border p-3 text-sm">{item.name} · {item.status}</li>)}
        </ul>
        {!home.documents.length ? <p className="mt-3 text-sm text-muted-foreground">{t("grid.empty")}</p> : null}
        {home.loans[0] ? (
          <Input className="mt-3" aria-label={t("loan.file")} type="file" onChange={(event) => {
            const picked = event.target.files?.[0];
            const loanId = home.loans[0]?.id;
            if (!picked || !loanId) return;
            const reader = new FileReader();
            reader.onload = () => {
              void dispatch(uploadPortalDocument({ loanId, name: picked.name, fileName: picked.name, fileBase64: String(reader.result || "") })).then(refresh);
            };
            reader.readAsDataURL(picked);
          }} />
        ) : null}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Input aria-label={t("app.principal")} value={principal} onChange={(event) => setPrincipal(event.target.value)} />
          <Input aria-label={t("app.rate")} value={rate} onChange={(event) => setRate(event.target.value)} />
          <p className="text-sm sm:col-span-2">{t("loan.estimate", { amount: formatMoney(Math.round(monthlyPi(Number(principal) || 0, Number(rate) || 0, 30) * 100)) })}</p>
        </div>
      </section>
      <section>
        <h2 className="font-display text-2xl">{t("modules.credit.name")}</h2>
        <div className="mt-4"><CreditForm portal /></div>
      </section>
    </div>
  );
}
