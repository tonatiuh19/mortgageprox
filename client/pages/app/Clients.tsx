import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ClientListItem } from "@shared/api";
import { DataGrid, type DataGridColumn } from "@/components/ui/data-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { roleCan } from "@shared/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { createClient, downloadClientTemplate, fetchClients, importClients } from "@/store/slices/workspaceSlice";
import DevFill from "@/components/dev/DevFill";
import SectionHeader from "@/components/portal/SectionHeader";
import GridTools from "@/components/portal/GridTools";
import { sampleEmail } from "@/lib/devFill";

export default function Clients() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { clients, clientsPagination, loading, errorKey } = useAppSelector((state) => state.workspace);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("created");
  const [dir, setDir] = useState<"ASC" | "DESC">("DESC");
  const [page, setPage] = useState(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [importText, setImportText] = useState("");
  const [imported, setImported] = useState<number | null>(null);
  const sources = ["current_client_referral", "past_client", "past_client_referral", "personal_friend", "realtor", "advertisement", "business_partner", "builder", "other"];

  useEffect(() => {
    void dispatch(fetchClients({ search, sort, dir, page }));
  }, [dispatch, search, sort, dir, page]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const result = await dispatch(createClient({ firstName, lastName, email, phone: "", source: "" }));
    if (createClient.fulfilled.match(result)) {
      setFirstName("");
      setLastName("");
      setEmail("");
      void dispatch(fetchClients({ search, sort, dir, page }));
    }
  }

  const columns: DataGridColumn<ClientListItem>[] = [
    { key: "name", label: t("app.client"), sortable: true, sticky: true, render: (row) => <a href={`/app/clients/${row.id}`}>{row.firstName} {row.lastName}</a> },
    { key: "email", label: t("app.email"), sortable: true, render: (row) => row.email || "—" },
    { key: "status", label: t("command.status"), sortable: true, render: (row) => row.status },
    { key: "created", label: t("command.created"), sortable: true, render: (row) => row.createdAt.slice(0, 10) },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader title={t("app.clients")} tools={<Input className="section-search" value={search} aria-label={t("command.search")} placeholder={t("command.search")} onChange={(event) => { setPage(1); setSearch(event.target.value); }} />} />
      {user && roleCan(user.role, "clients.write") ? (
        <form className="mt-6 grid gap-3 sm:grid-cols-4" onSubmit={onCreate}>
          <DevFill className="sm:col-span-4 justify-self-start" onFill={() => {
            setFirstName("James");
            setLastName("Okafor");
            setEmail(sampleEmail("james.okafor"));
          }} />
          <Input required aria-label={t("app.firstName")} placeholder={t("app.firstName")} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          <Input required aria-label={t("app.lastName")} placeholder={t("app.lastName")} value={lastName} onChange={(event) => setLastName(event.target.value)} />
          <Input aria-label={t("app.email")} placeholder={t("app.email")} value={email} onChange={(event) => setEmail(event.target.value)} />
          <Button type="submit">{t("app.addClient")}</Button>
        </form>
      ) : null}
      <details className="mt-6 rounded-2xl border border-border bg-card p-4">
        <summary className="cursor-pointer font-medium">{t("loan.import")}</summary>
        <p className="mt-2 text-sm text-muted-foreground">{t("loan.importLead")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void dispatch(downloadClientTemplate()).then((result) => {
            if (!downloadClientTemplate.fulfilled.match(result)) return;
            const url = URL.createObjectURL(result.payload);
            const link = document.createElement("a");
            link.href = url;
            link.download = "clients-template.csv";
            link.click();
            URL.revokeObjectURL(url);
          })}>{t("loan.template")}</Button>
        </div>
        <textarea className="mt-3 min-h-28 w-full rounded-xl border border-input bg-background p-3 text-sm" aria-label={t("loan.import")} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="first_name,last_name,email,phone,lead_source" />
        <Button type="button" className="mt-3" onClick={() => {
          const rows = importText.split(/\r?\n/).slice(1).map((line) => {
            const [firstName = "", lastName = "", email = "", phone = "", source = ""] = line.split(",").map((part) => part.trim());
            return { firstName, lastName, email, phone, source };
          }).filter((row) => row.firstName && row.lastName && sources.includes(row.source));
          void dispatch(importClients(rows)).then((result) => {
            if (importClients.fulfilled.match(result)) {
              setImported(result.payload);
              setImportText("");
              void dispatch(fetchClients({ search, sort, dir, page }));
            }
          });
        }}>{t("loan.importRun")}</Button>
        {imported != null ? <p className="mt-2 text-sm text-muted-foreground">{t("loan.imported", { count: imported })}</p> : null}
      </details>
      {errorKey ? <p className="mt-3 text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
      <GridTools screen="clients" path="/api/app/clients" filename="clients.csv" query={{ search, sort, dir }} onApply={(next) => { setPage(1); setSearch(next.search || ""); if (next.sort) setSort(next.sort); if (next.dir) setDir(next.dir); }} />
      <div className="mt-4">
        <DataGrid
          data={clients}
          columns={columns}
          rowKey={(row) => row.id}
          isLoading={loading}
          sortBy={sort}
          sortDir={dir}
          onSort={(key) => {
            const next = key === "name" ? "name" : key;
            setDir(sort === next && dir === "ASC" ? "DESC" : "ASC");
            setSort(next);
          }}
          pagination={clientsPagination}
          onPageChange={setPage}
          emptyMessage={t("app.emptyClients")}
          mobileCard={(row) => (
            <article className="rounded-2xl border border-border bg-card p-4">
              <strong>{row.firstName} {row.lastName}</strong>
              <p className="text-sm text-muted-foreground">{row.email}</p>
            </article>
          )}
        />
      </div>
    </div>
  );
}
