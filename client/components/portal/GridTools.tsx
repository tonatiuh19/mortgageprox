import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { deleteFilter, exportGrid, fetchFilters, saveFilter, type SavedFilter } from "@/store/slices/workspaceSlice";

export default function GridTools({
  screen,
  path,
  filename,
  query,
  onApply,
}: {
  screen: string;
  path: string;
  filename: string;
  query: SavedFilter["query"];
  onApply: (query: SavedFilter["query"]) => void;
}) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const saved = useAppSelector((state) => state.workspace.savedFilters);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void dispatch(fetchFilters(screen));
  }, [dispatch, screen]);

  async function onExport() {
    setBusy(true);
    const result = await dispatch(exportGrid({ path, query, filename }));
    setBusy(false);
    if (!exportGrid.fulfilled.match(result)) return;
    const url = URL.createObjectURL(result.payload.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.payload.filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const result = await dispatch(saveFilter({ screen, name, query }));
    if (saveFilter.fulfilled.match(result)) {
      setName("");
      void dispatch(fetchFilters(screen));
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => void onExport()}>{t("grid.export")}</Button>
        <form className="flex min-w-0 flex-1 flex-wrap gap-2" onSubmit={onSave}>
          <Input className="max-w-xs" aria-label={t("grid.name")} placeholder={t("grid.name")} value={name} onChange={(event) => setName(event.target.value)} />
          <Button type="submit" variant="outline" disabled={name.trim().length < 2}>{t("grid.save")}</Button>
        </form>
      </div>
      {saved.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("grid.saved")}</span>
          {saved.map((item) => (
            <span key={item.id} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-sm">
              <button type="button" onClick={() => onApply(item.query)}>{item.name}</button>
              <button type="button" className="text-xs text-muted-foreground" aria-label={t("grid.remove")} onClick={() => void dispatch(deleteFilter(item.id)).then(() => dispatch(fetchFilters(screen)))}>{t("grid.remove")}</button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
