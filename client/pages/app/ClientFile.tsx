import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PageSkeleton from "@/components/portal/PageSkeleton";
import SectionHeader from "@/components/portal/SectionHeader";
import { formatMoney } from "@/lib/format";
import { useAppDispatch } from "@/store/hooks";
import { fetchClientFile, saveClient } from "@/store/slices/workspaceSlice";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type File = {
  client: { firstName: string; lastName: string; email: string; phone: string; birthday: string; source: string };
  loans: { id: number; purpose: string; amountCents: number; status: string; address: string }[];
  conversations: { id: number; channel: string; subject: string }[];
};

export default function ClientFile() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const dispatch = useAppDispatch();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [birthday, setBirthday] = useState("");

  useEffect(() => {
    void dispatch(fetchClientFile(Number(id))).then((result) => {
      if (fetchClientFile.fulfilled.match(result)) {
        const next = result.payload as File;
        setFile(next);
        setBirthday(next.client.birthday || "");
      }
      else setError(String(result.payload || "errors.server"));
    });
  }, [dispatch, id]);

  if (!file && !error) return <PageSkeleton cards={2} lines={3} label={t("app.loading")} />;
  if (!file) return <p className="text-sm text-destructive">{t(error.startsWith("errors.") ? error : `errors.${error}`)}</p>;

  const last = file.conversations[0];

  return (
    <div className="portal-rise mx-auto max-w-3xl space-y-4">
      <SectionHeader title={`${file.client.firstName} ${file.client.lastName}`} meta={file.client.source ? t(`source.${file.client.source}`, { defaultValue: file.client.source }) : ""} />
      <p className="flex flex-wrap gap-3 text-sm">
        {file.client.email ? <a className="underline" href={`mailto:${file.client.email}`}>{file.client.email}</a> : null}
        {file.client.phone ? <a className="underline" href={`tel:${file.client.phone}`}>{file.client.phone}</a> : null}
      </p>
      <form className="flex min-w-0 flex-wrap gap-2" onSubmit={(event) => {
        event.preventDefault();
        void dispatch(saveClient({ id: Number(id), birthday, email: file.client.email, phone: file.client.phone })).then((result) => {
          if (saveClient.fulfilled.match(result)) setFile({ ...file, client: { ...file.client, birthday } });
        });
      }}>
        <Input className="min-w-0 flex-1" type="date" aria-label={t("loan.birthday")} value={birthday} onChange={(event) => setBirthday(event.target.value)} />
        <Button type="submit">{t("app.save")}</Button>
      </form>
      {last ? <p className="text-sm">{t("loan.lastTalk")}: {last.subject} · {t(`app.channels.${last.channel}`, { defaultValue: last.channel })}</p> : null}
      <ul className="space-y-2">
        {file.loans.map((loan) => (
          <li key={loan.id} className="rounded-2xl border border-border bg-card p-4">
            <Link to={`/app/loans/${loan.id}`}>{t(`app.${loan.purpose}`)} · {formatMoney(loan.amountCents)}</Link>
            {loan.address ? <p className="text-sm text-muted-foreground">{loan.address}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
