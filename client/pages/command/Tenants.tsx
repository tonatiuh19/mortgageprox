import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TenantListItem } from "@shared/api";
import { DataGrid, type DataGridColumn } from "@/components/ui/data-grid";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchTenants } from "@/store/slices/commandSlice";

export default function Tenants() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { tenants, pagination, loading } = useAppSelector((state) => state.command);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("created");
  const [dir, setDir] = useState<"ASC" | "DESC">("DESC");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void dispatch(fetchTenants({ search, status, sort, dir, page }));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [dispatch, search, status, sort, dir, page]);

  const columns: DataGridColumn<TenantListItem>[] = [
    { key: "name", label: t("command.name"), sortable: true, sticky: true, render: (row) => row.name },
    { key: "status", label: t("command.status"), sortable: true, render: (row) => t(`command.${row.status}`, { defaultValue: row.status }) },
    { key: "plan", label: t("command.plan"), render: (row) => (row.planNameKey ? t(row.planNameKey) : "—") },
    { key: "owner", label: t("command.owner"), render: (row) => row.ownerEmail || "—" },
    { key: "modules", label: t("command.modules"), render: (row) => String(row.moduleCount) },
    { key: "created", label: t("command.created"), sortable: true, render: (row) => row.createdAt.slice(0, 10) },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-4xl">{t("command.tenants")}</h1>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder={t("command.search")} aria-label={t("command.search")} />
        <select className="h-11 rounded-xl border border-input bg-background px-3" value={status} aria-label={t("command.status")} onChange={(event) => { setPage(1); setStatus(event.target.value); }}>
          <option value="">{t("command.allStatuses")}</option>
          <option value="trial">{t("command.trial")}</option>
          <option value="active">{t("command.active")}</option>
          <option value="suspended">{t("command.suspended")}</option>
        </select>
      </div>
      <div className="mt-4 rounded-2xl border border-border bg-card p-3 sm:p-4">
        <DataGrid
          data={tenants}
          columns={columns}
          rowKey={(row) => row.id}
          sortBy={sort}
          sortDir={dir}
          onSort={(key) => {
            setDir(sort === key && dir === "ASC" ? "DESC" : "ASC");
            setSort(key);
          }}
          pagination={pagination}
          onPageChange={setPage}
          isLoading={loading}
          emptyMessage={t("command.empty")}
          onRowClick={(row) => navigate(`/command/tenants/${row.id}`)}
          mobileCard={(row) => (
            <button type="button" className="w-full rounded-2xl border border-border bg-card p-4 text-left" onClick={() => navigate(`/command/tenants/${row.id}`)}>
              <strong>{row.name}</strong>
              <span className="mt-1 block text-sm text-muted-foreground">{row.ownerEmail}</span>
              <span className="mt-2 block text-xs">{t(`command.${row.status}`, { defaultValue: row.status })}</span>
            </button>
          )}
        />
      </div>
    </div>
  );
}
