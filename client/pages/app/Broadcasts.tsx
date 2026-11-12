import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { createBroadcast, fetchBroadcasts, fetchTemplates } from "@/store/slices/recordsSlice";
import DevFill from "@/components/dev/DevFill";
import PageSkeleton from "@/components/portal/PageSkeleton";
import SectionHeader from "@/components/portal/SectionHeader";
import GridTools from "@/components/portal/GridTools";

export default function Broadcasts() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const broadcasts = useAppSelector((state) => state.records.broadcasts);
  const templates = useAppSelector((state) => state.records.templates);
  const office = useAppSelector((state) => state.auth.user?.tenantName || "");
  const loading = useAppSelector((state) => state.records.loading);
  const errorKey = useAppSelector((state) => state.records.errorKey);
  const [name, setName] = useState("");
  const [audience, setAudience] = useState("clients");
  const [channel, setChannel] = useState("email");
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    void dispatch(fetchBroadcasts({ search }));
    void dispatch(fetchTemplates({}));
  }, [dispatch, search]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const result = await dispatch(createBroadcast({ name, audience, channel, body, templateId }));
    if (createBroadcast.fulfilled.match(result)) {
      setName("");
      setBody("");
      void dispatch(fetchBroadcasts({ search }));
    }
  }

  if (loading && broadcasts.length === 0) return <PageSkeleton cards={1} lines={4} label={t("app.loading")} />;

  return (
    <div className="portal-rise mx-auto max-w-3xl">
      <SectionHeader title={t("modules.broadcasts.name")} tools={<Input className="section-search" aria-label={t("command.search")} placeholder={t("command.search")} value={search} onChange={(event) => setSearch(event.target.value)} />} />
      <GridTools screen="broadcasts" path="/api/app/broadcasts" filename="broadcasts.csv" query={{ search }} onApply={(next) => setSearch(next.search || "")} />
      <p className="mt-2 text-sm text-muted-foreground">{t("app.broadcastHold")}</p>
      <form className="mt-6 grid gap-3" onSubmit={onCreate}>
        <DevFill className="justify-self-start" onFill={() => {
          setName("Rate update");
          setAudience("clients");
          setChannel("email");
          setBody("A short note from the team: rates moved this week. Reply if you want a fresh quote.");
        }} />
        <Input required aria-label={t("app.broadcastName")} placeholder={t("app.broadcastName")} value={name} onChange={(event) => setName(event.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <select className="h-11 rounded-md border border-input bg-background px-3" aria-label={t("app.audience")} value={audience} onChange={(event) => setAudience(event.target.value)}>
            <option value="clients">{t("app.clients")}</option>
            <option value="contacts">{t("app.contacts")}</option>
            <option value="realtors">{t("modules.realtors.name")}</option>
          </select>
          <select className="h-11 rounded-md border border-input bg-background px-3" aria-label={t("app.channel")} value={channel} onChange={(event) => setChannel(event.target.value)}>
            <option value="email">email</option>
            <option value="sms">sms</option>
          </select>
        </div>
        <select className="h-11 rounded-md border border-input bg-background px-3" aria-label={t("loan.messageTemplate")} value={templateId} onChange={(event) => {
          const id = event.target.value;
          setTemplateId(id);
          const picked = templates.find((item) => String(item.id) === id);
          if (picked) setBody(picked.body);
        }}>
          <option value="">{t("loan.messageTemplate")}</option>
          {templates.filter((item) => item.channel === channel || item.channel === "note").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <Textarea required aria-label={t("app.message")} value={body} onChange={(event) => setBody(event.target.value)} />
        <Button type="submit">{t("app.addBroadcast")}</Button>
      </form>
      {body ? (
        <article className="mt-4 rounded-2xl border border-primary/30 bg-card p-4">
          <p className="text-center font-display text-2xl">{office}</p>
          <p className="mt-3 whitespace-pre-wrap text-sm">{body}</p>
          <p className="mt-4 text-center text-xs text-muted-foreground">{office}</p>
        </article>
      ) : null}
      <ul className="mt-6 space-y-2">
        {broadcasts.map((item) => (
          <li key={item.id} className="rounded-2xl border border-border bg-card p-4">
            <strong>{item.name}</strong>
            <p className="text-xs text-muted-foreground">{item.audience} · {item.channel} · {t(`app.broadcastStatus.${item.status}`)} · {t("loan.delivered", { sent: item.sentCount || 0, count: item.recipientCount || 0 })}</p>
          </li>
        ))}
      </ul>
      {errorKey ? <p className="mt-3 text-sm text-destructive">{t(errorKey.startsWith("errors.") ? errorKey : `errors.${errorKey}`)}</p> : null}
    </div>
  );
}
