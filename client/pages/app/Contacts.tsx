import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ContactItem } from "@shared/api";
import { roleCan } from "@shared/api";
import { DataGrid, type DataGridColumn } from "@/components/ui/data-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { convertContact, createContact, fetchContacts } from "@/store/slices/recordsSlice";
import DevFill from "@/components/dev/DevFill";
import SectionHeader from "@/components/portal/SectionHeader";
import GridTools from "@/components/portal/GridTools";
import { sampleEmail } from "@/lib/devFill";

export default function Contacts() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { contacts, contactsPagination, loading, errorKey } = useAppSelector((state) => state.records);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("created");
  const [dir, setDir] = useState<"ASC" | "DESC">("DESC");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    void dispatch(fetchContacts({ search, sort, dir, page }));
  }, [dispatch, search, sort, dir, page]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const result = await dispatch(createContact({ firstName, lastName, email, phone, company: "", kind: "person" }));
    if (createContact.fulfilled.match(result)) {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      void dispatch(fetchContacts({ search, sort, dir, page }));
    }
  }

  const columns: DataGridColumn<ContactItem>[] = [
    { key: "name", label: t("app.contacts"), sortable: true, sticky: true, render: (row) => `${row.firstName} ${row.lastName}` },
    { key: "email", label: t("app.email"), sortable: true, render: (row) => row.email || "—" },
    { key: "phone", label: t("app.phone"), render: (row) => row.phone || "—" },
    { key: "company", label: t("app.company"), sortable: true, render: (row) => row.company || "—" },
    {
      key: "status",
      label: t("command.status"),
      render: (row) => row.status === "converted" ? t("app.converted") : (
        user && roleCan(user.role, "contacts.write") && roleCan(user.role, "clients.write") ? (
          <Button type="button" variant="outline" onClick={() => void dispatch(convertContact(row.id)).then(() => dispatch(fetchContacts({ search, sort, dir, page })))}>
            {t("app.convert")}
          </Button>
        ) : row.status
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader title={t("app.contacts")} tools={<Input className="section-search" value={search} aria-label={t("command.search")} placeholder={t("command.search")} onChange={(event) => { setPage(1); setSearch(event.target.value); }} />} />
      {user && roleCan(user.role, "contacts.write") ? (
        <form className="mt-6 grid gap-3 sm:grid-cols-5" onSubmit={onCreate}>
          <DevFill className="sm:col-span-5 justify-self-start" onFill={() => {
            setFirstName("Sam");
            setLastName("Rivera");
            setEmail(sampleEmail("sam.rivera"));
            setPhone("4155550199");
          }} />
          <Input required aria-label={t("app.firstName")} placeholder={t("app.firstName")} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          <Input required aria-label={t("app.lastName")} placeholder={t("app.lastName")} value={lastName} onChange={(event) => setLastName(event.target.value)} />
          <Input aria-label={t("app.email")} placeholder={t("app.email")} value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input aria-label={t("app.phone")} placeholder={t("app.phone")} value={phone} onChange={(event) => setPhone(event.target.value)} />
          <Button type="submit">{t("app.addContact")}</Button>
        </form>
      ) : null}
      {errorKey ? <p className="mt-3 text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
      <GridTools screen="contacts" path="/api/app/contacts" filename="contacts.csv" query={{ search, sort, dir }} onApply={(next) => { setPage(1); setSearch(next.search || ""); if (next.sort) setSort(next.sort); if (next.dir) setDir(next.dir); }} />
      <div className="mt-4">
        <DataGrid
          data={contacts}
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
          pagination={contactsPagination}
          onPageChange={setPage}
          emptyMessage={t("app.emptyContacts")}
          mobileCard={(row) => (
            <article className="rounded-2xl border border-border bg-card p-4">
              <strong>{row.firstName} {row.lastName}</strong>
              <p className="text-sm text-muted-foreground">{row.phone || row.email}</p>
            </article>
          )}
        />
      </div>
    </div>
  );
}
