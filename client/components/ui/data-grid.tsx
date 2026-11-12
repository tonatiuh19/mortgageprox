import type { ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PaginationInfo } from "@shared/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface DataGridColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  sticky?: boolean;
  shrink?: boolean;
  wrap?: boolean;
  render?: (item: T, index: number) => ReactNode;
}

interface DataGridProps<T> {
  data: T[];
  columns: DataGridColumn<T>[];
  rowKey: (item: T) => string | number;
  sortBy?: string;
  sortDir?: "ASC" | "DESC";
  onSort?: (key: string) => void;
  pagination?: PaginationInfo | null;
  onPageChange?: (page: number) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  mobileCard?: (item: T) => ReactNode;
  onRowClick?: (item: T) => void;
}

function stickyClasses(isSticky: boolean, bg = "bg-card") {
  return isSticky ? `sticky left-0 z-10 ${bg} shadow-[1px_0_0_0_hsl(var(--border))]` : "";
}

export function DataGrid<T>({
  data,
  columns,
  rowKey,
  sortBy = "",
  sortDir = "ASC",
  onSort,
  pagination,
  onPageChange,
  isLoading = false,
  emptyMessage,
  mobileCard,
  onRowClick,
}: DataGridProps<T>) {
  const { t } = useTranslation();
  const empty = emptyMessage || t("grid.empty");
  const footer = pagination && pagination.totalPages > 1 && (
    <div className="mt-4 flex items-center justify-between gap-3 px-1 text-sm text-muted-foreground">
      <span className="min-w-0">
        {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} / {pagination.total}
      </span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" aria-label={t("grid.previous")} disabled={pagination.page <= 1} onClick={() => onPageChange?.(pagination.page - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-xs tabular-nums">{pagination.page}/{pagination.totalPages}</span>
        <Button type="button" variant="outline" size="sm" aria-label={t("grid.next")} disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange?.(pagination.page + 1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="table-scroll">
        <Table className="w-max min-w-full">
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}><Skeleton className="h-3 w-16" /></TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                {columns.map((col) => (
                  <TableCell key={col.key}><Skeleton className="h-4 w-24" /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (data.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>;

  return (
    <>
      {mobileCard ? (
        <div className="block space-y-3 sm:hidden">
          {data.map((item) => (
            <div key={rowKey(item)}>{mobileCard(item)}</div>
          ))}
        </div>
      ) : null}
      <div className={cn("table-scroll", mobileCard && "hidden sm:block")}>
        <Table className="w-max min-w-full">
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={cn("whitespace-nowrap", col.shrink && "w-px", col.sticky && stickyClasses(true), col.className, col.headerClassName)}>
                  {col.sortable && onSort ? (
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => onSort(col.key)}>
                      {col.label}
                      {sortBy !== col.key ? <ChevronsUpDown className="size-3 opacity-40" /> : sortDir === "ASC" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                    </button>
                  ) : col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow key={rowKey(item)} className={onRowClick ? "cursor-pointer" : undefined} onClick={onRowClick ? () => onRowClick(item) : undefined}>
                {columns.map((col) => (
                  <TableCell key={col.key} className={cn(!col.wrap && "whitespace-nowrap", col.wrap && "max-w-[240px]", col.sticky && stickyClasses(true), col.className)}>
                    {col.render ? col.render(item, index) : String((item as Record<string, unknown>)[col.key] ?? "—")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {footer}
    </>
  );
}
