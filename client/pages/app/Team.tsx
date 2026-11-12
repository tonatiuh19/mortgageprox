import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { roleCan } from "@shared/api";
import type { TeamMember } from "@shared/api";
import { DataGrid, type DataGridColumn } from "@/components/ui/data-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchTeam, inviteTeammate } from "@/store/slices/workspaceSlice";
import { changeSeats, fetchBilling } from "@/store/slices/billingSlice";
import DevFill from "@/components/dev/DevFill";
import SectionHeader from "@/components/portal/SectionHeader";
import GridTools from "@/components/portal/GridTools";
import { sampleEmail } from "@/lib/devFill";
import { formatMoney } from "@/lib/format";

export default function Team() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { team, teamPagination, loading, errorKey } = useAppSelector((state) => state.workspace);
  const billing = useAppSelector((state) => state.billing);
  const [seatBusy, setSeatBusy] = useState(false);
  const canSpend = Boolean(user && roleCan(user.role, "settings.write"));
  const seats = billing.snapshot?.allowances.find((meter) => meter.key === "seats");
  const offer = billing.snapshot?.seatOffer || null;
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("loan_officer");

  useEffect(() => {
    void dispatch(fetchTeam({ search, page, sort: "name", dir: "ASC" }));
  }, [dispatch, search, page]);

  useEffect(() => {
    if (canSpend && billing.status === "idle") void dispatch(fetchBilling());
  }, [canSpend, billing.status, dispatch]);

  async function addSeat() {
    setSeatBusy(true);
    await dispatch(changeSeats("add"));
    setSeatBusy(false);
  }

  async function onInvite(event: FormEvent) {
    event.preventDefault();
    const result = await dispatch(inviteTeammate({ firstName, lastName, email, role }));
    if (inviteTeammate.fulfilled.match(result)) {
      setFirstName("");
      setLastName("");
      setEmail("");
      void dispatch(fetchTeam({ search, page, sort: "name", dir: "ASC" }));
    }
  }

  const columns: DataGridColumn<TeamMember>[] = [
    { key: "name", label: t("app.client"), sortable: true, render: (row) => `${row.firstName} ${row.lastName}` },
    { key: "email", label: t("app.email"), render: (row) => row.email },
    { key: "role", label: t("app.role"), render: (row) => t(`role.${row.role}`) },
    { key: "links", label: t("loan.links"), render: (row) => user?.tenantSlug && row.publicSlug ? <span className="break-all text-xs"><a href={`/apply/${user.tenantSlug}/${row.publicSlug}`}>{t("apply.title")}</a> · <a href={`/book/${user.tenantSlug}/${row.publicSlug}`}>{t("book.title")}</a></span> : null },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <SectionHeader title={t("app.team")} tools={<Input className="section-search" aria-label={t("command.search")} value={search} placeholder={t("command.search")} onChange={(event) => { setPage(1); setSearch(event.target.value); }} />} />
      {canSpend && offer && seats?.state === "full" ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t("billing.seatNote", { included: offer.included, extra: offer.extra, price: formatMoney(offer.priceCents) })}</p>
          <Button type="button" className="mt-3" disabled={seatBusy} onClick={() => void addSeat()}>{t("billing.addSeat", { price: formatMoney(offer.priceCents) })}</Button>
        </div>
      ) : null}
      {user && roleCan(user.role, "team.manage") ? (
        <form className="mt-6 grid gap-3 sm:grid-cols-2" onSubmit={onInvite}>
          <DevFill className="sm:col-span-2 justify-self-start" onFill={() => {
            setFirstName("Jordan");
            setLastName("Hale");
            setEmail(sampleEmail("jordan.hale"));
            setRole("loan_officer");
          }} />
          <Input required aria-label={t("app.firstName")} placeholder={t("app.firstName")} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          <Input required aria-label={t("app.lastName")} placeholder={t("app.lastName")} value={lastName} onChange={(event) => setLastName(event.target.value)} />
          <Input required type="email" aria-label={t("app.email")} placeholder={t("app.email")} value={email} onChange={(event) => setEmail(event.target.value)} />
          <select className="h-11 rounded-xl border border-input bg-background px-3" aria-label={t("app.role")} value={role} onChange={(event) => setRole(event.target.value)}>
            {["leadership", "loan_officer", "processor", "partner"].map((item) => <option key={item} value={item}>{t(`role.${item}`)}</option>)}
          </select>
          <Button type="submit" className="sm:col-span-2 sm:w-fit">{t("app.invite")}</Button>
        </form>
      ) : null}
      {errorKey ? <p className="mt-3 text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
      <GridTools screen="team" path="/api/app/team" filename="team.csv" query={{ search, sort: "name", dir: "ASC" }} onApply={(next) => { setPage(1); setSearch(next.search || ""); }} />
      <div className="mt-4">
        <DataGrid data={team} columns={columns} rowKey={(row) => row.id} isLoading={loading} pagination={teamPagination} onPageChange={setPage} emptyMessage={t("app.emptyTeam")} mobileCard={(row) => (
          <article className="rounded-2xl border border-border p-4"><strong>{row.firstName} {row.lastName}</strong><p className="text-sm text-muted-foreground">{t(`role.${row.role}`)}</p></article>
        )} />
      </div>
    </div>
  );
}
