import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PageSkeleton from "@/components/portal/PageSkeleton";
import PersonWelcome from "@/components/portal/PersonWelcome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAppDispatch } from "@/store/hooks";
import { fetchPublicOffice, submitPublicAnalysis, type PublicOffice } from "@/store/slices/workspaceSlice";

export default function Analyze() {
  const { t } = useTranslation();
  const { slug = "", officer = "" } = useParams();
  const dispatch = useAppDispatch();
  const [office, setOffice] = useState<PublicOffice | null>(null);
  const [missing, setMissing] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [summary, setSummary] = useState("");
  const [scoreBand, setScoreBand] = useState("unknown");

  useEffect(() => {
    void dispatch(fetchPublicOffice(officer ? { slug, officer } : slug)).then((result) => {
      if (fetchPublicOffice.fulfilled.match(result)) setOffice(result.payload);
      else setMissing(true);
    });
  }, [dispatch, slug, officer]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await dispatch(submitPublicAnalysis({ slug, officer, firstName, lastName, email, summary, scoreBand }));
    if (submitPublicAnalysis.fulfilled.match(result)) setSent(true);
    else setError(String(result.payload || "errors.server"));
  }

  if (missing) return <p className="p-8 text-sm">{t("errors.notFound")}</p>;
  if (!office) return <PageSkeleton cards={1} lines={3} label={t("app.loading")} />;

  return (
    <form className="portal-rise mx-auto min-h-screen w-full max-w-lg space-y-6 px-4 py-10 sm:px-6 sm:py-14" style={office.primaryColor ? { ["--primary" as string]: office.primaryColor } : undefined} onSubmit={onSubmit}>
      <PersonWelcome office={office} />
      <h1 className="font-display text-4xl">{t("loan.analyze")}</h1>
      <p className="text-muted-foreground">{t("loan.analyzeLead")}</p>
      {sent ? <p>{t("apply.sent")}</p> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input required aria-label={t("app.firstName")} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            <Input required aria-label={t("app.lastName")} value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </div>
          <Input required type="email" aria-label={t("app.email")} value={email} onChange={(event) => setEmail(event.target.value)} />
          <select className="h-11 rounded-xl border border-input bg-background px-3" aria-label={t("loan.band")} value={scoreBand} onChange={(event) => setScoreBand(event.target.value)}>
            {["unknown", "excellent", "good", "fair", "poor"].map((band) => <option key={band} value={band}>{band}</option>)}
          </select>
          <Textarea required aria-label={t("loan.summary")} value={summary} onChange={(event) => setSummary(event.target.value)} />
          {error ? <p className="text-sm text-destructive">{t(error.startsWith("errors.") ? error : `errors.${error}`)}</p> : null}
          <Button type="submit">{t("apply.send")}</Button>
        </>
      )}
    </form>
  );
}
