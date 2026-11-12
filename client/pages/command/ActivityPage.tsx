import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ActivityItem } from "@shared/api";
import { DataGrid, type DataGridColumn } from "@/components/ui/data-grid";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchActivity } from "@/store/slices/commandSlice";

export default function ActivityPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { activity, activityPagination, loading } = useAppSelector((state) => state.command);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    void dispatch(fetchActivity({ search, page, sort: "created", dir: "DESC" }));
  }, [dispatch, search, page]);

  const columns: DataGridColumn<ActivityItem>[] = [
    { key: "created", label: t("command.created"), render: (row) => row.createdAt.slice(0, 16).replace("T", " ") },
    { key: "tenant", label: t("command.name"), render: (row) => row.tenantName || "—" },
    { key: "summary", label: t("command.activity"), wrap: true, render: (row) => row.summary },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-4xl">{t("command.activity")}</h1>
      <Input className="mt-6" value={search} aria-label={t("command.search")} placeholder={t("command.search")} onChange={(event) => { setPage(1); setSearch(event.target.value); }} />
      <div className="mt-4">
        <DataGrid
          data={activity}
          columns={columns}
          rowKey={(row) => row.id}
          isLoading={loading}
          pagination={activityPagination}
          onPageChange={setPage}
          mobileCard={(row) => (
            <article className="rounded-2xl border border-border bg-card p-4">
              <strong>{row.tenantName || row.action}</strong>
              <p className="mt-1 text-sm text-muted-foreground">{row.summary}</p>
            </article>
          )}
        />
      </div>
    </div>
  );
}
