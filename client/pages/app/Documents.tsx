import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SectionHeader from "@/components/portal/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchDocuments, saveDocument } from "@/store/slices/recordsSlice";
import DevFill from "@/components/dev/DevFill";

const STATUSES = ["needed", "received", "reviewed", "waived"] as const;

export default function Documents() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const documents = useAppSelector((state) => state.records.documents);
  const errorKey = useAppSelector((state) => state.records.errorKey);
  const [params] = useSearchParams();
  const [loanId, setLoanId] = useState(params.get("loanId") || "");
  const [name, setName] = useState("");
  const [file, setFile] = useState("");
  const [fileName, setFileName] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [sort, setSort] = useState("id");

  useEffect(() => {
    void dispatch(fetchDocuments({ loanId: Number(loanId) || 0, sort, dir: sort === "id" ? "desc" : "asc" }));
  }, [dispatch, loanId, sort]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const result = await dispatch(saveDocument({ name, loanId: Number(loanId), fileBase64: file, fileName }));
    if (saveDocument.fulfilled.match(result)) {
      setName("");
      setFile("");
      setFileName("");
      void dispatch(fetchDocuments({ loanId: Number(loanId) || 0, sort, dir: sort === "id" ? "desc" : "asc" }));
    }
  }

  return (
    <div className="portal-rise mx-auto max-w-3xl">
      <SectionHeader title={t("app.documents")} />
      <form className="mt-6 grid gap-3 sm:grid-cols-3" onSubmit={onCreate}>
        <DevFill className="sm:col-span-3 justify-self-start" onFill={() => setName("Driver license")} />
        <Input required aria-label={t("app.loanId")} placeholder={t("app.loanId")} value={loanId} onChange={(event) => setLoanId(event.target.value)} />
        <Input required aria-label={t("app.documents")} placeholder={t("app.documents")} value={name} onChange={(event) => setName(event.target.value)} />
        <Input aria-label={t("loan.file")} type="file" onChange={(event) => {
          const pickedFile = event.target.files?.[0];
          if (!pickedFile) return;
          setFileName(pickedFile.name);
          const reader = new FileReader();
          reader.onload = () => setFile(String(reader.result || ""));
          reader.readAsDataURL(pickedFile);
        }} />
        <Button type="submit">{t("app.addDocument")}</Button>
        <select className="h-11 rounded-xl border border-input bg-background px-3" aria-label={t("loan.sort")} value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="id">{t("loan.recent")}</option>
          <option value="name">{t("loan.sortName")}</option>
          <option value="status">{t("loan.sortStatus")}</option>
        </select>
      </form>
      {loanId ? <p className="mt-3"><a className="text-sm underline" href={`/api/app/documents?loanId=${loanId}&zip=1&ids=${picked.join(",")}`}>{t("loan.zip")}</a></p> : null}
      {errorKey ? <p className="mt-3 text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
      <ul className="mt-6 space-y-2">
        {documents.length === 0 ? <li className="text-sm text-muted-foreground">{loanId ? t("app.emptyDocuments") : t("app.emptyDocumentsNone")}</li> : null}
        {documents.map((document) => (
          <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
            <span className="flex min-w-0 items-center gap-2">
              <input type="checkbox" aria-label={document.name} checked={picked.includes(document.id)} onChange={() => setPicked((current) => current.includes(document.id) ? current.filter((id) => id !== document.id) : [...current, document.id])} />
              <strong className="break-words">{document.name}</strong>
              {document.hasFile ? <a className="text-sm underline" href={`/api/app/documents/${document.id}/file`}>{t("loan.download")}</a> : null}
            </span>
            <select
              aria-label={t("command.status")}
              className="h-11 rounded-md border border-input bg-background px-3"
              value={document.status}
              onChange={(event) => void dispatch(saveDocument({ id: document.id, status: event.target.value })).then(() => dispatch(fetchDocuments({ loanId: Number(loanId) || 0, sort, dir: sort === "id" ? "desc" : "asc" })))}
            >
              {STATUSES.map((status) => <option key={status} value={status}>{t(`app.${status}`)}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}
